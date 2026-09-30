require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");

const app = express();

/* =========================
   CONFIG
========================= */

const PORT = process.env.PORT || 3000;
const REGISTRATION_FEE = 499;

const UPI_ID = (process.env.UPI_ID || "").trim();
const UPI_NAME =
  process.env.UPI_NAME || "Rent Friend India";

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "admin@example.com";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "change-this-password";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "rent-friend-india-change-this-secret";

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");

/* =========================
   FOLDERS
========================= */

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, {
    recursive: true
  });
}

/* =========================
   MIDDLEWARE
========================= */

app.use(
  express.json({
    limit: "12mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "12mb"
  })
);

app.use(cookieParser());

app.use(express.static(PUBLIC_DIR));

/* =========================
   DATABASE
========================= */

const db = new Database(
  path.join(__dirname, "app.db")
);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  age INTEGER,
  city TEXT DEFAULT '',
  gender TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  role TEXT DEFAULT 'user',
  verified INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  utr TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

/* =========================
   DATABASE MIGRATION
========================= */

function addColumnIfMissing(
  table,
  column,
  definition
) {
  const columns = db
    .prepare(`PRAGMA table_info(${table})`)
    .all();

  const exists = columns.some(
    (item) => item.name === column
  );

  if (!exists) {
    db.exec(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`
    );
  }
}

addColumnIfMissing(
  "users",
  "phone",
  "TEXT DEFAULT ''"
);

addColumnIfMissing(
  "users",
  "age",
  "INTEGER"
);

addColumnIfMissing(
  "users",
  "city",
  "TEXT DEFAULT ''"
);

addColumnIfMissing(
  "users",
  "gender",
  "TEXT DEFAULT ''"
);

addColumnIfMissing(
  "users",
  "bio",
  "TEXT DEFAULT ''"
);

addColumnIfMissing(
  "users",
  "photo_url",
  "TEXT DEFAULT ''"
);

addColumnIfMissing(
  "users",
  "role",
  "TEXT DEFAULT 'user'"
);

addColumnIfMissing(
  "users",
  "verified",
  "INTEGER DEFAULT 0"
);

addColumnIfMissing(
  "users",
  "active",
  "INTEGER DEFAULT 1"
);

addColumnIfMissing(
  "users",
  "created_at",
  "TEXT DEFAULT CURRENT_TIMESTAMP"
);

/* =========================
   AUTH HELPERS
========================= */

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role || "user"
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

function getCurrentUser(req) {
  const token = req.cookies.auth;

  if (!token) {
    return null;
  }

  try {
    return jwt.verify(
      token,
      JWT_SECRET
    );
  } catch (error) {
    return null;
  }
}

function auth(req, res, next) {
  const user = getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Login required"
    });
  }

  req.user = user;
  next();
}

function adminAuth(req, res, next) {
  const user = getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Admin login required"
    });
  }

  if (user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required"
    });
  }

  req.user = user;
  next();
}

function setAuthCookie(res, token) {
  res.cookie("auth", token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production",
    maxAge:
      7 * 24 * 60 * 60 * 1000
  });
}

function safeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    phone: user.phone || "",
    email: user.email,
    age: user.age || null,
    city: user.city || "",
    gender: user.gender || "",
    bio: user.bio || "",
    photo_url: user.photo_url || "",
    role: user.role || "user",
    verified: !!user.verified,
    active: !!user.active,
    created_at: user.created_at
  };
}

/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message:
      "Rent Friend India server is running",
    time: new Date().toISOString()
  });
});

/* =========================
   PAYMENT INFO
========================= */

app.get(
  "/api/payment-info",
  async (req, res) => {
    try {
      let qr = "";
      let upiLink = "";

      if (UPI_ID) {
        upiLink =
          "upi://pay?pa=" +
          encodeURIComponent(UPI_ID) +
          "&pn=" +
          encodeURIComponent(UPI_NAME) +
          "&am=" +
          encodeURIComponent(
            REGISTRATION_FEE
          ) +
          "&cu=INR";

        qr = await QRCode.toDataURL(
          upiLink
        );
      }

      res.json({
        success: true,

        amount: REGISTRATION_FEE,

        upi_id: UPI_ID,
        upi_name: UPI_NAME,
        qr,

        // Also send camelCase
        // for frontend compatibility
        upiId: UPI_ID,
        upiName: UPI_NAME,
        qrCode: qr,
        upiLink
      });
    } catch (error) {
      console.error(
        "PAYMENT INFO ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to create payment QR"
      });
    }
  }
);

/* =========================
   REGISTER
========================= */

app.post(
  "/api/register",
  async (req, res) => {
    try {
      const {
        name,
        phone,
        email,
        password,
        age,
        city,
        gender,
        bio
      } = req.body || {};

      if (
        !name ||
        !email ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Name, email and password are required"
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 6 characters"
        });
      }

      const cleanEmail =
        String(email)
          .trim()
          .toLowerCase();

      const existing = db
        .prepare(
          "SELECT id FROM users WHERE email = ?"
        )
        .get(cleanEmail);

      if (existing) {
        return res.status(400).json({
          success: false,
          message:
            "Email already registered. Please login."
        });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          10
        );

      const result = db
        .prepare(`
          INSERT INTO users
          (
            name,
            phone,
            email,
            password_hash,
            age,
            city,
            gender,
            bio,
            role,
            verified,
            active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user', 0, 1)
        `)
        .run(
          String(name).trim(),
          phone || "",
          cleanEmail,
          passwordHash,
          age || null,
          city || "",
          gender || "",
          bio || ""
        );

      const user = db
        .prepare(
          "SELECT * FROM users WHERE id = ?"
        )
        .get(
          result.lastInsertRowid
        );

      const token =
        createToken(user);

      setAuthCookie(
        res,
        token
      );

      res.status(201).json({
        success: true,
        message:
          "Account details saved. Please complete ₹499 payment and submit UTR for admin approval.",
        user: safeUser(user),
        payment_required: true,
        paymentRequired: true,
        amount: REGISTRATION_FEE
      });
    } catch (error) {
      console.error(
        "REGISTER ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Registration failed"
      });
    }
  }
);

/* =========================
   LOGIN
========================= */

app.post(
  "/api/login",
  async (req, res) => {
    try {
      const email =
        String(
          req.body.email || ""
        )
          .trim()
          .toLowerCase();

      const password =
        req.body.password || "";

      const user = db
        .prepare(
          "SELECT * FROM users WHERE email = ?"
        )
        .get(email);

      if (!user) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid email or password"
        });
      }

      const passwordOk =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (!passwordOk) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid email or password"
        });
      }

      if (!user.active) {
        return res.status(403).json({
          success: false,
          message:
            "Your account is inactive"
        });
      }

      const token =
        createToken(user);

      setAuthCookie(
        res,
        token
      );

      res.json({
        success: true,
        message:
          user.verified
            ? "Login successful"
            : "Login successful. ₹499 payment approval is pending.",
        user: safeUser(user),
        paymentRequired:
          !user.verified,
        amount:
          REGISTRATION_FEE
      });
    } catch (error) {
      console.error(
        "LOGIN ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Login failed"
      });
    }
  }
);

/* =========================
   LOGOUT
========================= */

app.post(
  "/api/logout",
  (req, res) => {
    res.clearCookie("auth");

    res.json({
      success: true,
      message: "Logged out"
    });
  }
);

/* =========================
   CURRENT USER
========================= */

app.get(
  "/api/me",
  auth,
  (req, res) => {
    try {
      const user = db
        .prepare(
          "SELECT * FROM users WHERE id = ?"
        )
        .get(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User not found"
        });
      }

      const payment = db
        .prepare(`
          SELECT *
          FROM payments
          WHERE user_id = ?
          ORDER BY id DESC
          LIMIT 1
        `)
        .get(req.user.id);

      res.json({
        success: true,
        user: safeUser(user),
        payment:
          payment || null,
        verified:
          !!user.verified,
        amount:
          REGISTRATION_FEE
      });
    } catch (error) {
      console.error(
        "ME ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to load account"
      });
    }
  }
);

/* =========================
   PUBLIC PROFILES
========================= */

app.get(
  "/api/profiles",
  (req, res) => {
    try {
      const search =
        String(
          req.query.search || ""
        )
          .trim()
          .toLowerCase();

      const city =
        String(
          req.query.city || ""
        )
          .trim()
          .toLowerCase();

      const gender =
        String(
          req.query.gender || ""
        )
          .trim()
          .toLowerCase();

      let query = `
        SELECT
          id,
          name,
          age,
          city,
          gender,
          bio,
          photo_url,
          verified
        FROM users
        WHERE active = 1
        AND verified = 1
      `;

      const params = [];

      if (search) {
        query += `
          AND (
            lower(name) LIKE ?
            OR lower(city) LIKE ?
            OR lower(gender) LIKE ?
            OR lower(bio) LIKE ?
          )
        `;

        const s = `%${search}%`;

        params.push(
          s,
          s,
          s,
          s
        );
      }

      if (city) {
        query += `
          AND lower(city) LIKE ?
        `;

        params.push(
          `%${city}%`
        );
      }

      if (gender) {
        query += `
          AND lower(gender) = ?
        `;

        params.push(
          gender
        );
      }

      query += `
        ORDER BY id DESC
      `;

      const users = db
        .prepare(query)
        .all(...params);

      res.json({
        success: true,
        profiles: users
      });
    } catch (error) {
      console.error(
        "PROFILES ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to load profiles"
      });
    }
  }
);

/* =========================
   SINGLE PROFILE
========================= */

app.get(
  "/api/profiles/:id",
  (req, res) => {
    try {
      const user = db
        .prepare(`
          SELECT
            id,
            name,
            age,
            city,
            gender,
            bio,
            photo_url,
            verified
          FROM users
          WHERE id = ?
          AND active = 1
          AND verified = 1
        `)
        .get(req.params.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "Profile not found"
        });
      }

      res.json({
        success: true,
        profile: user
      });
    } catch (error) {
      console.error(
        "PROFILE ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to load profile"
      });
    }
  }
);

/* =========================
   UPDATE PROFILE
========================= */

app.put(
  "/api/profile",
  auth,
  (req, res) => {
    try {
      const {
        name,
        phone,
        age,
        city,
        gender,
        bio
      } = req.body || {};

      if (!name) {
        return res.status(400).json({
          success: false,
          message:
            "Name is required"
        });
      }

      db.prepare(`
        UPDATE users
        SET
          name = ?,
          phone = ?,
          age = ?,
          city = ?,
          gender = ?,
          bio = ?
        WHERE id = ?
      `).run(
        String(name).trim(),
        phone || "",
        age || null,
        city || "",
        gender || "",
        bio || "",
        req.user.id
      );

      const user = db
        .prepare(
          "SELECT * FROM users WHERE id = ?"
        )
        .get(req.user.id);

      res.json({
        success: true,
        message:
          "Profile updated",
        user: safeUser(user)
      });
    } catch (error) {
      console.error(
        "PROFILE UPDATE ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Profile update failed"
      });
    }
  }
);

/* =========================
   PHOTO UPLOAD
========================= */

app.post(
  "/api/profile/photo",
  auth,
  (req, res) => {
    try {
      const image =
        req.body.image ||
        req.body.photo ||
        "";

      if (!image) {
        return res.status(400).json({
          success: false,
          message:
            "Photo is required"
        });
      }

      const match =
        image.match(
          /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i
        );

      if (!match) {
        return res.status(400).json({
          success: false,
          message:
            "Only PNG, JPG, JPEG or WEBP images are supported"
        });
      }

      const extension =
        match[1].toLowerCase() ===
        "jpeg"
          ? "jpg"
          : match[1].toLowerCase();

      const base64Data =
        match[2];

      const fileName =
        "user-" +
        req.user.id +
        "-" +
        Date.now() +
        "." +
        extension;

      const filePath =
        path.join(
          UPLOAD_DIR,
          fileName
        );

      fs.writeFileSync(
        filePath,
        Buffer.from(
          base64Data,
          "base64"
        )
      );

      const photoUrl =
        "/uploads/" +
        fileName;

      db.prepare(`
        UPDATE users
        SET photo_url = ?
        WHERE id = ?
      `).run(
        photoUrl,
        req.user.id
      );

      res.json({
        success: true,
        message:
          "Photo uploaded",
        photo_url:
          photoUrl
      });
    } catch (error) {
      console.error(
        "PHOTO ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Photo upload failed"
      });
    }
  }
);

/* =========================
   PAYMENT SUBMIT
========================= */

app.post(
  "/api/payment/submit",
  auth,
  (req, res) => {
    try {
      const utr =
        String(
          req.body.utr || ""
        ).trim();

      if (!utr) {
        return res.status(400).json({
          success: false,
          message:
            "UTR number is required"
        });
      }

      if (utr.length < 6) {
        return res.status(400).json({
          success: false,
          message:
            "Please enter a valid UTR number"
        });
      }

      const user = db
        .prepare(
          "SELECT id FROM users WHERE id = ?"
        )
        .get(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User not found"
        });
      }

      const existing = db
        .prepare(`
          SELECT id
          FROM payments
          WHERE user_id = ?
          AND status = 'pending'
          ORDER BY id DESC
          LIMIT 1
        `)
        .get(req.user.id);

      if (existing) {
        db.prepare(`
          UPDATE payments
          SET
            utr = ?,
            amount = ?
          WHERE id = ?
        `).run(
          utr,
          REGISTRATION_FEE,
          existing.id
        );
      } else {
        db.prepare(`
          INSERT INTO payments
          (
            user_id,
            amount,
            utr,
            status
          )
          VALUES (?, ?, ?, 'pending')
        `).run(
          req.user.id,
          REGISTRATION_FEE,
          utr
        );
      }

      res.json({
        success: true,
        message:
          "Payment submitted. Waiting for admin approval.",
        status: "pending"
      });
    } catch (error) {
      console.error(
        "PAYMENT SUBMIT ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Payment submission failed"
      });
    }
  }
);

/* Compatibility URL */
app.post(
  "/api/payment-submit",
  auth,
  (req, res) => {
    req.url =
      "/api/payment/submit";
  }
);

/* =========================
   PAYMENT STATUS
========================= */

app.get(
  "/api/payment/statu

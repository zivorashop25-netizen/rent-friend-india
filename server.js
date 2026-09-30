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
   SETTINGS
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

const PUBLIC_DIR =
  path.join(__dirname, "public");

const UPLOAD_DIR =
  path.join(PUBLIC_DIR, "uploads");

/* =========================
   UPLOAD FOLDER
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

app.use(
  express.static(PUBLIC_DIR)
);

/* =========================
   DATABASE
========================= */

const db = new Database(
  path.join(__dirname, "app.db")
);

db.pragma(
  "journal_mode = WAL"
);

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
   ADD MISSING COLUMNS
========================= */

function addColumnIfMissing(
  table,
  column,
  definition
) {
  const columns =
    db.prepare(
      `PRAGMA table_info(${table})`
    ).all();

  const exists =
    columns.some(
      item => item.name === column
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
   AUTH FUNCTIONS
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
  const token =
    req.cookies.auth;

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

function auth(
  req,
  res,
  next
) {
  const user =
    getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      success: false,
      message:
        "Login required"
    });
  }

  req.user = user;

  next();
}

function adminAuth(
  req,
  res,
  next
) {
  const user =
    getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      success: false,
      message:
        "Admin login required"
    });
  }

  if (
    user.role !== "admin"
  ) {
    return res.status(403).json({
      success: false,
      message:
        "Admin access required"
    });
  }

  req.user = user;

  next();
}

function setAuthCookie(
  res,
  token
) {
  res.cookie(
    "auth",
    token,
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      maxAge:
        7 *
        24 *
        60 *
        60 *
        1000
    }
  );
}

/* =========================
   SAFE USER
========================= */

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
    photo_url:
      user.photo_url || "",
    role:
      user.role || "user",
    verified:
      !!user.verified,
    active:
      !!user.active,
    created_at:
      user.created_at
  };
}

/* =========================
   HEALTH CHECK
========================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success: true,
      message:
        "Rent Friend India server is running",
      time:
        new Date().toISOString()
    });
  }
);

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
          encodeURIComponent(
            UPI_ID
          ) +
          "&pn=" +
          encodeURIComponent(
            UPI_NAME
          ) +
          "&am=" +
          encodeURIComponent(
            REGISTRATION_FEE
          ) +
          "&cu=INR";

        qr =
          await QRCode.toDataURL(
            upiLink
          );
      }

      res.json({
        success: true,
        amount:
          REGISTRATION_FEE,

        upi_id:
          UPI_ID,

        upi_name:
          UPI_NAME,

        qr:
          qr,

        upiId:
          UPI_ID,

        upiName:
          UPI_NAME,

        qrCode:
          qr,

        upiLink:
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

      if (
        String(password).length < 6
      ) {
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

      const existing =
        db.prepare(
          "SELECT id FROM users WHERE email = ?"
        ).get(
          cleanEmail
        );

      if (existing) {
        return res.status(400).json({
          success: false,
          message:
            "Email already registered. Please login."
        });
      }

      const passwordHash =
        await bcrypt.hash(
          String(password),
          10
        );

      const result =
        db.prepare(`
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
          VALUES
          (
            ?, ?, ?, ?, ?, ?, ?, ?,
            'user', 0, 1
          )
        `).run(
          String(name).trim(),
          String(
            phone || ""
          ).trim(),
          cleanEmail,
          passwordHash,
          age || null,
          String(
            city || ""
          ).trim(),
          String(
            gender || ""
          ).trim(),
          String(
            bio || ""
          ).trim()
        );

      const user =
        db.prepare(
          "SELECT * FROM users WHERE id = ?"
        ).get(
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
          "Account details saved. Complete ₹499 payment and submit UTR for approval.",
        user:
          safeUser(user),
        payment_required:
          true,
        paymentRequired:
          true,
        amount:
          REGISTRATION_FEE
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

      const user =
        db.prepare(
          "SELECT * FROM users WHERE email = ?"
        ).get(
          email
        );

      if (!user) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid email or password"
        });
      }

      const passwordOk =
        await bcrypt.compare(
          String(password),
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

        user:
          safeUser(user),

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
    res.clearCookie(
      "auth"
    );

    res.json({
      success: true,
      message:
        "Logged out"
    });
  }
);

/* =========================
   MY ACCOUNT
========================= */

app.get(
  "/api/me",
  auth,
  (req, res) => {
    try {
      const user =
        db.prepare(
          "SELECT * FROM users WHERE id = ?"
        ).get(
          req.user.id
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User not found"
        });
      }

      const payment =
        db.prepare(`
          SELECT *
          FROM payments
          WHERE user_id = ?
          ORDER BY id DESC
          LIMIT 1
        `).get(
          req.user.id
        );

      res.json({
        success: true,

        user:
          safeUser(user),

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
   PROFILES / SEARCH
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

        const s =
          `%${search}%`;

        params.push(
          s,
          s,
          s,
          s
        );
      }

      if (city) {
        query +=
          ` AND lower(city) LIKE

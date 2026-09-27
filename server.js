require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const QRCode = require("qrcode");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET =
  process.env.JWT_SECRET || "change-this-secret";

const REGISTRATION_FEE =
  Number(process.env.REGISTRATION_FEE) || 499;

const UPI_ID =
  process.env.UPI_ID || "yourupi@bank";

const UPI_NAME =
  process.env.UPI_NAME || "Rent Friend India";

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "admin@example.com";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "ChangeThisPassword123";

const db = new Database("app.db");

db.pragma("journal_mode = WAL");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "public")));

/* DATABASE */

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  age INTEGER,
  city TEXT,
  gender TEXT,
  bio TEXT,
  photo_url TEXT,
  role TEXT DEFAULT 'user',
  verified INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  upi_id TEXT,
  utr TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  admin_note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

/* AUTH */

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req, res, next) {
  try {
    const token = req.cookies.auth;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Login required"
      });
    }

    req.user = jwt.verify(token, JWT_SECRET);
    next();

  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Session expired"
    });
  }
}

function adminAuth(req, res, next) {
  try {
    const token = req.cookies.auth;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Admin login required"
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    req.user = decoded;
    next();

  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Admin session expired"
    });
  }
}

/* PAYMENT INFO */

app.get("/api/payment-info", async (req, res) => {
  try {

    const upiLink =
      `upi://pay?pa=${encodeURIComponent(UPI_ID)}` +
      `&pn=${encodeURIComponent(UPI_NAME)}` +
      `&am=${REGISTRATION_FEE}` +
      `&cu=INR`;

    const qr =
      await QRCode.toDataURL(upiLink);

    res.json({
      success: true,
      amount: REGISTRATION_FEE,
      upiId: UPI_ID,
      upiName: UPI_NAME,
      qr,
      upiLink
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Payment information unavailable"
    });
  }
});

/* REGISTER */

app.post("/api/register", async (req, res) => {
  try {

    const {
      name,
      email,
      password,
      phone,
      age,
      city,
      gender,
      bio
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 6 characters"
      });
    }

    const cleanEmail =
      email.toLowerCase().trim();

    const existing =
      db.prepare(
        "SELECT id FROM users WHERE email = ?"
      ).get(cleanEmail);

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Email already registered"
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 12);

    const result =
      db.prepare(`
        INSERT INTO users
        (name,email,password_hash,phone,age,city,gender,bio)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(
        name.trim(),
        cleanEmail,
        passwordHash,
        phone || "",
        age || null,
        city || "",
        gender || "",
        bio || ""
      );

    res.json({
      success: true,
      message: "Registration successful",
      userId: result.lastInsertRowid
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
});

/* LOGIN */

app.post("/api/login", async (req, res) => {
  try {

    const { email, password } = req.body;

    const user =
      db.prepare(
        "SELECT * FROM users WHERE email = ?"
      ).get(email.toLowerCase().trim());

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const valid =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const token =
      createToken(user);

    res.cookie("auth", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: "Login successful"
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});

/* LOGOUT */

app.post("/api/logout", (req, res) => {

  res.clearCookie("auth");

  res.json({
    success: true,
    message: "Logged out"
  });
});

/* CURRENT USER */

app.get("/api/me", auth, (req, res) => {

  const user =
    db.prepare(`
      SELECT
        id,name,email,phone,age,city,
        gender,bio,photo_url,role,
        verified,active,created_at
      FROM users
      WHERE id = ?
    `).get(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  const payment =
    db.prepare(`
      SELECT
        id,amount,utr,status,
        created_at,reviewed_at
      FROM payments
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(req.user.id);

  res.json({
    success: true,
    user,
    payment: payment || null
  });
});

/* PROFILES */

app.get("/api/profiles", (req, res) => {

  const city =
    req.query.city || "";

  const gender =
    req.query.gender || "";

  let sql = `
    SELECT
      id,name,age,city,
      gender,bio,photo_url,verified
    FROM users
    WHERE active = 1
    AND verified = 1
  `;

  const params = [];

  if (city) {
    sql += " AND city LIKE ?";
    params.push(`%${city}%`);
  }

  if (gender) {
    sql += " AND gender = ?";
    params.push(gender);
  }

  sql += " ORDER BY id DESC LIMIT 50";

  const profiles =
    db.prepare(sql).all(...params);

  res.json({
    success: true,
    profiles
  });
});

/* SUBMIT UTR */

app.post("/api/payment-submit", auth, (req, res) => {

  const { utr } = req.body;

  if (!utr || utr.trim().length < 6) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid UTR/reference number"
    });
  }

  const pending =
    db.prepare(`
      SELECT id
      FROM payments
      WHERE user_id = ?
      AND status = 'pending'
    `).get(req.user.id);

  if (pending) {
    return res.status(409).json({
      success: false,
      message: "Payment already waiting for approval"
    });
  }

  const result =
    db.prepare(`
      INSERT INTO payments
      (user_id,amount,upi_id,utr,status)
      VALUES (?,?,?,?,?)
    `).run(
      req.user.id,
      REGISTRATION_FEE,
      UPI_ID,
      utr.trim(),
      "pending"
    );

  res.json({
    success: true,
    message: "UTR submitted. Waiting for admin approval.",
    paymentId: result.lastInsertRowid
  });
});

/* ADMIN LOGIN */

app.post("/api/admin-login", (req, res) => {

  const {
    email,
    password
  } = req.body;

  if (
    email !== ADMIN_EMAIL ||
    password !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin credentials"
    });
  }

  const admin = {
    id: 0,
    email: ADMIN_EMAIL,
    role: "admin"
  };

  const token =
    createToken(admin);

  res.cookie("auth", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    message: "Admin login successful"
  });
});

/* ADMIN PAYMENTS */

app.get(
  "/api/admin/payments",
  adminAuth,
  (req, res) => {

    const payments =
      db.prepare(`
        SELECT
          payments.id,
          payments.user_id,
          payments.amount,
          payments.utr,
          payments.status,
          payments.admin_note,
          payments.created_at,
          payments.reviewed_at,
          users.name,
          users.email,
          users.phone,
          users.city
        FROM payments
        JOIN users
        ON users.id = payments.user_id
        ORDER BY payments.id DESC
      `).all();

    res.json({
      success: true,
      payments
    });
  }
);

/* APPROVE */

app.post(
  "/api/admin/payments/:id/approve",
  adminAuth,
  (req, res) => {

    const paymentId =
      Number(req.params.id);

    const payment =
      db.prepare(
        "SELECT * FROM payments WHERE id = ?"
      ).get(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    db.prepare(`
      UPDATE payments
      SET status = 'approved',
          admin_note = ?,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      req.body.note ||
      "Payment verified by admin",
      paymentId
    );

    db.prepare(`
      UPDATE users
      SET verified = 1
      WHERE id = ?
    `).run(payment.user_id);

    res.json({
      success: true,
      message: "Payment approved"
    });
  }
);

/* REJECT */

app.post(
  "/api/admin/payments/:id/reject",
  adminAuth,
  (req, res) => {

    const paymentId =
      Number(req.params.id);

    const payment =
      db.prepare(
        "SELECT * FROM payments WHERE id = ?"
      ).get(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    db.prepare(`
      UPDATE payments
      SET status = 'rejected',
          admin_note = ?,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      req.body.note ||
      "Payment could not be verified",
      paymentId
    );

    res.json({
      success: true,
      message: "Payment rejected"
    });
  }
);

/* ADMIN USERS */

app.get(
  "/api/admin/users",
  adminAuth,
  (req, res) => {

    const users =
      db.prepare(`
        SELECT
          id,name,email,phone,
          age,city,gender,
          verified,active,created_at
        FROM users
        ORDER BY id DESC
      `).all();

    res.json({
      success: true,
      users
    });
  }
);

/* HEALTH */

app.get("/api/health", (req, res) => {

  res.json({
    success: true,
    status: "online"
  });
});

/* WEBSITE FALLBACK */

app.use((req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

/* START */

app.listen(PORT, () => {

  console.log(
    `Rent Friend India running on port ${PORT}`
  );
});

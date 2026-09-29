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
const REGISTRATION_FEE = Number(process.env.REGISTRATION_FEE || 499);
const UPI_ID = process.env.UPI_ID || "";
const UPI_NAME = process.env.UPI_NAME || "Rent Friend India";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const JWT_SECRET =
  process.env.JWT_SECRET || "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "public")));

/* =========================
   DATABASE
========================= */

const db = new Database("app.db");

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'user',
  age INTEGER,
  city TEXT,
  gender TEXT,
  bio TEXT,
  photo_url TEXT,
  verified INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  utr TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

/* =========================
   AUTH HELPERS
========================= */

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
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Login required."
      });
    }

    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Session expired. Please login again."
    });
  }
}

function adminAuth(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required."
    });
  }

  next();
}

/* =========================
   PAYMENT INFORMATION
========================= */

app.get("/api/payment-info", async (req, res) => {
  try {
    const upiLink =
      `upi://pay?pa=${encodeURIComponent(UPI_ID)}` +
      `&pn=${encodeURIComponent(UPI_NAME)}` +
      `&am=${REGISTRATION_FEE}` +
      `&cu=INR`;

    let qrCode = "";

    if (UPI_ID) {
      qrCode = await QRCode.toDataURL(upiLink);
    }

    res.json({
      success: true,
      amount: REGISTRATION_FEE,
      upiId: UPI_ID,
      upiName: UPI_NAME,
      upiLink,
      qrCode
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Payment information could not be loaded."
    });
  }
});

/* =========================
   CREATE ACCOUNT
========================= */

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

    if (
      !name ||
      !email ||
      !password ||
      !phone ||
      !age ||
      !city ||
      !gender
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields."
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const existingUser = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(cleanEmail);

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered. Please login."
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = db
      .prepare(`
        INSERT INTO users
        (
          name,
          email,
          password_hash,
          phone,
          age,
          city,
          gender,
          bio,
          verified,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
      `)
      .run(
        String(name).trim(),
        cleanEmail,
        passwordHash,
        String(phone).trim(),
        Number(age),
        String(city).trim(),
        String(gender).trim(),
        bio ? String(bio).trim() : ""
      );

    const user = db
      .prepare(`
        SELECT
          id,
          name,
          email,
          phone,
          age,
          city,
          gender,
          bio,
          verified,
          active
        FROM users
        WHERE id = ?
      `)
      .get(result.lastInsertRowid);

    const token = createToken({
      id: user.id,
      email: user.email,
      role: "user"
    });

    res.cookie("auth_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      accountCreated: true,
      paymentRequired: true,
      amount: REGISTRATION_FEE,
      message:
        `Account created. Now pay ₹${REGISTRATION_FEE} to complete registration.`,
      user
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Account creation failed."
    });
  }
});

/* =========================
   LOGIN
========================= */

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required."
      });
    }

    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(String(email).trim().toLowerCase());

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const passwordOk = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordOk) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const token = createToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    res.cookie("auth_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: user.verified
        ? "Login successful."
        : `Login successful. Please complete ₹${REGISTRATION_FEE} payment.`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        age: user.age,
        city: user.city,
        gender: user.gender,
        bio: user.bio,
        verified: !!user.verified,
        active: !!user.active
      },
      paymentRequired: !user.verified,
      amount: REGISTRATION_FEE
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Login failed."
    });
  }
});

/* =========================
   LOGOUT
========================= */

app.post("/api/logout", (req, res) => {
  res.clearCookie("auth_token");

  res.json({
    success: true,
    message: "Logged out."
  });
});

/* =========================
   CURRENT USER
========================= */

app.get("/api/me", auth, (req, res) => {
  const user = db
    .prepare(`
      SELECT
        id,
        name,
        email,
        phone,
        age,
        city,
        gender,
        bio,
        photo_url,
        verified,
        active,
        created_at
      FROM users
      WHERE id = ?
    `)
    .get(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }

  const pendingPayment = db
    .prepare(`
      SELECT id, amount, utr, status, created_at
      FROM payments
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `)
    .get(req.user.id);

  res.json({
    success: true,
    user: {
      ...user,
      verified: !!user.verified,
      active: !!user.active
    },
    paymentRequired: !user.verified,
    amount: REGISTRATION_FEE,
    payment: pendingPayment || null
  });
});

/* =========================
   PUBLIC PROFILES
========================= */

app.get("/api/profiles", (req, res) => {
  try {
    const { city, gender } = req.query;

    let sql = `
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

    if (city) {
      sql += " AND city LIKE ?";
      params.push(`%${city}%`);
    }

    if (gender) {
      sql += " AND gender = ?";
      params.push(gender);
    }

    sql += " ORDER BY id DESC";

    const profiles = db.prepare(sql).all(...params);

    res.json({
      success: true,
      profiles
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Profiles could not be loaded."
    });
  }
});

/* =========================
   SUBMIT UTR
========================= */

app.post("/api/payment-submit", auth, (req, res) => {
  try {
    const { utr } = req.body;

    if (!utr || String(utr).trim().length < 4) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid UTR / Transaction ID."
      });
    }

    const user = db
      .prepare("SELECT id, verified FROM users WHERE id = ?")
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (user.verified) {
      return res.status(400).json({
        success: false,
        message: "Your account is already verified."
      });
    }

    const pending = db
      .prepare(`
        SELECT id
        FROM payments
        WHERE user_id = ?
        AND status = 'pending'
        LIMIT 1
      `)
      .get(req.user.id);

    if (pending) {
      return res.status(400).json({
        success: false,
        message: "Your payment is already waiting for admin approval."
      });
    }

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
      String(utr).trim()
    );

    res.json({
      success: true,
      message:
        "Payment submitted successfully. Your account will become active after admin approval."
    });
  } catch (error) {
    console.error("PAYMENT SUBMIT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Payment submission failed."
    });
  }
});

/* =========================
   ADMIN LOGIN
========================= */

app.post("/api/admin-login", (req, res) => {
  const { email, password } = req.body;

  if (
    !ADMIN_EMAIL ||
    !ADMIN_PASSWORD ||
    email !== ADMIN_EMAIL ||
    password !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin login."
    });
  }

  const token = createToken({
    id: 0,
    email: ADMIN_EMAIL,
    role: "admin"
  });

  res.cookie("auth_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    message: "Admin login successful."
  });
});

/* =========================
   ADMIN PAYMENTS
========================= */

app.get("/api/admin/payments", auth, adminAuth, (req, res) => {
  const payments = db
    .prepare(`
      SELECT
        payments.id,
        payments.user_id,
        payments.amount,
        payments.utr,
        payments.status,
        payments.created_at,
        payments.approved_at,
        users.name,
        users.email,
        users.phone
      FROM payments
      JOIN users
        ON users.id = payments.user_id
      ORDER BY payments.id DESC
    `)
    .all();

  res.json({
    success: true,
    payments
  });
});

/* =========================
   ADMIN APPROVE PAYMENT
========================= */

app.post(
  "/api/admin/payments/:id/approve",
  auth,
  adminAuth

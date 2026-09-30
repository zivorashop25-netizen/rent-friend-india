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

const PORT = process.env.PORT || 3000;
const REGISTRATION_FEE = 499;

const UPI_ID = process.env.UPI_ID || "";
const UPI_NAME = process.env.UPI_NAME || "Rent Friend India";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-this-password";

const JWT_SECRET =
  process.env.JWT_SECRET || "rent-friend-india-change-this-secret";

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

app.use(express.static(PUBLIC_DIR));

/* =========================
   DATABASE
========================= */

const db = new Database(path.join(__dirname, "app.db"));

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  age INTEGER,
  city TEXT,
  gender TEXT,
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
  utr TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

/* =========================
   HELPERS
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

function getCurrentUser(req) {
  const token = req.cookies.auth;

  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
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

function safeUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    age: row.age,
    city: row.city,
    gender: row.gender,
    bio: row.bio,
    photo_url: row.photo_url,
    role: row.role,
    verified: !!row.verified,
    active: !!row.active,
    created_at: row.created_at
  };
}

/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Rent Friend India server is running",
    time: new Date().toISOString()
  });
});

/* =========================
   PAYMENT INFO
========================= */

app.get("/api/payment-info", async (req, res) => {
  try {
    let qr = "";

    if (UPI_ID) {
      const upiUrl =
        "upi://pay?pa=" +
        encodeURIComponent(UPI_ID) +
        "&pn=" +
        encodeURIComponent(UPI_NAME) +
        "&am=" +
        encodeURIComponent(REGISTRATION_FEE) +
        "&cu=INR";

      qr = await QRCode.toDataURL(upiUrl);
    }

    res.json({
      success: true,
      amount: REGISTRATION_FEE,
      upi_id: UPI_ID,
      upi_name: UPI_NAME,
      qr
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Unable to create payment QR"
    });
  }
});

/* =========================
   REGISTER
========================= */

app.post("/api/register", async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      password,
      age,
      city,
      gender
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
        message: "Password must be at least 6 characters"
      });
    }

    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email.trim().toLowerCase());

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = db
      .prepare(`
        INSERT INTO users
        (name, phone, email, password_hash, age, city, gender)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        name.trim(),
        phone || "",
        email.trim().toLowerCase(),
        passwordHash,
        age || null,
        city || "",
        gender || ""
      );

    const user = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(result.lastInsertRowid);

    const token = createToken(user);

    res.cookie("auth", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message:
        "Account created. Please complete the ₹499 payment and submit UTR for approval.",
      user: safeUser(user)
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
});

/* =========================
   LOGIN
========================= */

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get((email || "").trim().toLowerCase());

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const ok = await bcrypt.compare(password || "", user.password_hash);

    if (!ok) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const token = createToken(user);

    res.cookie("auth", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: "Login successful",
      user: safeUser(user)
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});

/* =========================
   LOGOUT
========================= */

app.post("/api/logout", (req, res) => {
  res.clearCookie("auth");

  res.json({
    success: true,
    message: "Logged out"
  });
});

/* =========================
   CURRENT ACCOUNT
========================= */

app.get("/api/me", auth, (req, res) => {
  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(req.user.id);

  if (!user) {
    return res.status(404

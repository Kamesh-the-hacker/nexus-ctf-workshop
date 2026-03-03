const express = require("express");
const QRCode = require("qrcode");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();

/* ---------------- SECURITY + MIDDLEWARE ---------------- */
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

/* ---------------- DATABASE ---------------- */
const db = new sqlite3.Database("./nexus_ctf.db", (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("SQLite Connected");
  }
});

db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  rollNo TEXT UNIQUE,
  email TEXT,
  department TEXT,
  year TEXT,
  phone TEXT,
  attendedCTF TEXT,
  qrCode TEXT,
  checkedIn INTEGER DEFAULT 0,
  checkInTime TEXT
)
`);

/* ---------------- ADMIN CONFIG ---------------- */
const ADMIN_USER = "admin";
const ADMIN_PASS_HASH = bcrypt.hashSync("nexus@123", 10);
const SECRET = "nexus_secret_key";

/* ---------------- REGISTER ---------------- */
app.post("/register", async (req, res) => {
  try {
    const { name, rollNo, email, department, year, phone, attendedCTF } = req.body;

    if (!name || !rollNo || !email)
      return res.status(400).json({ error: "Missing required fields" });

    const qrCode = "NEXUS2026-" + rollNo;

    const qrImage = await QRCode.toDataURL(qrCode, {
      width: 500,
      margin: 2
    });

    db.run(
      `INSERT INTO users 
      (name, rollNo, email, department, year, phone, attendedCTF, qrCode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, rollNo, email, department, year, phone, attendedCTF, qrCode],
      function (err) {
        if (err) {
          return res.status(400).json({ error: "Roll Number already registered!" });
        }

        res.json({ qr: qrImage });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Registration failed" });
  }
});

/* ---------------- ADMIN LOGIN ---------------- */
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (username !== ADMIN_USER)
    return res.status(401).json({ error: "Invalid Username" });

  const valid = bcrypt.compareSync(password, ADMIN_PASS_HASH);
  if (!valid)
    return res.status(401).json({ error: "Wrong Password" });

  const token = jwt.sign({ username }, SECRET, { expiresIn: "3h" });

  res.json({ token });
});

/* ---------------- VERIFY QR ---------------- */
app.post("/verify", (req, res) => {
  const { qrCode } = req.body;

  db.get("SELECT * FROM users WHERE qrCode = ?", [qrCode], (err, row) => {
    if (!row) return res.json({ status: "invalid" });

    if (row.checkedIn === 1)
      return res.json({ status: "already", name: row.name });

    db.run(
      "UPDATE users SET checkedIn = 1, checkInTime = datetime('now') WHERE qrCode = ?",
      [qrCode]
    );

    res.json({
      status: "success",
      name: row.name,
      rollNo: row.rollNo,
      department: row.department
    });
  });
});

/* ---------------- STATS ---------------- */
app.get("/stats", (req, res) => {
  db.get("SELECT COUNT(*) as total FROM users", [], (err, totalRow) => {
    db.get("SELECT COUNT(*) as checked FROM users WHERE checkedIn = 1", [], (err, checkRow) => {
      res.json({
        total: totalRow?.total || 0,
        checked: checkRow?.checked || 0
      });
    });
  });
});

/* ---------------- ATTENDANCE LIST ---------------- */
app.get("/attendance", (req, res) => {
  db.all("SELECT * FROM users WHERE checkedIn = 1 ORDER BY checkInTime DESC", [], (err, rows) => {
    res.json(rows || []);
  });
});

/* ---------------- EXPORT CSV ---------------- */
app.get("/export", (req, res) => {
  db.all("SELECT * FROM users WHERE checkedIn = 1", [], (err, rows) => {
    let csv = "Name,RollNo,Department,Year,Phone,CheckInTime\n";

    rows.forEach(r => {
      csv += `${r.name},${r.rollNo},${r.department},${r.year},${r.phone},${r.checkInTime}\n`;
    });

    res.header("Content-Type", "text/csv");
    res.attachment("NEXUS_CTF_Attendance.csv");
    res.send(csv);
  });
});

/* ---------------- HEALTH CHECK (For AWS) ---------------- */
app.get("/health", (req, res) => {
  res.json({ status: "Server Running" });
});

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 NEXUS CTF Server running on port ${PORT}`);
});

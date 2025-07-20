const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// Ensure uploads folder exists
const uploadDir = './uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Set up SQLite database
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    console.error('Database error:', err.message);
    return;
  }
  console.log('Connected to SQLite database.');
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    amount REAL,
    status TEXT,
    deduction REAL,
    documentation TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  )`);
});

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'your-secret-key', // Replace with a secure key in production
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.post('/api/register', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !['tenant', 'landlord', 'agent'].includes(role)) {
    return res.status(400).json({ message: 'Invalid input' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (email, password, role) VALUES (?, ?, ?)`, [email, hashedPassword, role], (err) => {
      if (err) return res.status(400).json({ message: 'Registration failed: Email already exists' });
      res.json({ message: 'Registration successful' });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during registration' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Invalid input' });
  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err || !user) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    req.session.user = { id: user.id, email: user.email, role: user.role };
    res.json({ message: 'Login successful' });
  });
});

app.post('/api/deposit/request', (req, res) => {
  const { amount } = req.body;
  const user = req.session.user;
  if (!user || user.role !== 'tenant') return res.status(403).json({ message: 'Unauthorized' });
  if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
  db.run(`INSERT INTO deposits (userId, amount, status) VALUES (?, ?, ?)`, [user.id, amount, 'pending'], (err) => {
    if (err) return res.status(400).json({ message: 'Request failed' });
    res.json({ message: 'Deposit refund requested' });
  });
});

app.post('/api/deposit/respond', upload.single('documentation'), (req, res) => {
  const { deduction } = req.body;
  const user = req.session.user;
  if (!user || (user.role !== 'landlord' && user.role !== 'agent')) return res.status(403).json({ message: 'Unauthorized' });
  const deductionValue = deduction ? parseFloat(deduction) : 0;
  if (deduction && isNaN(deductionValue)) return res.status(400).json({ message: 'Invalid deduction amount' });
  db.run(
    `UPDATE deposits SET status = ?, deduction = ?, documentation = ? WHERE status = ?`,
    ['responded', deductionValue, req.file ? req.file.path : null, 'pending'],
    (err) => {
      if (err) return res.status(400).json({ message: 'Response failed' });
      res.json({ message: 'Response submitted' });
    }
  );
});

app.post('/api/deposit/accept', (req, res) => {
  const user = req.session.user;
  if (!user || user.role !== 'tenant') return res.status(403).json({ message: 'Unauthorized' });
  db.run(`UPDATE deposits SET status = ? WHERE userId = ? AND status = ?`, ['accepted', user.id, 'responded'], (err) => {
    if (err) return res.status(400).json({ message: 'Accept failed' });
    res.json({ message: 'Deposit response accepted' });
  });
});

app.post('/api/deposit/dispute', (req, res) => {
  const user = req.session.user;
  if (!user || user.role !== 'tenant') return res.status(403).json({ message: 'Unauthorized' });
  db.run(`UPDATE deposits SET status = ? WHERE userId = ? AND status = ?`, ['disputed', user.id, 'responded'], (err) => {
    if (err) return res.status(400).json({ message: 'Dispute failed' });
    res.json({ message: 'Deposit response disputed' });
  });
});

app.get('/api/deposit/status', (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(403).json({ message: 'Unauthorized' });
  db.get(`SELECT * FROM deposits WHERE userId = ?`, [user.id], (err, deposit) => {
    if (err) return res.status(400).json({ message: 'Error fetching status' });
    res.json({ email: user.email, role: user.role, depositStatus: deposit });
  });
});

app.listen(port, () => console.log(`Server running on port ${port}`));
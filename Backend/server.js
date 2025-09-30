const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_prod';
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
// --- DB setup ---
const db = new sqlite3.Database('./db.sqlite');
db.serialize(() => {
db.run(`CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT,
email TEXT UNIQUE,
password TEXT,
role TEXT
)`);


db.run(`CREATE TABLE IF NOT EXISTS internships (
id INTEGER PRIMARY KEY AUTOINCREMENT,
title TEXT,
company TEXT,
location TEXT,
duration TEXT,
credits INTEGER,
description TEXT,
posted_by INTEGER
)`);


db.run(`CREATE TABLE IF NOT EXISTS applications (
id INTEGER PRIMARY KEY AUTOINCREMENT,
student_id INTEGER,
internship_id INTEGER,
status TEXT DEFAULT 'applied'
)`);


db.run(`CREATE TABLE IF NOT EXISTS logbooks (
id INTEGER PRIMARY KEY AUTOINCREMENT,
student_id INTEGER,
internship_id INTEGER,
entry_date TEXT,
content TEXT,
faculty_approved INTEGER DEFAULT 0
)`);
});
// --- Helpers ---
function generateToken(user) {
return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}


function authMiddleware(req, res, next) {
const auth = req.headers.authorization;
if (!auth) return res.status(401).json({ error: 'Missing token' });
const token = auth.split(' ')[1];
try {
const data = jwt.verify(token, JWT_SECRET);
req.user = data;
next();
} catch (e) {
res.status(401).json({ error: 'Invalid token' });
}
}
// --- Auth ---
app.post('/api/register', (req, res) => {
const { name, email, password, role } = req.body;
if (!email || !password || !role) return res.status(400).json({ error: 'Missing fields' });
const hashed = bcrypt.hashSync(password, 8);
const stmt = db.prepare('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)');
stmt.run(name||'', email, hashed, role, function(err) {
if (err) return res.status(400).json({ error: 'Email already in use' });
const user = { id: this.lastID, name, email, role };
const token = generateToken(user);
res.json({ user, token });
});
});
app.post('/api/login', (req, res) => {
const { email, password } = req.body;
db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
if (err || !row) return res.status(400).json({ error: 'Invalid credentials' });
if (!bcrypt.compareSync(password, row.password)) return res.status(400).json({ error: 'Invalid credentials' });
const user = { id: row.id, name: row.name, email: row.email, role: row.role };
const token = generateToken(user);
res.json({ user, token });
});
});
// --- Internships ---
app.get('/api/internships', (req, res) => {
db.all('SELECT * FROM internships ORDER BY id DESC', [], (err, rows) => {
res.json(rows);
});
});
app.post('/api/internships', authMiddleware, (req, res) => {
if (req.user.role !== 'industry' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
const { title, company, location, duration, credits, description } = req.body;
const stmt = db.prepare('INSERT INTO internships (title,company,location,duration,credits,description,posted_by) VALUES (?,?,?,?,?,?,?)');
stmt.run(title, company, location, duration, credits||0, description||'', req.user.id, function(err) {
if (err) return res.status(500).json({ error: 'DB error' });
db.get('SELECT * FROM internships WHERE id = ?', [this.lastID], (e,row) => res.json(row));
});
});
// --- Apply ---
app.post('/api/apply', authMiddleware, (req, res) => {
if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can apply' });
const { internship_id } = req.body;
const stmt = db.prepare('INSERT INTO applications (student_id,internship_id) VALUES (?,?)');
stmt.run(req.user.id, internship_id, function(err) {
if (err) return res.status(500).json({ error: 'DB error or already applied' });
db.get('SELECT * FROM applications WHERE id = ?', [this.lastID], (e,row)=> res.json(row));
});
});
app.get('/api/my-applications', authMiddleware, (req, res) => {
if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students' });
db.all('SELECT a.*, i.title, i.company FROM applications a JOIN internships i ON a.internship_id = i.id WHERE a.student_id = ?', [req.user.id], (err,rows)=> res.json(rows));
});
// --- Logbook ---
app.post('/api/logbook', authMiddleware, (req, res) => {
if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students' });
const { internship_id, entry_date, content } = req.body;
const stmt = db.prepare('INSERT INTO logbooks (student_id,internship_id,entry_date,content) VALUES (?,?,?,?)');
stmt.run(req.user.id, internship_id, entry_date||new Date().toISOString(), content||'', function(err) {
if (err) return res.status(500).json({ error: 'DB error' });
db.get('SELECT * FROM logbooks WHERE id = ?', [this.lastID], (e,row)=> res.json(row));
});
});
app.get('/api/logbooks/:internshipId', authMiddleware, (req,res) => {
const internshipId = req.params.internshipId;
if (req.user.role === 'student') {
db.all('SELECT * FROM logbooks WHERE student_id = ? AND internship_id = ?', [req.user.id, internshipId], (err,rows)=> res.json(rows));
} else if (req.user.role === 'faculty' || req.user.role === 'admin') {
db.all('SELECT l.*, u.name as student_name FROM logbooks l JOIN users u ON l.student_id = u.id WHERE l.internship_id = ?', [internshipId], (err,rows)=> res.json(rows));
} else {
res.status(403).json({ error: 'Forbidden' });
}
});
// Faculty approve logbook
app.post('/api/logbooks/:id/approve', authMiddleware, (req,res)=>{
if (req.user.role !== 'faculty' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
const id = req.params.id;
db.run('UPDATE logbooks SET faculty_approved = 1 WHERE id = ?', [id], function(err) {
if (err) return res.status(500).json({ error: 'DB' });
res.json({ ok: true });
});
});
// --- Simple admin endpoint to list users (for demo) ---
app.get('/api/users', authMiddleware, (req,res)=>{
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
db.all('SELECT id,name,email,role FROM users', [], (err,rows)=> res.json(rows));
});
// Fallback to index.html
app.get('*', (req,res)=>{
res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.listen(PORT, ()=> console.log(`Server started on port ${PORT}`));
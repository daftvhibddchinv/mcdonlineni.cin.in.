
// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { customAlphabet } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;

// Static
app.use(express.static('public'));

// Ensure uploads dir
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Simple JSON "DB"
const dbPath = path.join(__dirname, 'data.json');
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({ files: {} }, null, 2));
function readDB() { return JSON.parse(fs.readFileSync(dbPath, 'utf-8')); }
function writeDB(data) { fs.writeFileSync(dbPath, JSON.stringify(data, null, 2)); }

// File storage (original filename kept; you can randomize if preferred)
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ts = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '-').toLowerCase();
    cb(null, `${base}-${ts}${ext}`);
  }
});
const upload = multer({ storage });

// Short ID generator
const nanoid = customAlphabet('123456789abcdefghijkmnopqrstuvwxyz', 6);

// Upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file' });

  const id = nanoid();
  const db = readDB();
  db.files[id] = {
    id,
    filename: req.file.filename,
    path: req.file.path,
    uploadedAt: new Date().toISOString(),
    hits: 0,
    type: req.file.mimetype
  };
  writeDB(db);

  // Public redirect URL (this is what QR में जाएगा)
  const publicUrl = `${req.protocol}://${req.get('host')}/f/${id}`;
  res.json({ ok: true, id, url: publicUrl });
});

// File redirect (counts analytics)
app.get('/f/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const item = db.files[id];
  if (!item) return res.status(404).send('Not found');

  // Increment hits
  item.hits = (item.hits || 0) + 1;
  writeDB(db);

  // Direct download/serve
  res.sendFile(path.resolve(item.path));
});

// Simple analytics JSON
app.get('/api/stats/:id', (req, res) => {
  const db = readDB();
  const item = db.files[req.params.id];
  if (!item) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, id: item.id, hits: item.hits, uploadedAt: item.uploadedAt, filename: item.filename, type: item.type });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

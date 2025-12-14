const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const cors = require('cors');

// 1. Cấu hình & Khởi tạo
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// CORS: SỬA - Origin exact match, KHÔNG / cuối
app.use(cors({
  origin: [
    'http://localhost:5173',  // Local dev
    'http://localhost:3000',  // CRA nếu cần
    'https://fe-post-mnm.vercel.app'  // Vercel - KHÔNG / CUỐI!
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Preflight cho tất cả routes (nếu cần)
app.options('*', cors());

app.use(express.json());

// 2. DB Connection (giữ nguyên)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'blog_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: { rejectUnauthorized: false }
});

const db = pool.promise();

db.query('SELECT 1 + 1 AS result')
  .then(() => console.log('✅ DB OK'))
  .catch((err) => console.error('❌ DB Error:', err.message));

// 3. Routes (giữ nguyên, nhưng thêm log để debug)
app.get('/api/posts', async (req, res) => {
  console.log('GET /api/posts from origin:', req.headers.origin);  // Log để check Render
  try {
    const [rows] = await db.query('SELECT * FROM Post ORDER BY createdAt DESC');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Lỗi GET posts:', error);
    res.status(500).json({ message: 'Lỗi server.' });
  }
});

// Các route khác giữ nguyên như trước (POST, PUT, DELETE, GET/:id)
app.post('/api/posts', async (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ message: 'Tiêu đề bắt buộc.' });
  try {
    const query = 'INSERT INTO Post (title, description) VALUES (?, ?)';
    const [result] = await db.query(query, [title, description]);
    res.status(201).json({
      idPost: result.insertId,
      title, description,
      message: 'Tạo OK.'
    });
  } catch (error) {
    console.error('Lỗi POST:', error);
    res.status(500).json({ message: 'Lỗi tạo.' });
  }
});

app.put('/api/posts/:id', async (req, res) => {
  const idPost = req.params.id;
  const { title, description } = req.body;
  if (!title && !description) return res.status(400).json({ message: 'Cập nhật ít nhất 1 trường.' });
  try {
    const query = 'UPDATE Post SET title = COALESCE(?, title), description = COALESCE(?, description) WHERE idPost = ?';  // SỬA: Giữ giá trị cũ nếu null
    const [result] = await db.query(query, [title, description, idPost]);
    if (result.affectedRows === 0) return res.status(404).json({ message: `Không tìm thấy ID: ${idPost}` });
    res.status(200).json({ message: 'Cập nhật OK.', idPost });
  } catch (error) {
    console.error(`Lỗi PUT ${idPost}:`, error);
    res.status(500).json({ message: 'Lỗi cập nhật.' });
  }
});

app.delete('/api/posts/:id', async (req, res) => {
  const idPost = req.params.id;
  try {
    const [result] = await db.query('DELETE FROM Post WHERE idPost = ?', [idPost]);
    if (result.affectedRows === 0) return res.status(404).json({ message: `Không tìm thấy ID: ${idPost}` });
    res.status(200).json({ message: 'Xóa OK.', idPost });
  } catch (error) {
    console.error(`Lỗi DELETE ${idPost}:`, error);
    res.status(500).json({ message: 'Lỗi xóa.' });
  }
});

app.get('/api/posts/:id', async (req, res) => {
  const idPost = req.params.id;
  try {
    const [rows] = await db.query('SELECT * FROM Post WHERE idPost = ?', [idPost]);
    if (rows.length === 0) return res.status(404).json({ message: `Không tìm thấy ID: ${idPost}` });
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error(`Lỗi GET ID ${idPost}:`, error);
    res.status(500).json({ message: 'Lỗi server.' });
  }
});

// 4. Start
app.listen(port, () => {
  console.log(`🚀 Server port ${port}`);
  console.log('API ready');
});
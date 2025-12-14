const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const cors = require('cors'); // Thêm CORS middleware

// 1. Cấu hình Biến Môi trường và Khởi tạo Server
dotenv.config();

const app = express();
const port = process.env.PORT || 3000; // Render tự set PORT

// Middleware CORS - SỬA: Origin exact match, không slash cuối
app.use(cors({
  origin: [
    'https://fe-post-mnm.vercel.app'  // Production Vercel (exact)
    // Thêm local nếu test: 'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Xử lý preflight OPTIONS cho tất cả routes
app.options('*', cors());

// Middleware JSON
app.use(express.json());

// --- 2. Thiết lập Kết nối Database ---
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'blog_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false  // Giữ false cho dev; true cho prod nếu có CA cert
  }
});

const db = pool.promise();

// Kiểm tra DB ngay khi start (nhưng không exit nếu fail, để debug)
db.query('SELECT 1 + 1 AS result')
  .then(() => console.log('✅ Kết nối DB OK'))
  .catch((err) => {
    console.error('❌ Lỗi DB:', err.message);
    // Không exit, để server chạy và log lỗi
  });

// --- 3. Routes CRUD (giữ nguyên) ---
app.get('/api/posts', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Post ORDER BY createdAt DESC');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Lỗi GET posts:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy dữ liệu.' });
  }
});

app.get('/api/posts/:id', async (req, res) => {
  const idPost = req.params.id;
  try {
    const [rows] = await db.query('SELECT * FROM Post WHERE idPost = ?', [idPost]);
    if (rows.length === 0) {
      return res.status(404).json({ message: `Không tìm thấy ID: ${idPost}` });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error(`Lỗi GET ID ${idPost}:`, error);
    res.status(500).json({ message: 'Lỗi server.' });
  }
});

app.post('/api/posts', async (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ message: 'Tiêu đề bắt buộc.' });
  try {
    const query = 'INSERT INTO Post (title, description) VALUES (?, ?)';
    const [result] = await db.query(query, [title, description]);
    res.status(201).json({
      idPost: result.insertId,
      title,
      description,
      message: 'Tạo thành công.'
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
    const query = 'UPDATE Post SET title = ?, description = ? WHERE idPost = ?';
    const [result] = await db.query(query, [title || null, description || null, idPost]);  // SỬA: Cho phép null nếu không thay đổi
    if (result.affectedRows === 0) return res.status(404).json({ message: `Không tìm thấy ID: ${idPost}` });
    res.status(200).json({ message: 'Cập nhật thành công.', idPost });
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
    res.status(200).json({ message: 'Xóa thành công.', idPost });
  } catch (error) {
    console.error(`Lỗi DELETE ${idPost}:`, error);
    res.status(500).json({ message: 'Lỗi xóa.' });
  }
});

// --- 4. Start Server ---
app.listen(port, () => {
  console.log(`🚀 Server chạy trên port ${port}`);
  console.log('API ready: /api/posts');
});
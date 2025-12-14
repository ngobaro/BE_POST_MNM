const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const cors = require('cors'); // Thêm CORS middleware

// 1. Cấu hình Biến Môi trường và Khởi tạo Server
// Load biến môi trường từ file .env (Giả định bạn đã đặt thông tin kết nối vào .env)
dotenv.config();

const app = express();
const port = process.env.PORT || 3000; // Sử dụng PORT từ env cho Render.com (mặc định 3000 cho local)

// Middleware để phân tích body của request (JSON)
// THÊM CORS NGAY SAU ĐÂY - Cho phép frontend localhost gọi API
app.use(cors({
  origin: [
    'http://localhost:5173',  // Vite dev server (thay port nếu khác)
    'http://localhost:3000'   // Nếu dùng Create React App
    // Thêm domain production khi deploy: 'https://your-frontend-domain.com'
  ],
  credentials: true,  // Nếu dùng cookie/auth (tùy chọn)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // Các HTTP method cần
  allowedHeaders: ['Content-Type', 'Authorization']  // Headers cho phép
}));

app.use(express.json());

// --- 2. Thiết lập Kết nối Database ---

// **Thay thế các biến môi trường nếu cần thiết**
// Mặc dù tôi sử dụng process.env, tôi sẽ giả định file .env của bạn có:
// DB_HOST=gateway01.ap-southeast-1.prod.aws.tidbcloud.com
// DB_USER=4MsHzrv9f3Dszjt.root
// DB_PASSWORD=IReVbX9V8IclS2Wl
// DB_NAME=blog_db
// DB_PORT=4000

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
    // TiDB Cloud yêu cầu kết nối SSL.
    // Nếu bạn có file chứng chỉ, bạn nên chỉ định ở đây.
    // Nếu không, có thể sử dụng 'rejectUnauthorized: false' trong môi trường phát triển (không khuyến khích cho production).
    rejectUnauthorized: false
  }
});

const db = pool.promise(); // Chuyển sang Promise-based để dùng async/await

// Kiểm tra kết nối Database khi khởi động server
db.query('SELECT 1 + 1 AS result')
  .then(() => {
    console.log('✅ Đã kết nối thành công đến TiDB Cloud (MySQL)');
  })
  .catch((err) => {
    console.error('❌ Lỗi kết nối Database:', err.message);
    process.exit(1);
  });

// --- 3. Các Endpoint (Routes) CRUD cho Bảng Post ---

// 3.1. READ (Lấy tất cả bài viết) - GET /api/posts
app.get('/api/posts', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Post ORDER BY createdAt DESC');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bài viết:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy dữ liệu.' });
  }
});

// 3.2. READ (Lấy bài viết theo ID) - GET /api/posts/:id
app.get('/api/posts/:id', async (req, res) => {
  const idPost = req.params.id;
  try {
    const [rows] = await db.query('SELECT * FROM Post WHERE idPost = ?', [idPost]);

    if (rows.length === 0) {
      return res.status(404).json({ message: `Không tìm thấy bài viết với ID: ${idPost}` });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error(`Lỗi khi lấy bài viết ID ${idPost}:`, error);
    res.status(500).json({ message: 'Lỗi server khi lấy dữ liệu.' });
  }
});

// 3.3. CREATE (Tạo bài viết mới) - POST /api/posts
app.post('/api/posts', async (req, res) => {
  const { title, description } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Tiêu đề (title) là bắt buộc.' });
  }

  try {
    const query = 'INSERT INTO Post (title, description) VALUES (?, ?)';
    const [result] = await db.query(query, [title, description]);

    // Trả về đối tượng vừa tạo (bao gồm idPost vừa được tạo)
    res.status(201).json({
      idPost: result.insertId,
      title,
      description,
      message: 'Tạo bài viết thành công.'
    });
  } catch (error) {
    console.error('Lỗi khi tạo bài viết:', error);
    res.status(500).json({ message: 'Lỗi server khi tạo dữ liệu.' });
  }
});

// 3.4. UPDATE (Cập nhật bài viết) - PUT /api/posts/:id
app.put('/api/posts/:id', async (req, res) => {
  const idPost = req.params.id;
  const { title, description } = req.body;

  if (!title && !description) {
    return res.status(400).json({ message: 'Cần cung cấp ít nhất tiêu đề hoặc mô tả để cập nhật.' });
  }

  try {
    const query = 'UPDATE Post SET title = ?, description = ? WHERE idPost = ?';
    const [result] = await db.query(query, [title, description, idPost]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: `Không tìm thấy bài viết với ID: ${idPost} để cập nhật.` });
    }

    res.status(200).json({ message: 'Cập nhật bài viết thành công.', idPost });
  } catch (error) {
    console.error(`Lỗi khi cập nhật bài viết ID ${idPost}:`, error);
    res.status(500).json({ message: 'Lỗi server khi cập nhật dữ liệu.' });
  }
});

// 3.5. DELETE (Xóa bài viết) - DELETE /api/posts/:id
app.delete('/api/posts/:id', async (req, res) => {
  const idPost = req.params.id;

  try {
    const [result] = await db.query('DELETE FROM Post WHERE idPost = ?', [idPost]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: `Không tìm thấy bài viết với ID: ${idPost} để xóa.` });
    }

    res.status(200).json({ message: 'Xóa bài viết thành công.', idPost });
  } catch (error) {
    console.error(`Lỗi khi xóa bài viết ID ${idPost}:`, error);
    res.status(500).json({ message: 'Lỗi server khi xóa dữ liệu.' });
  }
});

// --- 4. Khởi động Server ---
app.listen(port, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${port}`);
  console.log('Các API endpoints đã sẵn sàng: /api/posts');
});
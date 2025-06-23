const express = require('express');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Cria pasta uploads se não existir
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Upload de imagem
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Conexão com MySQL
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'baladas'
});

// Criação das tabelas
db.query(`
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    name VARCHAR(255),
    cpf VARCHAR(14) UNIQUE,
    login_attempts INT DEFAULT 0,
    last_login_attempt BIGINT DEFAULT 0
)`, console.error);

db.query(`
CREATE TABLE IF NOT EXISTS escalas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data TEXT,
    status TEXT,
    foto_path TEXT,
    user_id INT,
    FOREIGN KEY (user_id) REFERENCES users(id)
)`, console.error);

// Rate Limit
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    handler: (req, res) => {
        const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
        res.status(429).json({ error: 'Muitas tentativas de login.', retryAfter });
    }
});

// Rotas

app.get('/escalas', (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id é obrigatório' });

    db.query('SELECT * FROM escalas WHERE user_id = ?', [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/escalas', (req, res) => {
    const { data, status, user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id é obrigatório' });

    db.query(
        `INSERT INTO escalas (data, status, user_id) VALUES (?, ?, ?)`,
        [data, status, user_id],
        (err, results) => {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ id: results.insertId });
        }
    );
});

app.put('/escalas/:id', (req, res) => {
    const { status, user_id } = req.body;
    const { id } = req.params;
    if (!user_id) return res.status(400).json({ error: 'user_id é obrigatório' });

    db.query(
        `UPDATE escalas SET status = ? WHERE id = ? AND user_id = ?`,
        [status, id, user_id],
        (err, results) => {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ changes: results.affectedRows });
        }
    );
});

app.post('/escalas/:id/foto', upload.single('foto'), (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body;
    const foto_path = req.file.path;
    if (!user_id) return res.status(400).json({ error: 'user_id é obrigatório' });

    db.query(
        `UPDATE escalas SET foto_path = ? WHERE id = ? AND user_id = ?`,
        [foto_path, id, user_id],
        (err, results) => {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ changes: results.affectedRows });
        }
    );
});

app.delete('/escalas/:id', (req, res) => {
    const { id } = req.params;
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id é obrigatório' });

    db.query(
        `DELETE FROM escalas WHERE id = ? AND user_id = ?`,
        [id, user_id],
        (err, results) => {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ changes: results.affectedRows });
        }
    );
});

app.post('/register', (req, res) => {
    const { email, password, name, cpf } = req.body;
    if (!email || !password || !name || !cpf) {
        return res.status(400).json({ error: 'Email, senha, nome e CPF são obrigatórios' });
    }

    const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
    if (!cpfRegex.test(cpf)) {
        return res.status(400).json({ error: 'CPF inválido. Use o formato 000.000.000-00' });
    }

    db.query(
        `INSERT INTO users (email, password, name, cpf) VALUES (?, ?, ?, ?)`,
        [email, password, name, cpf],
        (err, results) => {
            if (err) return res.status(400).json({ error: 'Email ou CPF já existe ou erro no cadastro' });
            res.json({ id: results.insertId, message: 'Usuário registrado com sucesso' });
        }
    );
});

app.post('/login', loginLimiter, (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) return res.status(500).json({ error: 'Erro interno no servidor' });
        const user = results[0];
        if (!user) return res.status(400).json({ error: 'Email ou senha incorretos' });

        const now = Date.now();
        const attempts = user.login_attempts || 0;
        const lastAttempt = user.last_login_attempt || 0;
        const lockoutTime = 15 * 60 * 1000;

        if (attempts >= 5 && (now - lastAttempt) < lockoutTime) {
            const retryAfter = Math.ceil((lockoutTime - (now - lastAttempt)) / 1000);
            return res.status(429).json({ error: 'Muitas tentativas de login.', retryAfter });
        }

        if (user.password === password) {
            db.query('UPDATE users SET login_attempts = 0, last_login_attempt = ? WHERE id = ?', [now, user.id]);
            res.json({ user: { id: user.id, email: user.email, name: user.name, cpf: user.cpf } });
        } else {
            const newAttempts = attempts + 1;
            db.query('UPDATE users SET login_attempts = ?, last_login_attempt = ? WHERE id = ?', [newAttempts, now, user.id]);
            res.status(400).json({ error: 'Email ou senha incorretos' });
        }
    });
});

app.get('/user/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT id, email, name, cpf FROM users WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json(results[0]);
    });
});

// Iniciar servidor
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

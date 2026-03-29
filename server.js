const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const db = require('./db'); // 🔗 SQLite

const app = express();
app.use(express.json());
app.use(cors());

// =========================
// 📁 PASTA UPLOADS
// =========================
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

app.use('/uploads', express.static('uploads'));

// =========================
// 📁 FRONTEND
// =========================
app.use(express.static(path.join(__dirname, 'public')));

// =========================
// 🔐 SECRET
// =========================
const SECRET = 'SEU_SEGREDO_SUPER_FORTE';

// =========================
// 🧱 CRIAR TABELAS SQLITE
// =========================
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            cpf TEXT UNIQUE NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS escalas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            status TEXT,
            foto TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
});

// =========================
// 📸 MULTER
// =========================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) =>
        cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ storage });

// =========================
// 🔐 MIDDLEWARE AUTH
// =========================
function auth(req, res, next) {
    const header = req.headers.authorization;

    if (!header) {
        return res.status(401).json({ error: 'Token ausente' });
    }

    const token = header.split(' ')[1];

    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ error: 'Token inválido' });
    }
}

// =========================
// 🏠 HOME
// =========================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// =========================
// 🔐 AUTH
// =========================

// REGISTER
app.post('/auth/register', async (req, res) => {
    const { name, email, password, cpf } = req.body;

    if (!name || !email || !password || !cpf) {
        return res.status(400).json({ error: 'Campos obrigatórios' });
    }

    try {
        const hashed = await bcrypt.hash(password, 10);

        db.run(
            `INSERT INTO users (name, email, password, cpf) VALUES (?, ?, ?, ?)`,
            [name, email, hashed, cpf],
            function (err) {
                if (err) {
                    return res.status(400).json({ error: 'Email ou CPF já existe' });
                }

                res.json({ id: this.lastID });
            }
        );
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// LOGIN
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    db.get(
        `SELECT * FROM users WHERE email = ?`,
        [email],
        async (err, user) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (!user) {
                return res.status(400).json({ error: 'Usuário não encontrado' });
            }

            const valid = await bcrypt.compare(password, user.password);

            if (!valid) {
                return res.status(400).json({ error: 'Senha inválida' });
            }

            const token = jwt.sign({ id: user.id }, SECRET, {
                expiresIn: '7d'
            });

            res.json({ token });
        }
    );
});

// USER LOGADO
app.get('/auth/user', auth, (req, res) => {
    db.get(
        `SELECT * FROM users WHERE id = ?`,
        [req.user.id],
        (err, user) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }

            res.json(user);
        }
    );
});

// =========================
// 📊 ESCALAS
// =========================

// LISTAR
app.get('/escalas', auth, (req, res) => {
    db.all(
        `SELECT * FROM escalas WHERE user_id = ?`,
        [req.user.id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// CRIAR
app.post('/escalas', auth, (req, res) => {
    const { status, data } = req.body;

    db.run(
        `INSERT INTO escalas (user_id, status, data) VALUES (?, ?, ?)`,
        [req.user.id, status, data],
        function (err) {
            if (err) return res.status(400).json({ error: err.message });

            res.json({
                id: this.lastID,
                user_id: req.user.id,
                status,
                data
            });
        }
    );
});

// Atualiza status de uma escala
app.put('/escalas/:id', auth, (req, res) => { // 🔑 adiciona auth
    const { id } = req.params;
    const { status } = req.body;

    const sql = `UPDATE escalas SET status = ? WHERE id = ? AND user_id = ?`;
    db.run(sql, [status, id, req.user.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Escala não encontrada' });
        }

        res.json({ id, status });
    });
});

// Deletar escala
app.delete('/escalas/:id', auth, (req, res) => { // 🔑 adiciona auth
    const { id } = req.params;

    const sql = `DELETE FROM escalas WHERE id = ? AND user_id = ?`;
    db.run(sql, [id, req.user.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Escala não encontrada' });
        }

        res.json({ message: 'Escala deletada', id });
    });
});

// UPLOAD FOTO
app.post('/escalas/:id/foto', auth, upload.single('foto'), (req, res) => {
    const { id } = req.params;

    db.run(
        `UPDATE escalas SET foto = ? WHERE id = ? AND user_id = ?`,
        [`/uploads/${req.file.filename}`, id, req.user.id],
        function (err) {
            if (err) return res.status(400).json({ error: err.message });

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Escala não encontrada' });
            }

            res.json({
                message: 'Foto enviada',
                foto: `/uploads/${req.file.filename}`
            });
        }
    );
});

// =========================
// 🚀 START
// =========================
app.listen(3000, () => {
    console.log('🔥 http://localhost:3000');
});
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const db = require('./db'); // 🐘 PostgreSQL

const app = express();
app.use(express.json());
app.use(cors());

// =========================
// 📁 UPLOADS
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
// 🧱 CRIAR TABELAS
// =========================
(async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                cpf TEXT UNIQUE NOT NULL
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS escalas (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                status TEXT,
                data TEXT,
                foto TEXT
            )
        `);

        console.log('📦 Tabelas criadas/verificadas');
    } catch (err) {
        console.error('Erro ao criar tabelas:', err);
    }
})();

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
// 🔐 AUTH
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
// 🔐 REGISTER
// =========================
app.post('/auth/register', async (req, res) => {
    const { name, email, password, cpf } = req.body;

    if (!name || !email || !password || !cpf) {
        return res.status(400).json({ error: 'Campos obrigatórios' });
    }

    try {
        const hashed = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO users (name, email, password, cpf)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [name, email, hashed, cpf]
        );

        res.json({ id: result.rows[0].id });

    } catch (err) {
        res.status(400).json({ error: 'Email ou CPF já existe' });
    }
});

// =========================
// 🔐 LOGIN
// =========================
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await db.query(
            `SELECT * FROM users WHERE email = $1`,
            [email]
        );

        const user = result.rows[0];

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

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =========================
// 👤 USER LOGADO
// =========================
app.get('/auth/user', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM users WHERE id = $1`,
            [req.user.id]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json(user);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =========================
// 📊 ESCALAS
// =========================

// LISTAR
app.get('/escalas', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM escalas WHERE user_id = $1`,
            [req.user.id]
        );

        res.json(result.rows);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CRIAR
app.post('/escalas', auth, async (req, res) => {
    const { status, data } = req.body;

    try {
        const result = await db.query(
            `INSERT INTO escalas (user_id, status, data)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [req.user.id, status, data]
        );

        res.json({
            id: result.rows[0].id,
            user_id: req.user.id,
            status,
            data
        });

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// UPDATE
app.put('/escalas/:id', auth, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const result = await db.query(
            `UPDATE escalas
             SET status = $1
             WHERE id = $2 AND user_id = $3`,
            [status, id, req.user.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Escala não encontrada' });
        }

        res.json({ id, status });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE
app.delete('/escalas/:id', auth, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.query(
            `DELETE FROM escalas WHERE id = $1 AND user_id = $2`,
            [id, req.user.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Escala não encontrada' });
        }

        res.json({ message: 'Escala deletada', id });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPLOAD FOTO
app.post('/escalas/:id/foto', auth, upload.single('foto'), async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.query(
            `UPDATE escalas
             SET foto = $1
             WHERE id = $2 AND user_id = $3`,
            [`/uploads/${req.file.filename}`, id, req.user.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Escala não encontrada' });
        }

        res.json({
            message: 'Foto enviada',
            foto: `/uploads/${req.file.filename}`
        });

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// =========================
// 🚀 START
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🔥 Rodando na porta ${PORT}`);
});
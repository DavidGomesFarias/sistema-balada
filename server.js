const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// =============================
// CRIAR PASTA UPLOADS
// =============================
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// =============================
// CONFIG MULTER
// =============================
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) =>
        cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// =============================
// CONEXÃO POSTGRESQL
// =============================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// =============================
// CRIAR TABELAS AUTOMATICAMENTE
// =============================
async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            cpf TEXT UNIQUE NOT NULL,
            login_attempts INTEGER DEFAULT 0,
            last_login_attempt BIGINT DEFAULT 0
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS escalas (
            id SERIAL PRIMARY KEY,
            data TEXT,
            status TEXT,
            foto_path TEXT,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
        );
    `);

    console.log("Banco inicializado com sucesso");
}

initDB();

// =============================
// RATE LIMIT
// =============================
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
});

// =============================
// ROTAS
// =============================

// LISTAR ESCALAS
app.get('/escalas', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id é obrigatório' });

    try {
        const result = await pool.query(
            'SELECT * FROM escalas WHERE user_id = $1',
            [user_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CRIAR ESCALA
app.post('/escalas', async (req, res) => {
    const { data, status, user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id é obrigatório' });

    try {
        const result = await pool.query(
            'INSERT INTO escalas (data, status, user_id) VALUES ($1, $2, $3) RETURNING id',
            [data, status, user_id]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ATUALIZAR STATUS
app.put('/escalas/:id', async (req, res) => {
    const { status, user_id } = req.body;
    const { id } = req.params;

    try {
        const result = await pool.query(
            'UPDATE escalas SET status = $1 WHERE id = $2 AND user_id = $3',
            [status, id, user_id]
        );
        res.json({ changes: result.rowCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// UPLOAD FOTO
app.post('/escalas/:id/foto', upload.single('foto'), async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body;
    const foto_path = req.file.path;

    try {
        const result = await pool.query(
            'UPDATE escalas SET foto_path = $1 WHERE id = $2 AND user_id = $3',
            [foto_path, id, user_id]
        );
        res.json({ changes: result.rowCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETAR ESCALA
app.delete('/escalas/:id', async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.query;

    try {
        const result = await pool.query(
            'DELETE FROM escalas WHERE id = $1 AND user_id = $2',
            [id, user_id]
        );
        res.json({ changes: result.rowCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// REGISTER
app.post('/register', async (req, res) => {
    const { email, password, name, cpf } = req.body;

    if (!email || !password || !name || !cpf) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO users (email, password, name, cpf) VALUES ($1, $2, $3, $4) RETURNING id',
            [email, password, name, cpf]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) {
        res.status(400).json({ error: 'Email ou CPF já existe' });
    }
});

// LOGIN
app.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0)
            return res.status(400).json({ error: 'Email ou senha incorretos' });

        const user = result.rows[0];

        if (user.password !== password)
            return res.status(400).json({ error: 'Email ou senha incorretos' });

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                cpf: user.cpf
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// USER
app.get('/user/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            'SELECT id, email, name, cpf FROM users WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Usuário não encontrado' });

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

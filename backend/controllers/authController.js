const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SECRET = 'SEU_SECRET_SUPER_FORTE';

exports.register = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const hash = await bcrypt.hash(password, 10);

        db.run(
            `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`,
            [name, email, hash],
            function (err) {
                if (err) {
                    return res.status(400).json({ error: 'Email já existe' });
                }

                res.json({ message: 'Usuário criado' });
            }
        );
    } catch (err) {
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.login = (req, res) => {
    const { email, password } = req.body;

    db.get(
        `SELECT * FROM users WHERE email = ?`,
        [email],
        async (err, user) => {
            if (!user) {
                return res.status(401).json({ error: 'Usuário inválido' });
            }

            const valid = await bcrypt.compare(password, user.password);

            if (!valid) {
                return res.status(401).json({ error: 'Senha inválida' });
            }

            const token = jwt.sign(
                { id: user.id },
                SECRET,
                { expiresIn: '7d' }
            );

            res.json({ token });
        }
    );
};
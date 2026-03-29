const jwt = require('jsonwebtoken');

const SECRET = 'SEU_SECRET_SUPER_FORTE';

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Token não enviado' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded; // 🔥 ESSENCIAL
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};
const db = require('../db');

exports.getEscalas = (req, res) => {
    const userId = req.user.id;

    db.all(
        `SELECT * FROM escalas WHERE user_id = ?`,
        [userId],
        (err, rows) => {
            res.json(rows);
        }
    );
};

exports.createEscala = (req, res) => {
    const userId = req.user.id;
    const { data, status, imagem } = req.body;

    db.run(
        `INSERT INTO escalas (user_id, data, status, imagem)
         VALUES (?, ?, ?, ?)`,
        [userId, data, status, imagem],
        function (err) {
            res.json({ id: this.lastID });
        }
    );
};

exports.deleteEscala = (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    db.run(
        `DELETE FROM escalas WHERE id = ? AND user_id = ?`,
        [id, userId],
        function () {
            res.json({ deleted: true });
        }
    );
};
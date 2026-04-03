const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(
    path.resolve(__dirname, 'database.sqlite'),
    (err) => {
        if (err) {
            console.error('Erro ao conectar:', err);
        } else {
            console.log('Banco conectado');
        }
    }
);

// 🔥 boas práticas
db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA journal_mode = WAL');

module.exports = db;
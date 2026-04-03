const { Pool } = require('pg');

// 🔗 conexão com PostgreSQL (Render usa DATABASE_URL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // obrigatório no Render
    }
});

// teste de conexão (opcional, mas útil)
pool.connect()
    .then(client => {
        console.log('🐘 PostgreSQL conectado');
        client.release();
    })
    .catch(err => {
        console.error('Erro ao conectar no PostgreSQL:', err);
    });

module.exports = pool;
// server/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// test połączenia
pool.getConnection()
  .then(conn => {
    console.log('✔️ Połączono z bazą danych');
    conn.release();
  })
  .catch(err => {
    console.error('❌ AAAAAABłąd połączenia z bazą:', err.message);
    //process.exit(1);
  });

export default pool;

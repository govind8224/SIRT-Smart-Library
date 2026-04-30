const mysql = require("mysql2");

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "r908TlL0fK5yNpYL",
  database: process.env.DB_NAME || "LibraryDB",
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.getConnection((err, connection) => {
  if (err) {
    console.log("❌ DB Error:", err);
  } else {
    console.log("✅ DB Connected");
    connection.release();
  }
});

module.exports = db;

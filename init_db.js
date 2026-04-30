require("dotenv").config();
const mysql = require("mysql2");

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "r908TlL0fK5yNpYL",
  database: "test", // using 'test' instead of 'LibraryDB' because TiDB free tier only gives test by default, or we can just use sys
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const queries = [
  `CREATE TABLE IF NOT EXISTS books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_name VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    isbn VARCHAR(100) UNIQUE,
    rfid VARCHAR(100) UNIQUE,
    slot VARCHAR(100)
  )`,
  `CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    username VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    course VARCHAR(100),
    rfid VARCHAR(100) UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS faculty (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    username VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    department VARCHAR(100),
    rfid VARCHAR(100) UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS issued_books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_rfid VARCHAR(100) NOT NULL,
    book_id INT NOT NULL,
    issue_date DATETIME NOT NULL,
    return_date DATETIME,
    FOREIGN KEY (book_id) REFERENCES books(id)
  )`
];

async function initDB() {
  const promiseDb = db.promise();
  try {
    console.log("Connecting to TiDB to create tables...");
    for (let q of queries) {
      await promiseDb.query(q);
      console.log("Executed successfully:", q.split('(')[0]);
    }
    
    // Create an admin user for testing if needed
    const checkAdmin = await promiseDb.query("SELECT * FROM faculty WHERE username = 'admin'");
    if (checkAdmin[0].length === 0) {
        await promiseDb.query("INSERT INTO faculty (name, email, username, password, department, rfid) VALUES ('Admin', 'admin@library.com', 'admin', 'admin123', 'Library', 'ADMIN_RFID_001')");
        console.log("Created default admin user (username: admin, password: admin123)");
    }
    
    console.log("Database initialized completely!");
    process.exit(0);
  } catch (error) {
    console.error("Error initializing DB:", error);
    process.exit(1);
  }
}

initDB();

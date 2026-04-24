const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express(); // ✅ router हटाकर app use करो

// middleware
app.use(cors());
app.use(express.json());

// MySQL Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Mysql12#1",
    database: "LibraryDB"
});

db.connect((err) => {
    if (err) {
        console.log("Database connection failed ❌", err);
    } else {
        console.log("Connected to MySQL (Books) ✅");
    }
});


// =============================
// 📚 GET ALL BOOKS
// =============================
app.get("/books", (req, res) => {
    const sql = "SELECT * FROM books";

    db.query(sql, (err, result) => {
        if (err) {
            return res.status(500).json(err);
        }
        res.json(result);
    });
});


// =============================
// 📚 ADD BOOK
// =============================
app.post("/books", (req, res) => {
    const { book_name, author, isbn } = req.body;

    if (!book_name || !author || !isbn) {
        return res.status(400).json({ message: "All fields required" });
    }

    const sql = "INSERT INTO books (book_name, author, isbn) VALUES (?, ?, ?)";

    db.query(sql, [book_name, author, isbn], (err, result) => {
        if (err) {
            return res.status(500).json(err);
        }

        res.json({
            message: "Book added successfully ✅",
            id: result.insertId
        });
    });
});


// =============================
// 🚀 START SERVER
// =============================
app.listen(3000, () => {
    console.log("🚀 Server running on http://localhost:3000");
});
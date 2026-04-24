const express = require("express");
const router = express.Router();
const db = require("../db");

// GET BOOKS
router.get("/Add Book", (req, res) => {
    db.query("SELECT * FROM books", (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

// ADD BOOK
router.post("/", (req, res) => {
    const { book_name, author, isbn } = req.body;

    if (!book_name || !author || !isbn) {
        return res.status(400).json({ message: "All fields required" });
    }

    const sql = "INSERT INTO books (book_name, author, isbn) VALUES (?, ?, ?)";

    db.query(sql, [book_name, author, isbn], (err, result) => {
        if (err) return res.status(500).json(err);

        res.json({
            message: "Book added successfully ✅",
            id: result.insertId
        });
    });
});

module.exports = router;
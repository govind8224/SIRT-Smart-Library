const express = require("express");
const router = express.Router();
const db = require("../db");

// ✅ Add User
router.post("/register", (req, res) => {
    const { name, email, rfid } = req.body;   // 🔥 FIX: rfid add karo

    console.log("DATA:", req.body); // debug

    if (!name || !email || !rfid) {
        return res.status(400).send("❌ All fields required");
    }

    const sql = "INSERT INTO users (name, email, rfid) VALUES (?, ?, ?)"; // 🔥 FIX

    db.query(sql, [name, email, rfid], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).send("❌ Database Error");
        }

        res.send("✅ User Added Successfully");
    });
});

module.exports = router;
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*" }
});

// Middleware
// Middleware
app.use(cors({
    origin: "*", // Sabhi domains/IPs ko allow karega
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Pre-flight fix: Sabhi OPTIONS requests ko turant OK bolo
app.options(/.*/, cors());
app.use(express.json());
app.use(express.static("public"));

// ✅ Use single DB connection
const db = require("./db");

// 🔌 WebSocket
io.on("connection", (socket) => {
    console.log("🔗 Client Connected:", socket.id);

    // Mock scan for testing without hardware
    socket.on("simulate-scan", (data) => {
        // Just emit fake data directly to the client
        socket.emit("rfid-data", {
            type: "user",
            role: "student",
            id: 1,
            name: "Rahul Sharma (Simulated)",
            rfid: data.card_id
        });
    });
});

// ==========================================
// 📚 BOOKS MANAGEMENT API (NEW)
// ==========================================

// 1. Fetch Books with Automatic Status (Available vs Issued)
app.get("/books", (req, res) => {
    const search = req.query.search || "";
    const term = `%${search}%`;

    // Humne GROUP BY hata diya hai aur Subquery use ki hai status check karne ke liye
    const sql = `
        SELECT 
            b.*, 
            (SELECT COUNT(*) 
             FROM issued_books ib 
             WHERE ib.book_id = b.id AND ib.return_date IS NULL
            ) AS is_issued
        FROM books b
        WHERE b.book_name LIKE ? OR b.isbn LIKE ? OR b.rfid LIKE ? OR b.slot LIKE ?
    `;

    db.query(sql, [term, term, term, term], (err, results) => {
        if (err) {
            console.error("Fetch Books Error:", err);
            return res.status(500).json({ message: "Database Error" });
        }

        // Database se aaye results ko "Issued" ya "Available" mein convert karna
        const updatedResults = results.map(book => ({
            ...book,
            status: book.is_issued > 0 ? 'Issued' : 'Available'
        }));

        res.json(updatedResults);
    });
});

// 2. Add New Book to Inventory
app.post("/books", (req, res) => {
    const { book_name, author, isbn, rfid, slot } = req.body;

    if (!book_name || !isbn || !rfid || !slot) {
        return res.status(400).json({ message: "Missing required book details" });
    }

    const sql = "INSERT INTO books (book_name, author, isbn, rfid, slot) VALUES (?, ?, ?, ?, ?)";

    db.query(sql, [book_name, author, isbn, rfid, slot], (err, result) => {
        if (err) {
            console.error("Add Book Error:", err);
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: "ISBN or RFID already exists!" });
            return res.status(500).json({ message: "Database Error" });
        }
        res.json({ message: "Book Added Successfully!", id: result.insertId });
    });
});

// 3. Delete Book by ISBN, RFID, or ID
app.delete("/books/:identifier", (req, res) => {
    const id = req.params.identifier;
    
    // Only treat as Database ID if it is numeric and shorter than a standard ISBN (10-13 chars)
    const isDatabaseId = !isNaN(id) && id.length < 10;

    // Step 1: Securely locate the exact book Database ID
    let findSql = "SELECT id, book_name FROM books WHERE isbn = ? OR rfid = ?";
    let findParams = [id, id];
    if (isDatabaseId) {
        findSql += " OR id = ?";
        findParams.push(Number(id));
    }

    db.query(findSql, findParams, (err, books) => {
        if (err) return res.status(500).json({ message: "Database Error looking up inventory" });
        if (books.length === 0) return res.status(404).json({ message: "Book not found" });

        const actual_book_id = books[0].id;
        const bookName = books[0].book_name;

        // Step 2: Validate whether the book is currently circulating
        const checkSql = "SELECT * FROM issued_books WHERE book_id = ? AND return_date IS NULL";
        db.query(checkSql, [actual_book_id], (err, issued) => {
            if (err) return res.status(500).json({ message: "Database Error calculating circulation parameters" });

            if (issued.length > 0) {
                // ACTIVE CIRCULATION! Deny Inventory Deletion
                return res.status(403).json({ message: `Access Denied: '${bookName}' is currently actively issued to a student. Provide return before deleting.` });
            }

            // Step 3: Delete since logic establishes validity
            const deleteSql = "DELETE FROM books WHERE id = ?";
            db.query(deleteSql, [actual_book_id], (err, result) => {
                if (err) return res.status(500).json({ message: "Database Error processing deletion." });
                res.json({ message: `Inventory Clear: '${bookName}' deleted successfully` });
            });
        });
    });
});

// ==========================================
// 📝 REGISTRATION API (NEWLY ADDED)
// ==========================================

// 1. Student Registration
app.post("/students/register", (req, res) => {
    const { name, email, username, password, course, rfid } = req.body;

    const sql = "INSERT INTO students (name, email, username, password, course, rfid) VALUES (?, ?, ?, ?, ?, ?)";

    // Note: In a production app, use bcrypt to hash the password here before saving!
    db.query(sql, [name, email, username, password, course, rfid], (err, result) => {
        if (err) {
            console.error(err);
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).send("❌ Email, Username, or RFID already exists!");
            return res.status(500).send("❌ Database Error");
        }
        res.send("✅ Student Registered Successfully!");
    });
});

// 2. Faculty Registration
app.post("/faculty/register", (req, res) => {
    // Note: The frontend sends "course", but for faculty, we save it as "department"
    const { name, email, username, password, course, rfid } = req.body;

    const sql = "INSERT INTO faculty (name, email, username, password, department, rfid) VALUES (?, ?, ?, ?, ?, ?)";

    db.query(sql, [name, email, username, password, course, rfid], (err, result) => {
        if (err) {
            console.error(err);
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).send("❌ Email, Username, or RFID already exists!");
            return res.status(500).send("❌ Database Error");
        }
        res.send("✅ Faculty Registered Successfully!");
    });
});
// ==========================================
// 🔐 LOGIN API
// ==========================================
app.post("/login", (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ message: "All fields are required" });
    }

    // Determine which table to query
    let tableName = "";
    if (role === "student") tableName = "students";
    else if (role === "faculty") tableName = "faculty";
    else return res.status(400).json({ message: "Invalid role selected" });

    // Look for the user in the database
    const sql = `SELECT * FROM ${tableName} WHERE username = ? AND password = ?`;

    db.query(sql, [username, password], (err, results) => {
        if (err) {
            console.error("DB Login Error:", err);
            return res.status(500).json({ message: "Database error" });
        }

        if (results.length > 0) {
            // User found!
            const user = results[0];

            // SECURITY: Never send the password back to the frontend
            delete user.password;

            // Send the user data back to frontend so it can be saved in localStorage
            return res.json({ message: "Login successful", user: user });
        } else {
            // No match found
            return res.status(401).json({ message: "Invalid username or password" });
        }
    });
});

// ==========================================
// 📡 RFID SCAN API (UPGRADED FOR TWO TABLES)
// ==========================================
app.post("/rfid-scan", (req, res) => {
    const { card_id } = req.body;

    // Use UNION to search students, faculty, and books tables at the same time
    const sql = `
        SELECT id, name, rfid, 'student' AS role FROM students WHERE rfid = ?
        UNION
        SELECT id, name, rfid, 'faculty' AS role FROM faculty WHERE rfid = ?
        UNION
        SELECT id, book_name AS name, rfid, 'book' AS role FROM books WHERE rfid = ?
    `;

    db.query(sql, [card_id, card_id, card_id], (err, user) => {
        if (err) return res.status(500).json({ message: "DB Error" });

        if (user.length > 0) {
            const roleFound = user[0].role;
            const eventPayload = {
                type: roleFound === "book" ? "book" : "user",
                role: roleFound, // Tells the frontend if it's a student, faculty, or book
                id: user[0].id,
                name: user[0].name,
                rfid: user[0].rfid,
                message: roleFound === "book" ? "Book Details Transmitted" : undefined
            };

            io.emit("rfid-data", eventPayload);

            return res.json({ message: `${roleFound} Found`, data: user[0] });
        }

        // ❌ Unknown card
        io.emit("rfid-data", {
            type: "unknown",
            rfid: card_id,
            message: "Unknown Card"
        });

        res.json({ message: "Not Found", rfid: card_id });
    });
});


// ==========================================
/// ==========================================
// 📖 ISSUE / RETURN API (FIXED FOR RFID)
// ==========================================
app.post("/issue-return", (req, res) => {
    const { user_rfid, book_id } = req.body;

    if (!user_rfid || !book_id) {
        return res.status(400).json({ message: "Both Student ID and Book Tag are required to process this transaction." });
    }

    // Step 1: Verify the book exists and resolve its true database ID by checking id, rfid, or isbn
    const findBookSql = "SELECT id, book_name FROM books WHERE id = ? OR rfid = ? OR isbn = ?";

    db.query(findBookSql, [book_id, book_id, book_id], (err, books) => {
        if (err) return res.status(500).json({ message: "Database Error" });

        if (books.length === 0) {
            return res.status(404).json({ message: "Book does not exist in library database." });
        }

        const actual_book_id = books[0].id;
        const book_title = books[0].book_name;

        // Step 2: Check if this specific book is currently issued (no return_date)
        const checkSql = `
            SELECT * FROM issued_books 
            WHERE book_id=? AND return_date IS NULL
        `;

        db.query(checkSql, [actual_book_id], (err, result) => {
            if (err) return res.status(500).json({ message: "Error checking circulation bounds." });

            // 🔁 RETURN LOGIC: If it's already active, returning it makes it available!
            if (result.length > 0) {
                db.query(
                    "UPDATE issued_books SET return_date=NOW() WHERE book_id=? AND return_date IS NULL",
                    [actual_book_id],
                    (err, updateResult) => {
                        if (err) {
                            console.error("DB Issue/Return Error:", err);
                            return res.status(500).json({ message: "Database failure during return." });
                        }
                        io.emit("rfid-data", {
                            type: "book",
                            message: `🔁 Book Returned: ${book_title}`
                        });
                        res.json({ message: `Book Returned Successfully.` });
                    }
                );
            } else {
                // 📖 ISSUE LOGIC: Needs user_rfid since it's not currently issued
                if (!user_rfid) {
                    return res.status(400).json({ message: "Book is not issued. To issue this book, please scan a Student or Faculty ID card first." });
                }

                const findUserSql = `
                    SELECT rfid FROM students WHERE rfid = ?
                    UNION 
                    SELECT rfid FROM faculty WHERE rfid = ?
                `;

                db.query(findUserSql, [user_rfid, user_rfid], (err, users) => {
                    if (err) return res.status(500).json({ message: "Database Error during User Lookup" });

                    if (users.length === 0) {
                        return res.status(404).json({ message: "User does not exist in the system. Cannot issue." });
                    }

                    const actual_user_rfid = users[0].rfid;

                    db.query(
                        "INSERT INTO issued_books (user_rfid, book_id, issue_date) VALUES (?, ?, NOW())",
                        [actual_user_rfid, actual_book_id],
                        (err, insertResult) => {
                            if (err) {
                                console.error("DB Issue Error:", err);
                                return res.status(500).json({ message: "Database failure during issue assignment. Check RFID match." });
                            }
                            io.emit("rfid-data", {
                                type: "book",
                                message: `📖 Book Issued: ${book_title}`
                            });
                            res.json({ message: `Book Issued Successfully.` });
                        }
                    );
                });
            }
        });
    });
});


// ==========================================
// 📚 STUDENT DASHBOARD APIs (FIXED FOR RFID)
// ==========================================

// Get student books using RFID
app.get("/student-books/:rfid", (req, res) => {
    const rfid = req.params.rfid; // Grab RFID from URL

    const sql = `
        SELECT books.book_name AS title, books.author, books.slot, books.isbn, issued_books.issue_date,
        CASE 
            WHEN issued_books.return_date IS NULL THEN 'issued'
            ELSE 'returned'
        END AS status
        FROM issued_books
        JOIN books ON issued_books.book_id = books.id
        WHERE issued_books.user_rfid = ? 
    `;

    db.query(sql, [rfid], (err, result) => {
        if (err) return res.send(err);
        res.json(result);
    });
});

// Get fine using RFID (Student vs Faculty conditional bounding)
app.get("/student-fine/:rfid", (req, res) => {
    const rfid = req.params.rfid;

    // Step 1: Check if this user is Faculty (Faculty have 6-month cycles with 0 routine penalty fines)
    const checkFacultySql = "SELECT * FROM faculty WHERE rfid = ?";
    db.query(checkFacultySql, [rfid], (err, faculty) => {
        if (err) return res.status(500).send(err);

        if (faculty.length > 0) {
            // The user is Faculty, securely omit system penalties
            return res.json({ fine: 0 });
        }

        // Step 2: The user is a Student. Calculate dynamically applying a 14-day penalty buffer. 
        // We will assume a native penalty of 10 monetary units per day overdue.
        // Use COALESCE to calculate fine up to return_date if returned, or NOW() if still issued.
        // This persists the fine even after the book is returned.
        const sql = `
            SELECT SUM(GREATEST(DATEDIFF(COALESCE(return_date, NOW()), issue_date) - 14, 0)) * 10 AS fine
            FROM issued_books
            WHERE user_rfid = ? 
        `;

        db.query(sql, [rfid], (err, result) => {
            if (err) return res.status(500).send(err);

            // Re-bind to 0 if the query comes back NULL computationally
            const accumulatedFine = result[0].fine || 0;
            res.json({ fine: accumulatedFine });
        });
    });
});

// ==========================================
// 🧠 ARTIFICIAL INTELLIGENCE APIs (GEMINI)
// ==========================================
// Initialize AI using your Env key 
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get("/ai-recommendations/:rfid", (req, res) => {
    const rfid = req.params.rfid;

    // Step 1: Discover what the user is currently reading
    const sql = `
        SELECT books.book_name
        FROM issued_books
        JOIN books ON issued_books.book_id = books.id
        WHERE issued_books.user_rfid = ? AND issued_books.return_date IS NULL
    `;

    db.query(sql, [rfid], async (err, result) => {
        if (err) return res.status(500).json({ message: "DB Error querying book history for AI." });

        // Step 2: Establish Prompt Context
        let context = "general computer science and engineering coursework";
        if (result.length > 0) {
            context = "the student is currently reading the following books: " + result.map(r => r.book_name).join(", ");
        }

        const prompt = `You are a Smart Digital Librarian. Based on the following context: "${context}", recommend 3 educational book titles or highly specific subject areas the student should check out next to level up their knowledge. Reply ONLY with a valid JSON array of exactly 3 strings, e.g., ["Advanced Mathematics", "Cloud Computing Basics", "Algorithms Guide"]. Do NOT use markdown code blocks layout.`;

        // Step 3: Trigger Generative Network
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const aiResponse = await model.generateContent(prompt);

            // Clean up any potential markdown traces
            let rawText = aiResponse.response.text();
            rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

            const parsedRecommendations = JSON.parse(rawText);
            res.json({ recommendations: parsedRecommendations });
        } catch (aiErr) {
            console.error("AI Network Failure:", aiErr);
            // Fallback natively to guarantee UI consistency even if API is exhausted
            res.status(500).json({
                message: "AI engine exhausted",
                recommendations: ["Machine Learning & Deep Learning", "IoT Security Best Practices", "Data Structures Fundamentals"]
            });
        }
    });
});


// ==========================================
// 📊 REAL-TIME DASHBOARD INSIGHTS API
// ==========================================
app.get("/api/dashboard/stats", (req, res) => {
    const queryBooks = "SELECT COUNT(*) AS count FROM books";
    const queryStudents = "SELECT COUNT(*) AS count FROM students";
    const queryFaculty = "SELECT COUNT(*) AS count FROM faculty";
    const queryIssued = "SELECT COUNT(*) AS count FROM issued_books WHERE return_date IS NULL";

    db.query(queryBooks, (err1, res1) => {
        if (err1) return res.status(500).json({ error: err1.message });

        db.query(queryStudents, (err2, res2) => {
            if (err2) return res.status(500).json({ error: err2.message });

            db.query(queryFaculty, (err3, res3) => {
                if (err3) return res.status(500).json({ error: err3.message });

                db.query(queryIssued, (err4, res4) => {
                    if (err4) return res.status(500).json({ error: err4.message });

                    const totalUsers = res2[0].count + res3[0].count; // Students + Faculty
                    res.json({
                        totalBooks: res1[0].count,
                        totalStudents: res2[0].count,
                        totalFaculty: res3[0].count,
                        totalUsers: totalUsers,
                        activeIssues: res4[0].count
                    });
                });
            });
        });
    });
});

// ==========================================
// 📋 ADMIN: ISSUED BOOKS WITH BORROWER INFO
// ==========================================
app.get("/api/issued-books", (req, res) => {
    const search = req.query.search || "";
    const term = `%${search}%`;

    // JOIN issued_books with books and BOTH students & faculty via user_rfid
    const sql = `
        SELECT 
            ib.id,
            b.book_name,
            b.isbn,
            b.slot,
            ib.issue_date,
            ib.return_date,
            ib.user_rfid,
            COALESCE(s.name, f.name)       AS borrower_name,
            COALESCE(s.course, f.department) AS borrower_dept,
            CASE 
                WHEN s.rfid IS NOT NULL THEN 'Student'
                WHEN f.rfid IS NOT NULL THEN 'Faculty'
                ELSE 'Unknown'
            END AS borrower_role,
            CASE 
                WHEN ib.return_date IS NULL THEN 'Issued'
                ELSE 'Returned'
            END AS status
        FROM issued_books ib
        JOIN books b ON ib.book_id = b.id
        LEFT JOIN students s ON ib.user_rfid = s.rfid
        LEFT JOIN faculty  f ON ib.user_rfid = f.rfid
        WHERE 
            b.book_name    LIKE ? OR
            b.isbn         LIKE ? OR
            COALESCE(s.name, f.name) LIKE ? OR
            COALESCE(s.course, f.department) LIKE ? OR
            ib.user_rfid   LIKE ?
        ORDER BY ib.issue_date DESC
    `;

    db.query(sql, [term, term, term, term, term], (err, results) => {
        if (err) {
            console.error("Issued Books Fetch Error:", err);
            return res.status(500).json({ message: "Database Error" });
        }
        res.json(results);
    });
});

// ==========================================
// 📊 ADMIN: RECENT ISSUED BOOKS FOR DASHBOARD
// ==========================================
app.get("/api/dashboard/recent-issues", (req, res) => {
    const sql = `
        SELECT 
            b.book_name,
            ib.issue_date,
            ib.return_date,
            COALESCE(s.name, f.name) AS borrower_name,
            CASE 
                WHEN s.rfid IS NOT NULL THEN 'Student'
                WHEN f.rfid IS NOT NULL THEN 'Faculty'
                ELSE 'Unknown'
            END AS borrower_role,
            CASE 
                WHEN ib.return_date IS NULL THEN 'Issued'
                ELSE 'Returned'
            END AS status
        FROM issued_books ib
        JOIN books b ON ib.book_id = b.id
        LEFT JOIN students s ON ib.user_rfid = s.rfid
        LEFT JOIN faculty  f ON ib.user_rfid = f.rfid
        ORDER BY ib.issue_date DESC
        LIMIT 6
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Recent Issues Error:", err);
            return res.status(500).json({ message: "Database Error" });
        }
        res.json(results);
    });
});

// Default route
app.get("/", (req, res) => {
    res.send("🚀 Smart Library Server Running...");
});

// Server start
// Server start
// ==========================================
// 🚀 SERVER START (FIXED FOR SOCKET.IO)
// ==========================================
const PORT = process.env.PORT || 3000;

const os = require('os');
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '0.0.0.0';
}

// ==========================================
// 🗄️ AUTO-INITIALIZE DATABASE TABLES
// ==========================================
function initTables() {
    const tables = [
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

    tables.forEach(sql => {
        db.query(sql, (err) => {
            if (err) console.error("❌ Table creation error:", err.message);
        });
    });

    // Create default admin if not exists
    db.query("SELECT * FROM faculty WHERE username = 'admin'", (err, results) => {
        if (err) return;
        if (results.length === 0) {
            db.query("INSERT INTO faculty (name, email, username, password, department, rfid) VALUES ('Admin', 'admin@library.com', 'admin', 'admin123', 'Library', 'ADMIN_RFID_001')", (err) => {
                if (!err) console.log("✅ Default admin created (username: admin, password: admin123)");
            });
        }
    });

    console.log("✅ Database tables initialized");
}

// ✅ RIGHT: Use server.listen so BOTH Express and Socket.io work
server.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIp();
    console.log(`🚀 Server running locally at http://localhost:${PORT}`);
    console.log(`🌐 Network access at http://${ip}:${PORT}`);
    initTables(); // Auto-create tables on startup
});
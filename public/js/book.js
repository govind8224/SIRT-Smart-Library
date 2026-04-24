const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
const API_URL = API_BASE + "/books";

document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. THREE.JS BACKGROUND (Keeping your existing logic) ---
    // ... (Your initThreeJS code remains exactly the same)

    // --- 2. UI HELPERS ---
    const menuToggle = document.getElementById("menuToggle");
    const dropdownNav = document.getElementById("dropdownNav");
    menuToggle.onclick = (e) => { e.stopPropagation(); dropdownNav.classList.toggle("show"); };
    document.onclick = () => dropdownNav.classList.remove("show");

    // --- 3. CORE CRUD LOGIC ---
    const form = document.getElementById("bookForm");
    const bookTableBody = document.getElementById("bookTableBody");
    const searchInput = document.getElementById("searchInput");

    // Fetch and Render Books
    async function fetchBooks(query = "") {
        try {
            const res = await fetch(`${API_URL}?search=${query}`);
            const books = await res.json();
            
            bookTableBody.innerHTML = books.length > 0 ? books.map(book => {
                const isIssued = book.status === 'Issued';
                const statusClass = isIssued ? 'status-issued' : 'status-available';

                return `
                    <tr>
                        <td>${book.id}</td>
                        <td><strong>${book.book_name}</strong></td>
                        <td>${book.author}</td>
                        <td><span class="slot-tag">${book.slot || 'N/A'}</span></td>
                        <td>${book.isbn}</td>
                        <td>
                            <span class="status-badge ${statusClass}">
                                ${book.status}
                            </span>
                        </td>
                        <td>
                            <button class="btn-delete" onclick="deleteBook('${book.isbn}', ${book.id})">
                                Delete
                            </button>
                        </td>
                    </tr>
                `;
            }).join('') : `<tr><td colspan="7" style="text-align:center; padding:20px;">No books found in inventory.</td></tr>`;
        } catch (err) {
            console.error("Fetch Error:", err);
        }
    }

    // Add Book Submission (Updated for Separate RFID)
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const bookData = {
            book_name: document.getElementById("book_name").value.trim(),
            author: document.getElementById("author").value.trim(),
            slot: document.getElementById("slot").value.trim(),
            isbn: document.getElementById("isbn").value.trim(),
            rfid: document.getElementById("rfid").value.trim() // Now fetching from its own input
        };

        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bookData)
            });

            const result = await res.json();

            if (res.ok) {
                if (window.spawnGlobalAlert) window.spawnGlobalAlert("Book Added", result.message || "Book added!", "success");
                else alert("✅ " + (result.message || "Book added!"));
                form.reset();
                fetchBooks(); 
            } else {
                if (window.spawnGlobalAlert) window.spawnGlobalAlert("Action Failed", result.message, "error");
                else alert("❌ " + result.message);
            }
        } catch (err) {
            if (window.spawnGlobalAlert) window.spawnGlobalAlert("Server Error", "Server connection failed", "error");
            else alert("❌ Server connection failed");
        }
    });

    // Delete Book Handler
    window.deleteBook = async (isbn, id) => {
        if (!confirm(`Delete book: ${isbn}?`)) return;
        try {
            const res = await fetch(`${API_URL}/${isbn}`, { method: "DELETE" });
            if (res.ok) { 
                if (window.spawnGlobalAlert) window.spawnGlobalAlert("Book Deleted", `Book ${isbn} was successfully removed.`, "success");
                fetchBooks(); 
            } else {
                if (window.spawnGlobalAlert) window.spawnGlobalAlert("Delete Failed", "Could not delete the book.", "error");
            }
        } catch (err) { 
            if (window.spawnGlobalAlert) window.spawnGlobalAlert("Server Error", "Delete request failed", "error");
            else alert("❌ Delete request failed"); 
        }
    };

    // Search Trigger
    document.getElementById("searchBtn").onclick = () => fetchBooks(searchInput.value.trim());
    searchInput.addEventListener("input", (e) => fetchBooks(e.target.value.trim()));

    // Initialize Page
    // Extract query parameter if passed directly from three.html Global Search
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get('search') || "";
    
    if(initialQuery) {
        searchInput.value = initialQuery;
        fetchBooks(initialQuery);
    } else {
        fetchBooks();
    }
});
// ==========================================
// 🎓 FACULTY DASHBOARD LOGIC
// ==========================================

// Mock user logic gracefully loaded for previewability
let userData = localStorage.getItem("faculty");
let isFaculty = true;

if (!userData) {
    // Check if a student accidentally routed here
    userData = localStorage.getItem("student");
    isFaculty = false;
}

// ⚠️ MOCK FALLBACK: So users can inspect the UI without looping back to login
if (!userData) {
    console.warn("No logged-in user found. Falling back to visual mockup data for UI demonstration.");
    userData = JSON.stringify({
        name: "Dr. Sharma",
        email: "dr.sharma@sirt.edu",
        course: "Head of Dept - Computer Science",
        rfid: "12345678"
    });
}

// Parse user
const user = JSON.parse(userData);

// --- Build UI ---
document.getElementById("name").innerText = user.name.split(" ")[0];
document.getElementById("email").innerText = user.email;
document.getElementById("course").innerText = user.course || user.department || "Faculty";

if (user.name) {
    document.getElementById("userAvatar").innerHTML = `<span style="font-weight: 600;">${user.name.charAt(0).toUpperCase()}</span>`;
}

// --- Fetch Data from Backend ---
async function fetchFacultyDashboardData() {
    const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
    
    try {
        // Fetch Books
        const booksRes = await fetch(`${API_BASE}/student-books/${user.rfid}`);
        if(booksRes.ok) {
            const books = await booksRes.json();
            const tbody = document.getElementById("bookTable");
            
            if (!tbody) return;

            if (books.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color: #aaa;">You have no active references currently recorded.</td></tr>`;
            } else {
                tbody.innerHTML = books.map(book => {
                    const isIssued = book.status === 'issued';
                    const statusBadge = isIssued 
                        ? '<span class="badge badge-issued" style="background: rgba(0, 212, 255, 0.1); color: #00d4ff; border: 1px solid rgba(0, 212, 255, 0.2);">Reference</span>' 
                        : '<span class="badge badge-success" style="background: rgba(0, 230, 118, 0.1); color: #00e676; border: 1px solid rgba(0, 230, 118, 0.2); padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 600;">Returned</span>';
                    
                    // Format Expected return (6 months out from issue_date)
                    let expectedReturnString = 'N/A';
                    if(isIssued && book.issue_date) {
                        let expected = new Date(book.issue_date);
                        expected.setMonth(expected.getMonth() + 6); // Add 6 Months per faculty rule
                        expectedReturnString = `<span style="color: #FFD700; font-weight: 600;">${expected.toLocaleDateString('en-GB')}</span>`;
                    } else if (!isIssued) {
                        expectedReturnString = `<span style="color: grey;">Resolved</span>`;
                    }

                    return `
                        <tr>
                            <td><strong>${book.title}</strong></td>
                            <td>${book.author || 'N/A'}</td>
                            <td>${expectedReturnString}</td>
                            <td>${statusBadge}</td>
                        </tr>
                    `;
                }).join("");
            }
        }
    } catch (err) {
        console.error("Dashboard Data Fetch Error:", err);
    }
}

// Immediately launch fetch
fetchFacultyDashboardData();


// --- RFID Handling ---
const rfidInput = document.getElementById("rfidInput");
const socket = io();

// Maintain Focus
setInterval(() => {
    const active = document.activeElement;
    const isEditing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
    
    if (active !== rfidInput && !isEditing && !("ontouchstart" in window)) {
        rfidInput.focus({ preventScroll: true }); // stop top jumping
    }
}, 2000);

// Hardware Scanner Socket Listeners
socket.on("rfid-data", (data) => {
    console.log("Hardware Event:", data);
    
    // Status visual
    const statusBox = document.getElementById("statusBox");
    const statusText= document.getElementById("statusText");

    if (data.type === "error" || data.message === "Unknown Card") {
        statusBox.className = "status-box error";
        statusBox.innerHTML = `
            <div class="pulse-ring"><i class="ph ph-x-circle"></i></div>
            <span id="statusText">Invalid / Unknown Card</span>
        `;
    } else {
        // Success Event (Book scanned or matched User scanner)
        statusBox.className = "status-box success";
        statusBox.innerHTML = `
            <div class="pulse-ring"><i class="ph ph-check-circle"></i></div>
            <span id="statusText">System Confirmed</span>
        `;
        
        if (data.type === 'book') {
            // Trigger UI refresh dynamically so the table updates magically without reloading!
            fetchFacultyDashboardData();
        }
    }

    setTimeout(() => {
        statusBox.className = "status-box waiting";
        statusBox.innerHTML = `
            <div class="pulse-ring"><i class="ph ph-identification-card"></i></div>
            <span id="statusText">Waiting for scan...</span>
        `;
    }, 4000);
});

// Logout Flow
function logout() {
    localStorage.removeItem("faculty");
    window.location.href = "../login.html";
}

// Search Books
function searchBook() {
    let input = document.getElementById("searchBook").value.toLowerCase();
    let trs = document.getElementById("bookTable").getElementsByTagName("tr");

    for (let i = 0; i < trs.length; i++) {
        let tdTitle = trs[i].getElementsByTagName("td")[0];
        let tdAuthor= trs[i].getElementsByTagName("td")[1];
        if (tdTitle || tdAuthor) {
            let txtValue1 = tdTitle.innerText.toLowerCase();
            let txtValue2 = tdAuthor.innerText.toLowerCase();
            if (txtValue1.indexOf(input) > -1 || txtValue2.indexOf(input) > -1) {
                trs[i].style.display = "";
            } else {
                trs[i].style.display = "none";
            }
        }
    }
}

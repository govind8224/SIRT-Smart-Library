// ==========================================
// 🎓 STUDENT DASHBOARD LOGIC
// ==========================================

// Mock user logic gracefully loaded for previewability
let userData = localStorage.getItem("student");
let isStudent = true;

if (!userData) {
    userData = localStorage.getItem("faculty");
    isStudent = false;
}

// ⚠️ MOCK FALLBACK: So users can inspect the UI without looping back to login
if (!userData) {
    console.warn("No logged-in user found. Falling back to visual mockup data for UI demonstration.");
    userData = JSON.stringify({
        name: "Rahul Sharma",
        email: "rahul.cs@sirt.edu",
        course: "Computer Science - Sem 4",
        rfid: "12345678"
    });
}

// Parse user
const user = JSON.parse(userData);

// --- Build UI ---
document.getElementById("name").innerText = user.name.split(" ")[0];
document.getElementById("email").innerText = user.email;
document.getElementById("course").innerText = user.course || user.department || "Not Assigned";

if (user.name) {
    document.getElementById("userAvatar").innerHTML = `<span style="font-weight: 600;">${user.name.charAt(0).toUpperCase()}</span>`;
}

// --- Fetch Data from Backend ---
async function fetchStudentDashboardData() {
    const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
    
    try {
        // 1. Fetch Fine
        const fineRes = await fetch(`${API_BASE}/student-fine/${user.rfid}`);
        if(fineRes.ok) {
            const fineData = await fineRes.json();
            // fineData comes as an object like { fine: 150 } or similar based on backend query
            if(document.getElementById("fineAmount")) {
                document.getElementById("fineAmount").innerText = fineData.fine || 0;
            }
        }

        // 2. Fetch Books
        const booksRes = await fetch(`${API_BASE}/student-books/${user.rfid}`);
        if(booksRes.ok) {
            const books = await booksRes.json();
            const tbody = document.getElementById("bookTable");
            
            if (!tbody) return;

            if (books.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color: #aaa;">You have no books currently recorded.</td></tr>`;
            } else {
                tbody.innerHTML = books.map(book => {
                    const statusBadge = book.status === 'issued' 
                        ? '<span class="badge badge-issued">Issued</span>' 
                        : '<span class="badge badge-success" style="background: rgba(0, 230, 118, 0.1); color: #00e676; border: 1px solid rgba(0, 230, 118, 0.2); padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 600;">Returned</span>';
                        
                    return `
                        <tr>
                            <td><strong>${book.title}</strong></td>
                            <td>${book.slot || 'N/A'}</td>
                            <td>${book.author || 'N/A'}</td>
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
fetchStudentDashboardData();


// ==========================================
// 🧠 AI RECOMMENDATION FETCH LOGIC
// ==========================================
async function fetchAIRecommendations() {
    const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
    const panel = document.getElementById("aiRecommendationPanel");
    const container = document.getElementById("aiRecBoxes");
    
    if (!panel || !container) return;

    try {
        const response = await fetch(`${API_BASE}/ai-recommendations/${user.rfid}`);
        if(response.ok || response.status === 500) {
            const data = await response.json();
            const recommendations = data.recommendations;
            
            if(recommendations && recommendations.length > 0) {
                // Reveal the panel
                panel.style.display = "block";
                
                // Build the HTML cards geometrically
                container.innerHTML = recommendations.map(rec => `
                    <div style="flex: 1 1 200px; background: rgba(20, 20, 30, 0.4); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 15px; box-shadow: inset 0 4px 15px rgba(168, 85, 247, 0.05); text-align:center; transition: transform 0.2s;">
                        <i class="ph ph-books" style="color: #d946ef; font-size: 24px; margin-bottom: 8px;"></i>
                        <h4 style="margin: 0; font-size: 14px; font-weight: 500; color: #fff;">${rec}</h4>
                    </div>
                `).join("");
            }
        }
    } catch(err) {
        console.error("AI Feature execution failure:", err);
    }
}

// Spark the AI engine
fetchAIRecommendations();




// --- RFID Handling ---
const rfidInput = document.getElementById("rfidInput");
// Lock focus to input field continuously so hardware scanner keystrokes are caught
setInterval(() => {
    const active = document.activeElement;
    const isEditing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
    
    if (active !== rfidInput && !isEditing && !("ontouchstart" in window)) {
        rfidInput.focus({ preventScroll: true }); // preventScroll stops the top jumping behavior too!
    }
}, 1000);

// Simulated manual input trigger
rfidInput.addEventListener("change", (e) => {
    const val = e.target.value.trim();
    if(val) simulateRfidData(val);
    e.target.value = "";
});


// --- Logout ---
function logout() {
    localStorage.removeItem("student");
    localStorage.removeItem("faculty");
    window.location.href = "../login.html";
}


// --- SOCKET IO / Real RFID listener ---
try {
    const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
    const socket = io(API_BASE, { timeout: 3000 });
    
    socket.on("rfid-data", (data) => {
        handleRfidScanned(data);
    });

} catch (err) {
    console.log("Socket connection failed, offline mode running.");
}

function handleRfidScanned(data) {
    const statusBox = document.getElementById("statusBox");
    const statusText = document.getElementById("statusText");
    const icon = statusBox.querySelector("i");
    const pulseBody = statusBox.querySelector(".pulse-ring");

    if (data.type === "user") {
        if (data.rfid === user.rfid) {
            statusBox.className = "status-box success";
            statusText.innerText = "✅ Welcome back, " + data.name;
            icon.className = "ph ph-check-circle";
            pulseBody.style.animation = "none";
        } else {
            statusBox.className = "status-box error";
            statusText.innerText = "⚠️ Mismatch detected";
            icon.className = "ph ph-warning-circle";
            pulseBody.style.animation = "none";
        }
    } else {
        statusBox.className = "status-box error";
        statusText.innerText = "❌ Invalid Card";
        icon.className = "ph ph-x-circle";
        pulseBody.style.animation = "none";
    }

    // Reset back to waiting after 4 seconds
    setTimeout(() => {
        statusBox.className = "status-box waiting";
        statusText.innerText = "Waiting for scan...";
        icon.className = "ph ph-identification-card";
        pulseBody.style.animation = "pulseRadar 2s infinite";
    }, 4000);
}

// Simulating for frontend only test
function simulateRfidData(code) {
    handleRfidScanned({
        type: "user",
        rfid: code,
        name: user.name
    });
}


// --- Fines & QR logic ---
function payFine() {
    let amountNode = document.getElementById("fineAmount");
    let amount = amountNode ? parseInt(amountNode.innerText) : 0;
    
    // For demo purposes if empty
    if(amount === 0) {
        if(window.spawnGlobalAlert) window.spawnGlobalAlert("No Fines", "You do not have any pending penalties to pay.", "success");
        else alert("You do not have any pending penalties to pay.");
        return;
    }

    document.getElementById("qrAmount").innerText = amount;

    let upiID = "sirt-books@upi"; 
    let name = "Library SIRT";
    let qrData = `upi://pay?pa=${upiID}&pn=${name}&am=${amount}&cu=INR`;
    let qrURL = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=" + encodeURIComponent(qrData);

    document.getElementById("qrImage").src = qrURL;
    
    let modal = document.getElementById("qrModal");
    modal.classList.add("show");
}

function closeQR() {
    document.getElementById("qrModal").classList.remove("show");
}


// --- Search Filter Logic ---
function searchBook() {
    let input = document.getElementById("searchBook").value.toLowerCase();
    let table = document.getElementById("bookTable");
    let rows = table.getElementsByTagName("tr");

    for (let i = 0; i < rows.length; i++) {
        let titleTd = rows[i].getElementsByTagName("td")[0]; 
        if (titleTd) {
            let textValue = titleTd.textContent || titleTd.innerText;
            if (textValue.toLowerCase().includes(input)) {
                rows[i].style.display = "";
            } else {
                rows[i].style.display = "none";
            }
        }
    }
}
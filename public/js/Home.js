const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
const socket = io(API_BASE); 
let currentUser = null;

const scanDiv = document.getElementById("scan");
const activityDiv = document.getElementById("activity");

// 📡 Listen RFID Data
socket.on("rfid-data", (data) => {

    console.log("RFID:", data);

    // ❌ Unknown card
    if (data.message) {
        scanDiv.innerHTML = "❌ " + data.message;
        activityDiv.innerHTML = "";
        return;
    }

    // 👤 USER SCAN
    if (data.type === "user") {
        currentUser = data;

        scanDiv.innerHTML = "👤 User: " + data.name;
        activityDiv.innerHTML = "📚 Now scan book...";
    }

    // 📚 BOOK SCAN
    if (data.type === "book") {

        if (!currentUser) {
            activityDiv.innerHTML = "⚠️ Please scan user first!";
            return;
        }

        fetch(API_BASE + "/issue-return", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                book_id: data.id
            })
        })
        .then(res => res.json())
        .then(res => {

            activityDiv.innerHTML = res.message;

            // reset user
            currentUser = null;
        })
        .catch(err => {
            console.error(err);
            activityDiv.innerHTML = "❌ Server error";
        });
    }
});
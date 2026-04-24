// ==========================================
// 🔐 LOGIN SYSTEM (DATABASE INTEGRATED)
// ==========================================

const form = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");
const passwordField = document.getElementById("password");
const toggleBtn = document.getElementById("toggleBtn");

// 🔥 Error & Loading States
function showError(message) { errorMsg.innerText = message; }
function clearError() { errorMsg.innerText = ""; }
function setLoading(isLoading) {
    const btn = form.querySelector("button");
    btn.disabled = isLoading;
    btn.innerText = isLoading ? "Logging in..." : "LOGIN";
}

// 👁 Toggle Password Visibility
toggleBtn.addEventListener("click", () => {
    if (passwordField.type === "password") {
        passwordField.type = "text";
        toggleBtn.innerHTML = '<i class="ph ph-eye-slash"></i>'; 
    } else {
        passwordField.type = "password";
        toggleBtn.innerHTML = '<i class="ph ph-eye"></i>'; 
    }
});

// 🚀 LOGIN SUBMIT
form.addEventListener("submit", async function(e) {
    e.preventDefault();
    clearError();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const role = document.getElementById("role").value;

    if (!username || !password || !role) {
        showError("⚠️ Please fill all fields");
        return;
    }

    setLoading(true);

    // ==================================
    // 🛠 ADMIN (DUMMY LOGIN)
    // ==================================
    if (role === "admin") {
        setTimeout(() => {
            if (username === "admin" && password === "1111") {
                localStorage.setItem("admin", username);
                window.location.href = "three.html"; // Redirect Admin
            } else {
                setLoading(false);
                showError("❌ Invalid Admin credentials");
            }
        }, 800);
        return; 
    }

    // ==================================
    // 🎓 STUDENT & FACULTY (DATABASE LOGIN)
    // ==================================
    try {
    const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
    const response = await fetch(API_BASE + "/login", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, password, role })
});

        const data = await response.json();

        if (!response.ok) {
            setLoading(false);
            showError("❌ " + data.message); // Shows "Invalid username or password"
            return;
        }

        // ✅ SUCCESS LOGIN
        if (role === "student") {
            // Save user data (excluding password) to local storage
            localStorage.setItem("student", JSON.stringify(data.user));
            window.location.href = "student/student1.html"; // Redirect Student
        } else if (role === "faculty") {
            localStorage.setItem("faculty", JSON.stringify(data.user));
            window.location.href = "faculty/faculty1.html"; // Redirect to newly built Faculty dashboard
        }

    } catch (error) {
        setLoading(false);
        console.error("Login Error:", error);
        showError("❌ Server connection failed. Is the backend running?");
    }
});
const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
const socket = io(API_BASE);

// --- MENU TOGGLE LOGIC ---
const menuToggle = document.getElementById('menuToggle');
const dropdownNav = document.getElementById('dropdownNav');

// Toggle menu on click
menuToggle.addEventListener('click', (e) => {
    e.stopPropagation(); 
    dropdownNav.classList.toggle('show');
});

// Close menu if user clicks anywhere else on the screen
document.addEventListener('click', (e) => {
    if (!dropdownNav.contains(e.target) && !menuToggle.contains(e.target)) {
        dropdownNav.classList.remove('show');
    }
});

// --- RFID AUTO-FILL LISTENER (Handled by global-rfid.js) ---


// --- FORM SUBMISSION LOGIC ---
const form = document.getElementById("userForm");

// Prevent the RFID scanner's automatic "Enter" keystroke from submitting the form
document.getElementById('rfid').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); 
    }
});

form.addEventListener("submit", async function(e) {
    e.preventDefault();

    // Fetch all values from the form
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const role = document.getElementById("role").value;
    const course = document.getElementById("course").value; // No .trim() needed for dropdowns
    const rfid = document.getElementById("rfid").value.trim();

    // Validate
    if (!name || !email || !username || !password || !role || !course || !rfid) {
        if(window.spawnGlobalAlert) window.spawnGlobalAlert("Validation Error", "Please fill all fields before registering.", "error");
        else alert("⚠️ Please fill all fields before registering.");
        return;
    }

    // --- SEPARATE DATABASE ROUTING LOGIC ---
    const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
    let apiEndpoint = "";
    
    if (role === "student") {
        apiEndpoint = API_BASE + "/students/register"; 
    } else if (role === "faculty") {
        apiEndpoint = API_BASE + "/faculty/register";  
    }

    try {
        const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            // Send the payload
            body: JSON.stringify({ 
                name, 
                email, 
                username, 
                password, 
                role, 
                course, // This will automatically be the Dept. if Faculty is selected
                rfid 
            })
        });

        const result = await response.text();

        if (window.spawnGlobalAlert) {
            if (response.ok) {
                window.spawnGlobalAlert("Registration Success", result.replace(/✅/g, '').trim(), "success");
                form.reset();
            } else {
                window.spawnGlobalAlert("Registration Failed", result.replace(/❌/g, '').trim(), "error");
            }
        } else {
            alert(result);
            if (response.ok) form.reset();
        }

    } catch (error) {
        console.error("Error during registration:", error);
        if (window.spawnGlobalAlert) window.spawnGlobalAlert("Server Error", "Could not connect to the database.", "error");
        else alert("❌ Server error. Could not connect to the database.");
    }
});
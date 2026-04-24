// ==========================================
// 🔔 GLOBAL SOCKET ALERTS ENGINE
// ==========================================

// Global spawn function available immediately
window.spawnGlobalAlert = function(title, message, type = "success") {
    let container = document.getElementById("globalToastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "globalToastContainer";
        document.body.appendChild(container);
    }

    let modifierClass = "type-user";
    let iconClass = "ph-info";

    if (type === "success") {
        modifierClass = "type-success"; 
        iconClass = "ph-check-circle";
    } else if (type === "book") {
        modifierClass = "type-book";
        iconClass = "ph-books";
    } else if (type === "user") {
        modifierClass = "type-user";
        iconClass = "ph-identification-card";
    } else if (type === "error") {
        modifierClass = "type-error";
        iconClass = "ph-warning-circle";
    } else if (type === "system") {
        modifierClass = "type-user";
        iconClass = "ph-cpu";
    }

    const toast = document.createElement("div");
    toast.className = `library-toast ${modifierClass}`;

    toast.innerHTML = `
        <i class="ph ${iconClass}"></i>
        <div class="toast-message">
            <span class="toast-title">${title}</span>
            <strong>${message}</strong>
        </div>
    `;

    container.appendChild(toast);

    // Self Destruct Timer
    setTimeout(() => {
        toast.classList.add("toast-shrinking");
        setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 500);
    }, 5000);
};

document.addEventListener("DOMContentLoaded", () => {
    // Safely Bind Socket
    const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";

    // We only initialize if io exists (Ensure HTML imports CDN)
    if (typeof io !== "undefined") {
        const globalSocket = io(API_BASE);

        globalSocket.on("rfid-data", (data) => {
            console.log("Global Alert Intercepted: ", data);

            if (data.type === "book") {
                window.spawnGlobalAlert("Circulation Activity", data.message || "Book successfully scanned.", "book");
            }
            else if (data.type === "user") {
                window.spawnGlobalAlert("Identity Verified", `Scanner accepted credentials for: ${data.name}`, "user");
            }
            else if (data.type === "error") {
                window.spawnGlobalAlert("Hardware Alert", "Scanner rejected unregistered card protocol.", "error");
            }
        });

    } else {
        console.warn("Global Alerts Warning: Socket.IO library not detected.");
    }
});

// =========================================
// 🎓 SMART LIBRARY - ESP32 CONFIG JS
// =========================================

document.addEventListener("DOMContentLoaded", function () {
    const ipInput = document.getElementById("espIpInput");
    const serverUrlInput = document.getElementById("serverUrlInput");
    const serverUrlCode = document.getElementById("serverUrlCode");

    // Auto-detect server URL
    const currentServerUrl = window.location.origin;
    serverUrlInput.value = currentServerUrl;
    if (serverUrlCode) {
        serverUrlCode.textContent = currentServerUrl;
    }

    // Load saved ESP32 IP
    const savedIP = localStorage.getItem("esp32_ip");
    if (savedIP) {
        ipInput.value = savedIP;
        updateConnectionStatus("saved");
    }

    // Save Configuration
    document.getElementById("saveConfigBtn").addEventListener("click", function () {
        const ip = ipInput.value.trim();
        if (!ip) {
            showNotification("Please enter an IP address", "error");
            return;
        }

        // Basic IP validation
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(ip)) {
            showNotification("Invalid IP address format. Use format: 192.168.1.100", "error");
            return;
        }

        localStorage.setItem("esp32_ip", ip);
        updateConnectionStatus("saved");
        showNotification("ESP32 IP saved successfully!", "success");
    });

    // Test Connection
    document.getElementById("testConnectionBtn").addEventListener("click", async function () {
        const ip = ipInput.value.trim();
        if (!ip) {
            showNotification("Enter an IP address first", "error");
            return;
        }

        updateConnectionStatus("testing");
        this.innerHTML = '<i class="ph ph-spinner-gap spin"></i> Testing...';
        this.disabled = true;

        try {
            // Try to reach the ESP32 (with timeout)
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`http://${ip}/`, {
                signal: controller.signal,
                mode: 'no-cors'
            });

            clearTimeout(timeout);
            updateConnectionStatus("online");
            showNotification("ESP32 is reachable!", "success");

            // Update status items
            document.getElementById("rfidStatus").innerHTML = '<span class="status-dot online"></span> Active';
            document.getElementById("wifiStatus").innerHTML = '<span class="status-dot online"></span> Connected';

        } catch (err) {
            updateConnectionStatus("offline");

            if (err.name === "AbortError") {
                showNotification("Connection timed out. Check if ESP32 is on the same network.", "error");
            } else {
                // With no-cors, opaque responses may land here but device might still be reachable
                updateConnectionStatus("saved");
                showNotification("ESP32 may be reachable — try opening the portal directly.", "warning");
            }
        }

        this.innerHTML = '<i class="ph ph-plugs-connected"></i> Test Connection';
        this.disabled = false;
    });

    // Open ESP32 Portal
    document.getElementById("openPortalBtn").addEventListener("click", function () {
        const ip = ipInput.value.trim() || localStorage.getItem("esp32_ip");
        if (!ip) {
            showNotification("Enter the ESP32 IP address first", "error");
            return;
        }
        window.open("http://" + ip, "_blank");
    });

    // Copy Code
    document.getElementById("copyCodeBtn").addEventListener("click", function () {
        const codeEl = document.getElementById("espCode");
        const codeText = codeEl.innerText;

        navigator.clipboard.writeText(codeText).then(() => {
            this.innerHTML = '<i class="ph ph-check"></i> Copied!';
            this.style.color = 'var(--success)';
            this.style.borderColor = 'var(--success)';

            setTimeout(() => {
                this.innerHTML = '<i class="ph ph-copy"></i> Copy';
                this.style.color = '';
                this.style.borderColor = '';
            }, 2000);
        }).catch(() => {
            showNotification("Failed to copy. Select the code manually.", "error");
        });
    });

    // Update connection status indicator
    function updateConnectionStatus(status) {
        const indicator = document.getElementById("connectionStatus");
        const dot = indicator.querySelector(".status-dot");
        const text = indicator.querySelector(".status-text");

        dot.className = "status-dot";

        switch (status) {
            case "online":
                dot.classList.add("online");
                text.textContent = "Connected";
                break;
            case "offline":
                dot.classList.add("offline");
                text.textContent = "Unreachable";
                break;
            case "saved":
                dot.classList.add("pending");
                text.textContent = "IP Saved";
                break;
            case "testing":
                dot.classList.add("pending");
                text.textContent = "Testing...";
                break;
            default:
                dot.classList.add("offline");
                text.textContent = "Disconnected";
        }
    }

    // Simple notification function
    function showNotification(message, type) {
        // Remove any existing notification
        const existing = document.querySelector(".esp-notification");
        if (existing) existing.remove();

        const notification = document.createElement("div");
        notification.className = `esp-notification ${type}`;
        notification.innerHTML = `
            <i class="ph ph-${type === 'success' ? 'check-circle' : type === 'warning' ? 'warning' : 'x-circle'}"></i>
            <span>${message}</span>
        `;

        // Add styles inline for the notification
        Object.assign(notification.style, {
            position: "fixed",
            top: "20px",
            right: "20px",
            padding: "14px 22px",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "14px",
            fontWeight: "600",
            fontFamily: "'Outfit', sans-serif",
            zIndex: "9999",
            animation: "fadeIn 0.3s ease",
            backdropFilter: "blur(20px)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
        });

        if (type === "success") {
            notification.style.background = "rgba(0, 255, 157, 0.1)";
            notification.style.border = "1px solid rgba(0, 255, 157, 0.3)";
            notification.style.color = "#00ff9d";
        } else if (type === "warning") {
            notification.style.background = "rgba(255, 215, 0, 0.1)";
            notification.style.border = "1px solid rgba(255, 215, 0, 0.3)";
            notification.style.color = "#ffd700";
        } else {
            notification.style.background = "rgba(255, 77, 77, 0.1)";
            notification.style.border = "1px solid rgba(255, 77, 77, 0.3)";
            notification.style.color = "#ff4d4d";
        }

        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = "0";
            notification.style.transition = "opacity 0.3s ease";
            setTimeout(() => notification.remove(), 300);
        }, 3500);
    }
});

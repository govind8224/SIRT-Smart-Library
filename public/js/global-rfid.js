/**
 * 🛰️ GLOBAL RFID ENGINE
 * Handles RFID scans across all pages.
 * Supports: 
 *   1. Auto-filling registration forms (rfid input)
 *   2. Auto-filling issue/return forms (userRfid/bookId inputs)
 *   3. Global background Issue/Return logic
 */

(function() {
    const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
    let socket;
    
    // Safety check for Socket.io
    if (typeof io !== "undefined") {
        socket = io(API_BASE);
    } else {
        console.warn("Global RFID: Socket.IO library not detected.");
        return;
    }

    let currentSessionUserRFID = null;
    let pendingBookRFID = null;
    let resetTimer = null;

    // Reset session after 30 seconds of inactivity
    function resetSession() {
        currentSessionUserRFID = null;
        pendingBookRFID = null;
    }

    socket.on("rfid-data", async (data) => {
        console.log("🛰️ Global RFID Scan:", data);

        // --- 1. REGISTRATION FORM HANDLING ---
        // If we find a single 'rfid' input, it's likely a registration page.
        const regRfidInput = document.getElementById("rfid");
        if (regRfidInput) {
            regRfidInput.value = data.rfid || "";
            if (window.spawnGlobalAlert) {
                window.spawnGlobalAlert("RFID Captured", `ID: ${data.rfid || 'Unknown'}`, "success");
            }
            return; // Stop logic here for registration
        }

        // --- 2. ISSUE/RETURN FORM HANDLING (UI Sync) ---
        const userRfidInput = document.getElementById("userRfid");
        const bookIdInput = document.getElementById("bookId");
        
        if (userRfidInput && (data.role === "student" || data.role === "faculty")) {
            userRfidInput.value = data.rfid;
        }
        if (bookIdInput && data.role === "book") {
            bookIdInput.value = data.rfid;
        }

        // --- 3. CORE LOGIC: BACKGROUND ISSUE/RETURN ---
        if (data.type === "unknown") {
            if (window.spawnGlobalAlert) window.spawnGlobalAlert("Unknown Card", "This card is not registered in the system.", "error");
            return;
        }

        clearTimeout(resetTimer);
        resetTimer = setTimeout(resetSession, 30000);

        if (data.role === "book") {
            pendingBookRFID = data.rfid;
            if (!currentSessionUserRFID) {
                if (window.spawnGlobalAlert) window.spawnGlobalAlert("Book Detected", "Scan a Student/Faculty card to process.", "book");
            } else {
                processGlobalTransaction();
            }
        } else if (data.role === "student" || data.role === "faculty") {
            currentSessionUserRFID = data.rfid;
            if (!pendingBookRFID) {
                if (window.spawnGlobalAlert) window.spawnGlobalAlert("User Identified", `Ready for book scan for ${data.name}`, "user");
            } else {
                processGlobalTransaction();
            }
        }
    });

    async function processGlobalTransaction() {
        if (!currentSessionUserRFID || !pendingBookRFID) return;

        try {
            const response = await fetch(`${API_BASE}/issue-return`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_rfid: currentSessionUserRFID,
                    book_id: pendingBookRFID
                })
            });

            const result = await response.json();
            
            if (window.spawnGlobalAlert) {
                window.spawnGlobalAlert("Transaction Success", result.message, "success");
            }

            // Emit a global event so specific pages can refresh their UI if needed
            document.dispatchEvent(new CustomEvent('rfid-transaction-complete', { 
                detail: { 
                    message: result.message,
                    user: currentSessionUserRFID,
                    book: pendingBookRFID
                } 
            }));
            
            pendingBookRFID = null; // Clear book but keep user for multiple issues

        } catch (err) {
            console.error("Global RFID Error:", err);
            if (window.spawnGlobalAlert) window.spawnGlobalAlert("System Error", "Failed to reach database.", "error");
            pendingBookRFID = null;
        }
    }
})();

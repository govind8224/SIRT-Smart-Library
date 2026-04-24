document.addEventListener("DOMContentLoaded", function() {

    // Mount Socket IO gracefully
    // Standard connection assumes both environments use standard mapping
    const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
    const socket = io(API_BASE);

    // DOM Elements
    const radarSys = document.getElementById("radarSys");
    const coreIcon = document.getElementById("coreIcon");
    const scanStatusText = document.getElementById("scanStatusText");
    const scanSubStatus = document.getElementById("scanSubStatus");
    
    const userCard = document.getElementById("userCard");
    const placeholder = document.getElementById("noCardPlaceholder");
    
    const userRoleBadge = document.getElementById("userRoleBadge");
    const scannedName = document.getElementById("scannedName");
    const scannedId = document.getElementById("scannedId");
    const mockScanBtn = document.getElementById("mockScanBtn");

    console.log("🔌 Initializing Secure Hardware Subroutines...");

    // Socket Hook for incoming scans (Sent by ESP32 via server.js /rfid-scan API)
    socket.on("rfid-data", (data) => {
        console.log("📡 IoT Broadcast Received: ", data);

        // Reset state first to force animation remapping
        resetScannerState();

        if (data.type === "user") {
            triggerSuccess(data);
        } else if(data.type === "error") {
            triggerError();
        } else if(data.type === "book") {
            // Re-trigger success but for inventory processing
            triggerActionFocus(data.message);
        }
    });

    // Helper functions for UX manipulation
    function triggerSuccess(userData) {
        // Style Radar
        radarSys.classList.add("state-success");
        coreIcon.className = "ph ph-check-circle";
        scanStatusText.innerText = "Identity Authenticated";
        scanStatusText.style.color = "var(--success)";
        scanSubStatus.innerText = "Secure bridge established to database.";

        // Hide generic placeholder and open true Card
        placeholder.classList.add("hidden");
        userCard.classList.remove("hidden");

        // Inject SQL payload into graphics
        scannedName.innerText = userData.name;
        scannedId.innerText = "RFID: " + userData.rfid;
        
        if(userData.role === "faculty") {
            userRoleBadge.innerHTML = '<i class="ph ph-chalkboard-teacher"></i> Faculty';
            userRoleBadge.style.color = "var(--secondary)";
            userRoleBadge.style.borderColor = "var(--secondary)";
        } else {
            userRoleBadge.innerHTML = '<i class="ph ph-student"></i> Student';
            userRoleBadge.style.color = "var(--gold)";
            userRoleBadge.style.borderColor = "var(--gold)";
        }
    }

    function triggerError() {
        radarSys.classList.add("state-error");
        coreIcon.className = "ph ph-x-circle";
        scanStatusText.innerText = "Unregistered Card Blocked";
        scanStatusText.style.color = "var(--danger)";
        scanSubStatus.innerText = "RFID Identity is not present in SQL registry.";

        // Ensure user block hides abruptly
        placeholder.classList.remove("hidden");
        userCard.classList.add("hidden");
    }

    function triggerActionFocus(message) {
        scanStatusText.innerText = message;
        scanStatusText.style.color = "var(--gold)";
        coreIcon.className = "ph ph-books";
        radarSys.classList.remove("state-success");
    }

    function resetScannerState() {
        radarSys.classList.remove("state-success", "state-error");
        coreIcon.className = "ph ph-identification-card";
        scanStatusText.innerText = "Awaiting Hardware Scan...";
        scanStatusText.style.color = "var(--text-main)";
        scanSubStatus.innerText = "Hold your RFID Card near the ESP32 module";
    }

    // Force Test Scan Engine
    if(mockScanBtn) {
        let testCycle = 0;
        mockScanBtn.addEventListener("click", () => {
            resetScannerState();
            scanStatusText.innerText = "Processing ESP32 Signal...";
            
            // Introduce artificial physical delay mimicking hardware
            setTimeout(() => {
                // We fake an incoming socket trigger directly
                if(testCycle === 0) {
                    socket.emit('rfid-data', { type: 'user', role: 'student', id: 104, name: 'Khushi Bhilware', rfid: 'A1B2C3D4' });
                    // Fake it so logic picks it up (Normally emitted by local Node process, but client JS cannot emit to itself easily unless rebroadcast. We just call function manually here).
                    triggerSuccess({ type: 'user', role: 'student', id: 104, name: 'Khushi Bhilware', rfid: 'AA-BB-CC-DD' });
                    testCycle++;
                } else if (testCycle === 1) {
                    triggerSuccess({ type: 'user', role: 'faculty', id: 2, name: 'Dr. John Admin', rfid: 'FF-EE-DD-CC' });
                    testCycle++;
                } else {
                    triggerError();
                    testCycle = 0;
                }
            }, 1000);
        });
    }

});

document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
    const socket = io(API_BASE);

    const form = document.getElementById("issueForm");
    const userRfidInput = document.getElementById("userRfid");
    const bookIdInput = document.getElementById("bookId");
    const resultBox = document.getElementById("operationResult");
    const hardwareStatus = document.getElementById("hardwareStatus");

    // ===================================
    // 1. HARDWARE IoT AUTO-FILL LISTENER (Handled by global-rfid.js)
    // ===================================
    document.addEventListener('rfid-transaction-complete', (e) => {
        const data = e.detail;
        console.log("Issue Page UI Sync:", data);
        
        // Visual feedback
        hardwareStatus.classList.add("highlight");
        hardwareStatus.innerHTML = `<i class="ph ph-check-square"></i> Transaction Processed`;
        
        // Refresh registry table
        setTimeout(() => {
            loadIssuedBooks();
            hardwareStatus.classList.remove("highlight");
            hardwareStatus.innerHTML = `<i class="ph ph-wifi-high"></i> Listening...`;
        }, 1500);
    });

    // ===================================
    // 2. MANUAL SUBMISSION HOOK
    // ===================================
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const payload = {
            user_rfid: userRfidInput.value.trim(),
            book_id: bookIdInput.value.trim()
        };

        if(!payload.user_rfid || !payload.book_id) {
            showResult("Missing required payload fields.", false);
            return;
        }

        try {
            const btn = document.getElementById("executeBtn");
            btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Executing...`;
            btn.disabled = true;
            
            const res = await fetch(API_BASE + "/issue-return", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const responseText = await res.json();
            
            if (res.ok) {
                showResult(`Action Succeeded: ${responseText.message}`, true);
                form.reset();
                // Refresh table after a successful issue/return
                setTimeout(() => loadIssuedBooks(), 600);
            } else {
                showResult(`Rejection: ${responseText.message || "Database Error"}`, false);
            }

            btn.innerHTML = `<i class="ph ph-arrow-circle-right"></i> Execute Operation`;
            btn.disabled = false;

        } catch (err) {
            console.error(err);
            showResult("Network transmission failure.", false);
        }
    });

    function showResult(message, isSuccess) {
        resultBox.className = "result-msg " + (isSuccess ? "success" : "error");
        resultBox.innerText = message;
        resultBox.classList.remove("hidden");
        
        setTimeout(() => {
            resultBox.classList.add("hidden");
        }, 5000);
    }

    // ===================================
    // 3. ISSUED BOOKS REGISTRY TABLE
    // ===================================
    const tableBody = document.getElementById("issuedTableBody");
    const searchInput = document.getElementById("issuedSearchInput");
    const clearBtn = document.getElementById("clearSearchBtn");
    const refreshBtn = document.getElementById("refreshIssuedBtn");
    const activeCountEl = document.getElementById("activeCount");
    const returnedCountEl = document.getElementById("returnedCount");
    const totalCountEl = document.getElementById("totalCount");
    const noResults = document.getElementById("noIssuedResults");

    let debounceTimer = null;

    async function loadIssuedBooks(query = "") {
        setLoadingState();

        try {
            const url = API_BASE + "/api/issued-books" + (query ? `?search=${encodeURIComponent(query)}` : "");
            const res = await fetch(url);
            if (!res.ok) throw new Error("Fetch failed");
            const data = await res.json();

            renderTable(data);
            updateStats(data);

        } catch (err) {
            console.error("Issued Books Load Error:", err);
            tableBody.innerHTML = `<tr class="loading-row"><td colspan="9" style="text-align:center; color: var(--danger); padding:40px;">⚠ Failed to load data. Check server connection.</td></tr>`;
        }
    }

    function setLoadingState() {
        tableBody.innerHTML = `
            <tr class="loading-row">
                <td colspan="9">
                    <div class="loading-spinner">
                        <i class="ph ph-spinner-gap spin-anim"></i> Loading registry...
                    </div>
                </td>
            </tr>`;
        noResults.classList.add("hidden");
    }

    function updateStats(data) {
        const active   = data.filter(r => r.status === "Issued").length;
        const returned = data.filter(r => r.status === "Returned").length;
        activeCountEl.textContent   = active;
        returnedCountEl.textContent = returned;
        totalCountEl.textContent    = data.length;
    }

    function formatDate(dateStr) {
        if (!dateStr) return `<span style="color: var(--text-muted)">—</span>`;
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }

    function getInitials(name) {
        if (!name) return "?";
        return name.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
    }

    function renderTable(data) {
        if (data.length === 0) {
            tableBody.innerHTML = "";
            noResults.classList.remove("hidden");
            document.getElementById("issuedTable").style.display = "none";
            return;
        }

        noResults.classList.add("hidden");
        document.getElementById("issuedTable").style.display = "";

        tableBody.innerHTML = data.map((row, i) => {
            const roleClass = (row.borrower_role || "").toLowerCase(); // 'student' | 'faculty'
            const statusClass = row.status === "Issued" ? "issued" : "returned";
            const statusIcon = row.status === "Issued"
                ? `<i class="ph ph-clock-countdown"></i>`
                : `<i class="ph ph-check-circle"></i>`;
            const roleIcon = roleClass === "faculty"
                ? `<i class="ph ph-chalkboard-teacher"></i>`
                : `<i class="ph ph-student"></i>`;

            return `
            <tr>
                <td style="color: var(--text-muted); font-size:13px;">${i + 1}</td>
                <td>
                    <div class="borrower-cell">
                        <div class="borrower-avatar ${roleClass}">${getInitials(row.borrower_name)}</div>
                        <span class="borrower-name">${row.borrower_name || '<em style="color:var(--text-muted)">Unknown</em>'}</span>
                    </div>
                </td>
                <td>
                    <span class="role-badge ${roleClass}">${roleIcon} ${row.borrower_role || "—"}</span>
                </td>
                <td style="color: var(--text-muted); font-size:13px;">${row.borrower_dept || "—"}</td>
                <td style="font-weight:500;">${row.book_name}</td>
                <td style="color: var(--text-muted); font-size:13px;">${row.isbn || "—"}</td>
                <td style="font-size:13px;">${formatDate(row.issue_date)}</td>
                <td style="font-size:13px;">${formatDate(row.return_date)}</td>
                <td>
                    <span class="status-badge-cell ${statusClass}">${statusIcon} ${row.status}</span>
                </td>
            </tr>`;
        }).join("");
    }

    // Search with debounce
    searchInput.addEventListener("input", () => {
        const val = searchInput.value.trim();
        clearBtn.classList.toggle("hidden", val.length === 0);

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => loadIssuedBooks(val), 350);
    });

    // Clear search
    clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        clearBtn.classList.add("hidden");
        loadIssuedBooks();
    });

    // Refresh button
    refreshBtn.addEventListener("click", () => {
        refreshBtn.innerHTML = `<i class="ph ph-spinner-gap spin-anim"></i> Refreshing...`;
        refreshBtn.disabled = true;
        loadIssuedBooks(searchInput.value.trim()).then(() => {
            refreshBtn.innerHTML = `<i class="ph ph-arrows-clockwise"></i> Refresh`;
            refreshBtn.disabled = false;
        });
    });

    // Initial load
    loadIssuedBooks();
});

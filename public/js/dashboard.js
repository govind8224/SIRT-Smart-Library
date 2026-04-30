document.addEventListener("DOMContentLoaded", function() {
    
    // Toggle Mobile Navigation
    const menuToggle = document.getElementById('menuToggle');
    const dropdownNav = document.getElementById('dropdownNav');
    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation(); 
            dropdownNav.classList.toggle('show');
        });
    }

    document.addEventListener('click', (e) => {
        if (dropdownNav && !dropdownNav.contains(e.target) && !menuToggle.contains(e.target)) {
            dropdownNav.classList.remove('show');
        }
    });

    // --- RFID UI Sync ---
    document.addEventListener('rfid-transaction-complete', () => {
        console.log("Dashboard UI Sync: Transaction Detected");
        loadDashboardStats();
        loadRecentIssues();
    });

    let liveChartInstance = null;

    // Async Fetch function for API Stats
    async function loadDashboardStats() {
        try {
            const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
            const res = await fetch(API_BASE + "/api/dashboard/stats");
            
            if (!res.ok) throw new Error("Could not fetch metrics.");
            
            const data = await res.json();
            
            // Populate HTML UI Cards
            document.getElementById("statBooks").innerText = data.totalBooks;
            document.getElementById("statStudents").innerText = data.totalStudents;
            document.getElementById("statFaculty").innerText = data.totalFaculty;
            document.getElementById("statIssued").innerText = data.activeIssues;

            // Render/Update the ChartJS Graph
            renderChart(data);

        } catch (err) {
            console.error("Dashboard Load Error:", err);
            document.getElementById("statBooks").innerText = "Err";
            document.getElementById("statStudents").innerText = "Err";
            document.getElementById("statFaculty").innerText = "Err";
            document.getElementById("statIssued").innerText = "Err";
        }
    }

    function renderChart(data) {
        const ctx = document.getElementById('liveChart');
        if (!ctx) return;

        // If chart exists, destroy it before rendering new values
        if (liveChartInstance) {
            liveChartInstance.destroy();
        }

        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = "'Outfit', sans-serif";

        liveChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Total Books', 'Students', 'Faculty', 'Active Issues'],
                datasets: [{
                    label: 'Library Scale Architecture',
                    data: [data.totalBooks, data.totalStudents, data.totalFaculty, data.activeIssues],
                    backgroundColor: [
                        'rgba(255, 215, 0, 0.4)',  // Gold
                        'rgba(0, 210, 255, 0.4)',  // Cyan
                        'rgba(58, 123, 213, 0.4)', // Blue
                        'rgba(239, 68, 68, 0.4)'   // Danger
                    ],
                    borderColor: [
                        '#ffd700',
                        '#00d2ff',
                        '#3a7bd5',
                        '#ef4444'
                    ],
                    borderWidth: 1,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // Refresh Hook
    const refreshBtn = document.getElementById("refreshBtn");
    if(refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            refreshBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Loading';
            Promise.all([loadDashboardStats(), loadRecentIssues()]).then(() => {
                refreshBtn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Refresh';
            });
        });
    }

    // ===================================
    // RECENT ISSUED BOOKS FEED
    // ===================================
    async function loadRecentIssues() {
        const grid = document.getElementById("recentIssuesGrid");
        if (!grid) return;

        grid.innerHTML = `<div class="ri-loading"><i class="ph ph-spinner-gap ri-spin"></i> Loading recent activity...</div>`;

        try {
            const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
            const res = await fetch(API_BASE + "/api/dashboard/recent-issues");
            if (!res.ok) throw new Error();
            const data = await res.json();

            if (data.length === 0) {
                grid.innerHTML = `<div class="ri-empty"><i class="ph ph-tray"></i> No circulation records yet.</div>`;
                return;
            }

            grid.innerHTML = data.map(row => {
                const roleClass = (row.borrower_role || "Unknown").toLowerCase();
                const statusClass = row.status === "Issued" ? "issued" : "returned";
                const initials = (row.borrower_name || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
                const roleIcon = roleClass === "faculty" ? "ph-chalkboard-teacher" : "ph-student";
                const statusIcon = row.status === "Issued" ? "ph-clock-countdown" : "ph-check-circle";
                const issueDate = row.issue_date
                    ? new Date(row.issue_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : "—";

                return `
                <div class="ri-card">
                    <div class="ri-card-top">
                        <div class="ri-avatar ${roleClass}">${initials}</div>
                        <div class="ri-borrower-info">
                            <div class="ri-borrower-name">${row.borrower_name || "Unknown"}</div>
                            <span class="ri-role-badge ${roleClass}">
                                <i class="ph ${roleIcon}"></i> ${row.borrower_role || "—"}
                            </span>
                        </div>
                    </div>
                    <div class="ri-book-name">
                        <i class="ph ph-book-open"></i>
                        ${row.book_name}
                    </div>
                    <div class="ri-footer">
                        <span><i class="ph ph-calendar"></i> ${issueDate}</span>
                        <span class="ri-status ${statusClass}">
                            <i class="ph ${statusIcon}"></i> ${row.status}
                        </span>
                    </div>
                </div>`;
            }).join("");

        } catch (err) {
            console.error("Recent Issues Error:", err);
            grid.innerHTML = `<div class="ri-empty" style="color: var(--danger)">⚠ Could not load recent activity.</div>`;
        }
    }

    // Initial Load
    loadDashboardStats();
    loadRecentIssues();
});


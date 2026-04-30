// --- GLOBAL SEARCH (LIVE DROPDOWN) ---
let searchDebounce;
window.executeSearch = function() {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async () => {
        const input = document.getElementById("globalSearchInput");
        const dropdown = document.getElementById("searchResultsDropdown");
        
        if(!input || !dropdown) return;
        const query = input.value.trim();

        if (query === "") {
            dropdown.classList.add("hidden");
            dropdown.innerHTML = "";
            return;
        }

        try {
            const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
            const res = await fetch(`${API_BASE}/books?search=${encodeURIComponent(query)}`);
            const books = await res.json();

            dropdown.innerHTML = "";
            dropdown.classList.remove("hidden");

            if (books.length === 0) {
                dropdown.innerHTML = `<div style="padding: 10px; color: var(--text-muted); font-size: 13px;">No books found matching this physically.</div>`;
                return;
            }

            books.forEach(book => {
                const item = document.createElement("div");
                item.className = "search-result-item";
                item.innerHTML = `
                    <div class="s-book-info">
                        <strong>${book.book_name}</strong>
                    </div>
                    <div class="s-book-slot">
                        <i class="ph ph-map-pin"></i> Slot No: ${book.slot || "Unassigned"}
                    </div>
                `;
                dropdown.appendChild(item);
            });

        } catch (err) {
            console.error("Search Error:", err);
        }
    }, 250); // 250ms latency guard
};

// --- AUTHENTICATION & LOGOUT ---
window.logout = function() {
    localStorage.removeItem("faculty");
    localStorage.removeItem("student");
    window.location.href = "login.html";
};

// --- ESP32 CONFIG PORTAL ACCESS ---
window.openESP32Config = function() {
    let savedIP = localStorage.getItem("esp32_ip") || "";
    const ip = prompt(
        "Enter the ESP32's IP address to open its Config Portal:\n(You can find it on the LCD screen or Serial Monitor)",
        savedIP || "192.168.4.1"
    );
    if (ip && ip.trim()) {
        localStorage.setItem("esp32_ip", ip.trim());
        window.open("http://" + ip.trim(), "_blank");
    }
};

document.addEventListener("DOMContentLoaded", function() {
    // Dynamically assign logged in user to the Profile Menu
    let userData = localStorage.getItem("faculty") || localStorage.getItem("student");
    if (!userData) {
        // Mock fallback if they bypass login screen for UI testing
        userData = JSON.stringify({ name: "Demo Admin" });
    }
    const user = JSON.parse(userData);
    const adminNameEl = document.getElementById("adminName");
    if (adminNameEl && user.name) {
        adminNameEl.innerText = user.name.split(" ")[0];
    }

    // --- 1. Navbar & Menu Interactions ---
    const menuIcon = document.querySelector('.menu-icon');
    if (menuIcon) {
        menuIcon.addEventListener('click', function() {
            this.classList.toggle('active');
            document.getElementById("navMenu").classList.toggle("show");
        });
    }

    window.toggleProfile = function() {
        document.getElementById("profileMenu").classList.toggle("show");
    };

    // Close menus when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.profile')) {
            document.getElementById("profileMenu")?.classList.remove('show');
        }
    });

    window.scrollToRfid = function() {
        document.getElementById("rfid-section").scrollIntoView({ behavior: 'smooth' });
    };

    // --- Mobile Dropdown Toggle ---
    const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
    dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            this.parentElement.classList.toggle('open');
        });
    });

    // --- 2. Scroll Reveal Animations ---
    const revealElements = document.querySelectorAll('.reveal');
    const revealCb = (entries, observer) => {
        entries.forEach(entry => {
            if(entry.isIntersecting) {
                entry.target.classList.add('active');
                // Optional: stop observing once revealed
                // observer.unobserve(entry.target);
            }
        });
    };
    const observer = new IntersectionObserver(revealCb, { threshold: 0.1 });
    revealElements.forEach(el => observer.observe(el));


    // --- 3. UI Synchronization with Global RFID Engine ---
    const scannerRing = document.getElementById('scannerRing');
    const studentCard = document.getElementById('studentCard');

    if (scannerRing) {
        scannerRing.classList.add('scanning');

        // Listen for the global RFID engine to complete a transaction
        document.addEventListener('rfid-transaction-complete', (e) => {
            const data = e.detail;
            console.log("UI Sync: Transaction Complete", data);
            
            // If we have a user RFID from the transaction, refresh the UI
            if (data.user) {
                scannerRing.classList.remove('scanning');
                const cardIcon = scannerRing.querySelector('.card-icon');
                if (cardIcon) {
                    cardIcon.classList.replace('ph-identification-card', 'ph-check-circle');
                    cardIcon.style.color = 'var(--success)';
                }
                
                if (studentCard) studentCard.classList.remove('hidden');
                
                // Fetch updated book list
                fetchAndDisplayUserBooks(data.user);
            }
        });
        
        // Also listen for simple scans to update UI status (before transaction)
        if (typeof io !== "undefined") {
            const socket = io();
            socket.on("rfid-data", (data) => {
                if (data.role === "student" || data.role === "faculty") {
                    if (studentCard) {
                        studentCard.classList.remove('hidden');
                        document.getElementById('studentName').innerText = data.name;
                        document.getElementById('studentId').innerText = "Role: " + data.role.toUpperCase() + " | RFID: " + data.rfid;
                        fetchAndDisplayUserBooks(data.rfid);
                    }
                }
            });
        }

        // Helper function to fetch user books
        async function fetchAndDisplayUserBooks(rfid) {
            try {
                const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
                const res = await fetch(`${API_BASE}/student-books/${rfid}`);
                const books = await res.json();
                
                const booksList = document.getElementById('books');
                if (!booksList) return;
                
                booksList.innerHTML = "";
                
                let activeCount = 0;
                books.forEach(b => {
                    if (b.status === 'issued') {
                        activeCount++;
                        booksList.innerHTML += `<li><i class="ph ph-book"></i> ${b.title} <span>Issued: ${new Date(b.issue_date).toLocaleDateString()}</span></li>`;
                    }
                });

                if (activeCount === 0) {
                    booksList.innerHTML = `<li>No active books issued. Scan a book to issue it!</li>`;
                }
                
                const statsB = document.querySelector('.stats p:nth-child(1) b');
                if (statsB) statsB.innerText = activeCount;
            } catch (err) {
                console.error("Error fetching books:", err);
            }
        }
    }


    // --- 4. Chart.js Implementation ---
    const ctx = document.getElementById('libraryChart');
    if (ctx) {
        // Subtle colors mimicking the new theme
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = "'Outfit', sans-serif";
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Books', 'Users', 'Issued', 'Overdue'],
                datasets: [{
                    label: 'Library Stats',
                    data: [350, 120, 45, 8],
                    backgroundColor: [
                        'rgba(0, 210, 255, 0.6)', 
                        'rgba(58, 123, 213, 0.6)',
                        'rgba(255, 215, 0, 0.6)',
                        'rgba(239, 68, 68, 0.6)'
                    ],
                    borderColor: [
                        '#00d2ff',
                        '#3a7bd5',
                        '#ffd700',
                        '#ef4444'
                    ],
                    borderWidth: 1,
                    borderRadius: 6
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


    // --- 5. Three.js Background Implementation ---
    const container = document.getElementById('three-container');
    if (!container || typeof THREE === 'undefined') return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 8, 15);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const particleCount = 12000; 
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const basePositions = new Float32Array(particleCount * 3); 
    const colors = new Float32Array(particleCount * 3);

    // Using the new theme colors
    const color1 = new THREE.Color('#00d2ff'); // Cyan
    const color2 = new THREE.Color('#3a7bd5'); // Blue

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        const radius = Math.random() * 15;
        const spinAngle = radius * 0.4;
        const branchAngle = ((i % 4) / 4) * Math.PI * 2; 

        const randomX = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 2;
        const randomY = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 2;
        const randomZ = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 2;

        const x = Math.cos(branchAngle + spinAngle) * radius + randomX;
        const y = randomY; 
        const z = Math.sin(branchAngle + spinAngle) * radius + randomZ;

        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;

        basePositions[i3] = x;
        basePositions[i3 + 1] = y;
        basePositions[i3 + 2] = z;

        const mixedColor = color1.clone().lerp(color2, radius / 15);
        colors[i3] = mixedColor.r;
        colors[i3 + 1] = mixedColor.g;
        colors[i3 + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.04,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const mouse3D = new THREE.Vector3();
    let isMouseMoving = false;

    window.addEventListener('mousemove', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        isMouseMoving = true;
    });

    window.addEventListener('mouseout', () => {
        isMouseMoving = false;
    });

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        particles.rotation.y = elapsedTime * 0.05; // Slower rotation

        raycaster.setFromCamera(mouse, camera);
        raycaster.ray.intersectPlane(plane, mouse3D);

        const inverseRotation = new THREE.Euler(0, -particles.rotation.y, 0);
        const adjustedMouse3D = mouse3D.clone().applyEuler(inverseRotation);

        const posAttribute = geometry.attributes.position;
        const currentPos = posAttribute.array;

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            const baseX = basePositions[i3];
            const baseY = basePositions[i3 + 1];
            const baseZ = basePositions[i3 + 2];

            let targetX = baseX;
            let targetY = baseY;
            let targetZ = baseZ;

            if (isMouseMoving) {
                const dx = adjustedMouse3D.x - baseX;
                const dy = adjustedMouse3D.y - baseY;
                const dz = adjustedMouse3D.z - baseZ;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                const interactionRadius = 5;

                if (distance < interactionRadius) {
                    const force = (interactionRadius - distance) / interactionRadius;
                    targetX = baseX - (dx / distance) * force * 4;
                    targetY = baseY - (dy / distance) * force * 4;
                    targetZ = baseZ - (dz / distance) * force * 4;
                }
            }

            targetY += Math.sin(elapsedTime * 1.5 + baseX) * 0.15;

            currentPos[i3] += (targetX - currentPos[i3]) * 0.1;
            currentPos[i3 + 1] += (targetY - currentPos[i3 + 1]) * 0.1;
            currentPos[i3 + 2] += (targetZ - currentPos[i3 + 2]) * 0.1;
        }

        posAttribute.needsUpdate = true;
        renderer.render(scene, camera);
    }

    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});
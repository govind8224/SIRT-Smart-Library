# SIRT Smart Library - Security & Glitch Audit Report

## 🚨 Security Vulnerabilities

1. **Hardcoded Admin Credentials in Frontend**
   - **File:** `public/js/login.js` (Lines 49-60)
   - **Issue:** The admin authentication logic is handled purely on the client-side with a hardcoded username (`admin`) and password (`1111`).
   - **Impact:** Anyone can bypass the login form by inspecting the JavaScript or manually entering these credentials, gaining full access to the admin dashboard.

2. **Plaintext Passwords Stored in Database**
   - **File:** `server.js` (Lines 150-180)
   - **Issue:** The student and faculty registration endpoints (`/students/register` and `/faculty/register`) insert user passwords directly into the MySQL database without any hashing or salting.
   - **Impact:** If the database is compromised, all user passwords are exposed in plaintext.

3. **Completely Unauthenticated API Endpoints**
   - **File:** `server.js`
   - **Issue:** Critical endpoints such as `/issue-return`, `/books`, `/api/issued-books`, and the user registration routes lack authentication or authorization middleware.
   - **Impact:** An attacker can directly hit these endpoints using a tool like Postman to manipulate the database (issue/return books, delete books, create fake accounts).

4. ~~**Hardcoded WiFi Credentials in IoT Hardware**~~ ✅ **FIXED**
   - **File:** `ESP32_SmartLibrary/ESP32_SmartLibrary.ino` (Lines 26-27)
   - **Issue:** The WiFi SSID and Password were hardcoded into the ESP32 firmware, requiring code re-upload to change.
   - **Fix:** WiFi SSID and Password are now stored in flash memory and configurable from the web portal. If WiFi connection fails (e.g. hotspot password changed), the ESP32 creates its own Access Point (`SIRT-Library-Setup`) so you can connect and enter the new credentials from your phone.

5. **Insecure Data Transmission (HTTP)**
   - **File:** `ESP32_SmartLibrary/ESP32_SmartLibrary.ino`
   - **Issue:** The ESP32 communicates with the server over HTTP, meaning RFID scans and server responses are sent in plaintext over the network.
   - **Impact:** Susceptible to Packet Sniffing/Man-In-The-Middle (MITM) attacks.

6. **Permissive CORS Policy**
   - **File:** `server.js` (Line 17)
   - **Issue:** Cross-Origin Resource Sharing (CORS) is configured to allow `origin: "*"`.
   - **Impact:** Any external website can make requests to the library's API on behalf of a user.

## 🐛 Bugs and Glitches

1. ~~**Delete Book Route ID Parsing Conflict**~~ ✅ **FIXED**
   - **File:** `server.js` (Line 106 - `app.delete("/books/:identifier")`)
   - **Issue:** The code checks if the identifier `!isNaN(id)` and if so, uses it to query the database `id` field as well as `isbn` and `rfid`. Because ISBNs are numerical strings, they parse as valid numbers.
   - **Fix:** Now only treats a numeric input as a database ID if its length is less than 10 digits, preventing ISBN collisions.

2. ~~**Ephemeral Fine Calculation**~~ ✅ **FIXED**
   - **File:** `server.js` (Line 402 - `/student-fine/:rfid`)
   - **Issue:** The fine is calculated using a dynamic query that strictly enforces `return_date IS NULL`. Once a student returns an overdue book, the fine resets to `0`.
   - **Fix:** Query now uses `COALESCE(return_date, NOW())` and scans all records (not just active ones), so overdue fines persist even after the book is returned.

3. ~~**RFID & Username Conflict in Issue/Return**~~ ✅ **FIXED**
   - **File:** `server.js` (Line 324 - `/issue-return`)
   - **Issue:** The SQL used `WHERE rfid = ? OR username = ?`, allowing a user to spoof an RFID by setting their username to someone else's RFID string.
   - **Fix:** Query now strictly matches against the `rfid` column only, preventing username-based spoofing.

4. ~~**No Wireless IP Configuration (Hardware)**~~ ✅ **FIXED**
   - **File:** `ESP32_SmartLibrary/ESP32_SmartLibrary.ino`
   - **Issue:** Changing the server IP required connecting the ESP32 to a laptop via USB and typing in the Serial Monitor. This made it impossible to update the IP when running on battery/charger power.
   - **Fix:** Added a built-in **Web Configuration Portal** (port 80) on the ESP32. After boot, open `http://<ESP32-IP>` in any browser on the same WiFi to view/change the server IP wirelessly. The Serial Monitor method still works as a fallback when USB is connected.

## 🚀 Future Implementations

1. **JWT-Based Authentication & RBAC**
   - **Implementation:** Introduce JSON Web Tokens (JWT) upon successful login. Secure all API endpoints using Express middleware to verify tokens and enforce Role-Based Access Control (Admin vs. Faculty vs. Student), replacing the frontend localStorage-only checks.

2. **Secure Password Hashing**
   - **Implementation:** Integrate `bcrypt` in the Node.js backend. Hash passwords during registration and verify them against the hash during login to secure user credentials at rest.

3. ~~**Captive Portal for ESP32 WiFi Configuration**~~ ✅ **IMPLEMENTED**
   - **Implementation:** Fully implemented. The ESP32 now stores WiFi SSID/Password in flash memory and provides a web portal to change them wirelessly. If WiFi fails, it creates an AP (`SIRT-Library-Setup`) for configuration from any phone/laptop.

4. **HTTPS and Secure WebSocket Integration**
   - **Implementation:** Migrate the Node.js server to HTTPS using a reverse proxy (like Nginx) or self-signed certificates. Update the ESP32 code to use `WiFiClientSecure` to encrypt sensitive data transit over the network.

5. **Persistent Fines Management Ledger**
   - **Implementation:** Create a dedicated `fines` table in the database. When a book is returned overdue, an entry is permanently inserted into this ledger with a status of 'Unpaid', ensuring financial accountability is tracked over time.

6. **Pagination & Server-Side Search for Data Grids**
   - **Implementation:** As the library grows, fetching all books or all issued logs will degrade performance. Implement `LIMIT` and `OFFSET` pagination on the backend, and transition the frontend search to hit a server-side endpoint rather than filtering all records in the browser.

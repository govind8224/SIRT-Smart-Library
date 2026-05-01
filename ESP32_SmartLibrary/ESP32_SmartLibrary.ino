// ============================================================
//  SIRT Smart Library — ESP32 RFID Firmware
//  Hardware : ESP32 Dev Module + MFRC522 RC522 RFID
//             + I2C 16x2 LCD + LEDs + Buzzer
//
//  Flow  : Scan card → POST /rfid-scan → Parse JSON response
//          → Show result on LCD + LED + Buzzer feedback
//
//  Config : Built-in Web Portal at http://<ESP32-IP>:80
//           Open in any browser to change server IP wirelessly!
//  Server : Node.js (IP configured via web portal or Serial)
// ============================================================

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Preferences.h>

// ─────────────────────────────────────────────
//  ⚙️  CONFIGURATION  — Defaults (overridden by saved values)
// ─────────────────────────────────────────────

// 1. WiFi credentials — These are defaults, can be changed wirelessly!
String wifiSSID     = "123456789";
String wifiPassword = "00000001";

// 2. Server IP — Also changeable wirelessly!
String serverIP = "10.248.112.207";
const int SERVER_PORT = 3000;

// 3. AP Mode — ESP32 creates its own hotspot if WiFi fails
const char* AP_SSID = "SIRT-Library-Setup";
const char* AP_PASS = "library123";
bool isAPMode = false;

// ─────────────────────────────────────────────
//  📌  PIN DEFINITIONS
// ─────────────────────────────────────────────

// MFRC522 RFID — uses SPI bus
#define RFID_SS_PIN   5   // SDA / NSS  → GPIO 5
#define RFID_RST_PIN  4  // RST        → GPIO 22
// SPI is handled by ESP32 default SPI pins:
//   SCK  → GPIO 18
//   MOSI → GPIO 23
//   MISO → GPIO 19

// I2C LCD (usually address 0x27 or 0x3F)
#define LCD_I2C_ADDR  0x27
#define LCD_COLS      16
#define LCD_ROWS       2
// I2C is handled by ESP32 default I2C pins:
//   SDA  → GPIO 21
//   SCL  → GPIO 22  (shared with RST if you use GPIO22 — move RST to GPIO 4 if conflict)
//   ↑ NOTE: If you get I2C issues, change RFID_RST_PIN to 4

// LED indicators
#define LED_GREEN  26   // Success / Book / Student found
#define LED_RED    27  // Error / Unknown card
#define LED_BLUE   2  // Connecting / Scanning indicator

// Buzzer (passive or active — active buzzer works directly)
#define BUZZER_PIN 13

// ─────────────────────────────────────────────
//  🔌  HARDWARE OBJECTS
// ─────────────────────────────────────────────
MFRC522        rfid(RFID_SS_PIN, RFID_RST_PIN);
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLS, LCD_ROWS);
Preferences preferences;
WebServer configServer(80);  // Built-in web config portal on port 80

// ─────────────────────────────────────────────
//  GLOBAL STATE
// ─────────────────────────────────────────────
String lastCardUID  = "";
unsigned long lastScanTime = 0;
const unsigned long SCAN_COOLDOWN_MS = 2000; // Prevent double-reads (2 sec)

// ─────────────────────────────────────────────
//  🔔  HELPER: BUZZER TONES
// ─────────────────────────────────────────────
void beepSuccess() {
    // Two short rising beeps → OK
    tone(BUZZER_PIN, 1000, 100);
    delay(150);
    tone(BUZZER_PIN, 1400, 200);
    delay(250);
    noTone(BUZZER_PIN);
}

void beepError() {
    // One long low beep → Error
    tone(BUZZER_PIN, 400, 600);
    delay(700);
    noTone(BUZZER_PIN);
}

void beepBook() {
    // Three quick beeps → Book detected
    for (int i = 0; i < 3; i++) {
        tone(BUZZER_PIN, 1200, 80);
        delay(120);
    }
    noTone(BUZZER_PIN);
}

// ─────────────────────────────────────────────
//  💡  HELPER: LED CONTROL
// ─────────────────────────────────────────────
void setLED(int pin, bool state) {
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_RED,   LOW);
    digitalWrite(LED_BLUE,  LOW);
    if (pin >= 0) digitalWrite(pin, state ? HIGH : LOW);
}

// ─────────────────────────────────────────────
//  📟  HELPER: LCD DISPLAY
// ─────────────────────────────────────────────
void lcdShow(String line1, String line2 = "") {
    lcd.clear();
    lcd.setCursor(0, 0);
    // Truncate to 16 chars
    if (line1.length() > 16) line1 = line1.substring(0, 16);
    lcd.print(line1);
    if (line2 != "") {
        lcd.setCursor(0, 1);
        if (line2.length() > 16) line2 = line2.substring(0, 16);
        lcd.print(line2);
    }
}

// ─────────────────────────────────────────────
//  🌐  WEB CONFIG PORTAL (PASSWORD PROTECTED)
// ─────────────────────────────────────────────
// This runs a tiny web server on the ESP32 itself.
// Open http://<ESP32-IP> in any browser — requires login!
// Default: admin / sirt2026

const char* PORTAL_USER = "admin";
const char* PORTAL_PASS = "sirt2026";

bool checkAuth() {
    if (!configServer.authenticate(PORTAL_USER, PORTAL_PASS)) {
        configServer.requestAuthentication();
        return false;
    }
    return true;
}

void setupConfigPortal() {
    // Shared CSS for all pages
    String css = "<style>";
    css += "*{box-sizing:border-box;margin:0;padding:0}";
    css += "body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}";
    css += ".card{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px;max-width:420px;width:100%;box-shadow:0 25px 50px rgba(0,0,0,.5)}";
    css += "h1{font-size:20px;color:#ffd700;margin-bottom:4px}";
    css += ".sub{font-size:13px;color:#64748b;margin-bottom:24px}";
    css += ".info{background:#0f172a;border-radius:10px;padding:14px;margin-bottom:16px;font-size:14px}";
    css += ".info span{color:#38bdf8;font-weight:600}";
    css += "label{display:block;font-size:13px;color:#94a3b8;margin-bottom:6px}";
    css += "input{width:100%;padding:12px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-size:15px;outline:none;margin-bottom:14px}";
    css += "input:focus{border-color:#ffd700}";
    css += "button{width:100%;padding:12px;border:none;border-radius:8px;background:linear-gradient(135deg,#ffd700,#f59e0b);color:#0f172a;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:12px}";
    css += "button:hover{opacity:.9}";
    css += ".btn2{background:linear-gradient(135deg,#38bdf8,#3b82f6)}";
    css += "hr{border:none;border-top:1px solid #334155;margin:20px 0}";
    css += "</style>";

    // ── HOME PAGE ──
    configServer.on("/", HTTP_GET, [css]() {
        if (!checkAuth()) return;
        String ip = isAPMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();
        String mode = isAPMode ? "AP Mode (Setup)" : "Connected";

        String html = "<!DOCTYPE html><html><head>";
        html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
        html += "<title>SIRT Library - ESP32 Config</title>";
        html += css;
        html += "</head><body><div class='card'>";
        html += "<h1>SIRT Smart Library</h1>";
        html += "<p class='sub'>ESP32 Configuration Portal</p>";
        html += "<div class='info'>WiFi Status: <span>" + mode + "</span></div>";
        html += "<div class='info'>WiFi SSID: <span>" + wifiSSID + "</span></div>";
        html += "<div class='info'>ESP32 IP: <span>" + ip + "</span></div>";
        html += "<div class='info'>Server IP: <span>" + serverIP + ":" + String(SERVER_PORT) + "</span></div>";

        // WiFi Credentials Form
        html += "<hr>";
        html += "<form action='/update-wifi' method='POST'>";
        html += "<label>WiFi SSID (Hotspot Name)</label>";
        html += "<input type='text' name='ssid' placeholder='Your WiFi name' value='" + wifiSSID + "' required>";
        html += "<label>WiFi Password</label>";
        html += "<input type='password' name='pass' placeholder='Your WiFi password' value='" + wifiPassword + "' required>";
        html += "<button type='submit' class='btn2'>Save WiFi & Restart</button>";
        html += "</form>";

        // Server IP Form
        html += "<form action='/update-ip' method='POST'>";
        html += "<label>Server IP Address</label>";
        html += "<input type='text' name='ip' placeholder='e.g. 192.168.1.100' value='" + serverIP + "' required>";
        html += "<button type='submit'>Save Server IP</button>";
        html += "</form>";

        html += "</div></body></html>";
        configServer.send(200, "text/html", html);
    });

    // ── HANDLE WIFI UPDATE ──
    configServer.on("/update-wifi", HTTP_POST, []() {
        if (!checkAuth()) return;
        if (configServer.hasArg("ssid") && configServer.hasArg("pass")) {
            String newSSID = configServer.arg("ssid");
            String newPass = configServer.arg("pass");
            newSSID.trim();
            newPass.trim();

            wifiSSID = newSSID;
            wifiPassword = newPass;
            preferences.putString("wifiSSID", wifiSSID);
            preferences.putString("wifiPass", wifiPassword);

            Serial.println("📶 WiFi credentials updated: " + wifiSSID);
            lcdShow("WiFi Updated!", wifiSSID);

            String html = "<!DOCTYPE html><html><head>";
            html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
            html += "<title>WiFi Updated</title>";
            html += "<style>body{font-family:system-ui;background:#0f172a;color:#34d399;display:flex;justify-content:center;align-items:center;min-height:100vh;text-align:center}";
            html += ".box{background:#1e293b;padding:40px;border-radius:16px;border:1px solid #065f46}</style></head><body>";
            html += "<div class='box'><h2>✅ WiFi Saved!</h2>";
            html += "<p style='margin-top:12px;color:#94a3b8'>SSID: <b style='color:#ffd700'>" + wifiSSID + "</b></p>";
            html += "<p style='margin-top:12px;color:#64748b;font-size:13px'>ESP32 will restart in 3 seconds...</p>";
            html += "</div></body></html>";
            configServer.send(200, "text/html", html);

            delay(3000);
            ESP.restart();
        } else {
            configServer.send(400, "text/plain", "Missing WiFi fields.");
        }
    });

    // ── HANDLE SERVER IP UPDATE ──
    configServer.on("/update-ip", HTTP_POST, []() {
        if (!checkAuth()) return;
        if (configServer.hasArg("ip")) {
            String newIP = configServer.arg("ip");
            newIP.trim();
            if (newIP.length() > 6) {
                serverIP = newIP;
                preferences.putString("serverIP", serverIP);
                Serial.println("🌐 Server IP Updated: " + serverIP);
                lcdShow("IP Updated!", serverIP);
                delay(1500);
                lcdShow("SIRT Library", "Scan RFID Card");

                String html = "<!DOCTYPE html><html><head>";
                html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
                html += "<meta http-equiv='refresh' content='3;url=/' />";
                html += "<title>IP Updated!</title>";
                html += "<style>body{font-family:system-ui;background:#0f172a;color:#34d399;display:flex;justify-content:center;align-items:center;min-height:100vh;text-align:center}";
                html += ".box{background:#1e293b;padding:40px;border-radius:16px;border:1px solid #065f46}</style></head><body>";
                html += "<div class='box'><h2>✅ Server IP Updated!</h2>";
                html += "<p style='margin-top:12px;color:#94a3b8'>New IP: <b style='color:#ffd700'>" + serverIP + "</b></p>";
                html += "<p style='margin-top:8px;color:#64748b;font-size:13px'>Redirecting back in 3 seconds...</p>";
                html += "</div></body></html>";
                configServer.send(200, "text/html", html);
            } else {
                configServer.send(400, "text/plain", "Invalid IP address.");
            }
        } else {
            configServer.send(400, "text/plain", "Missing IP parameter.");
        }
    });

    // ── STATUS ENDPOINT ──
    configServer.on("/status", HTTP_GET, []() {
        String ip = isAPMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();
        String json = "{\"serverIP\":\"" + serverIP + "\",\"port\":" + String(SERVER_PORT) + ",\"wifi\":\"" + ip + "\",\"ssid\":\"" + wifiSSID + "\",\"apMode\":" + String(isAPMode) + ",\"uptime\":" + String(millis() / 1000) + "}";
        configServer.send(200, "application/json", json);
    });

    configServer.begin();
    Serial.println("🌐 Web Config Portal started at http://" + WiFi.localIP().toString());
}

// ─────────────────────────────────────────────
//  📡  HELPER: WiFi CONNECTION (with AP fallback)
// ─────────────────────────────────────────────
void startAPMode() {
    Serial.println("📡 Starting Access Point: " + String(AP_SSID));
    WiFi.mode(WIFI_AP);
    WiFi.softAP(AP_SSID, AP_PASS);
    isAPMode = true;
    IPAddress apIP = WiFi.softAPIP();
    Serial.println("📡 AP IP: " + apIP.toString());
    lcdShow("Connect WiFi:", AP_SSID);
    setLED(LED_RED, true);
    beepError();
    delay(2000);
    lcdShow("Open Browser:", apIP.toString());
}

void connectWiFi() {
    Serial.print("🔌 Connecting to WiFi: ");
    Serial.println(wifiSSID);

    lcdShow("Connecting WiFi", wifiSSID);
    setLED(LED_BLUE, true);

    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n✅ WiFi Connected!");
        Serial.print("📍 IP Address: ");
        Serial.println(WiFi.localIP());
        lcdShow("WiFi Connected!", WiFi.localIP().toString());
        setLED(LED_GREEN, true);
        isAPMode = false;
        beepSuccess();
        delay(2000);
    } else {
        Serial.println("\n❌ WiFi Failed! Starting AP Mode...");
        startAPMode();
    }
}

// ─────────────────────────────────────────────
//  🌐  CORE: SEND RFID TO SERVER
// ─────────────────────────────────────────────
void sendRFIDToServer(String cardUID) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("⚠️  WiFi disconnected. Reconnecting...");
        lcdShow("WiFi Lost...", "Reconnecting");
        connectWiFi();
        return;
    }

    Serial.println("📤 Sending RFID to server: " + cardUID);
    lcdShow("Scanning...", cardUID);
    setLED(LED_BLUE, true);

    // Dynamically build the URL from the server IP and port
    String targetURL = "http://" + serverIP + ":" + String(SERVER_PORT) + "/rfid-scan";
    Serial.println("🔗 Target URL: " + targetURL);

    WiFiClient client;
    HTTPClient http;
    http.begin(client, targetURL);
    http.addHeader("Content-Type", "application/json");

    // Build JSON payload — matches what server.js /rfid-scan expects
    String payload = "{\"card_id\":\"" + cardUID + "\"}";
    Serial.println("📦 Payload: " + payload);

    int httpCode = http.POST(payload);
    Serial.println("📥 HTTP Code: " + String(httpCode));

    if (httpCode == 200) {
        String response = http.getString();
        Serial.println("✅ Response: " + response);

        // Parse JSON response
        StaticJsonDocument<512> doc;
        DeserializationError error = deserializeJson(doc, response);

        if (error) {
            Serial.println("❌ JSON Parse Error: " + String(error.c_str()));
            lcdShow("Parse Error!", "Check server");
            setLED(LED_RED, true);
            beepError();
        } else {
            String message = doc["message"].as<String>();
            Serial.println("📩 Message: " + message);

            // Check what was found
            if (doc.containsKey("data")) {
                String role = doc["data"]["role"].as<String>();
                String name = doc["data"]["name"].as<String>();
                String rfid = doc["data"]["rfid"].as<String>();

                Serial.println("👤 Role: " + role);
                Serial.println("📛 Name: " + name);

                if (role == "student") {
                    // ✅ Student found
                    lcdShow("Student Found!", name);
                    setLED(LED_GREEN, true);
                    beepSuccess();
                    Serial.println("✅ Student: " + name);

                } else if (role == "faculty") {
                    // 👨‍🏫 Faculty found
                    lcdShow("Faculty Found!", name);
                    setLED(LED_GREEN, true);
                    beepSuccess();
                    Serial.println("✅ Faculty: " + name);

                } else if (role == "book") {
                    // 📚 Book found
                    lcdShow("Book Detected!", name);
                    setLED(LED_GREEN, true);
                    beepBook();
                    Serial.println("📚 Book: " + name);
                }

            } else {
                // ❌ Card not recognized
                lcdShow("Unknown Card!", cardUID);
                setLED(LED_RED, true);
                beepError();
                Serial.println("❌ Unknown Card: " + cardUID);
            }
        }

    } else if (httpCode > 0) {
        // Server returned error code
        String response = http.getString();
        Serial.println("⚠️  Server Error " + String(httpCode) + ": " + response);
        lcdShow("Server Error", "Code: " + String(httpCode));
        setLED(LED_RED, true);
        beepError();

    } else {
        // Network/connection failure
        Serial.println("❌ HTTP Request Failed! Error: " + http.errorToString(httpCode));
        lcdShow("No Connection!", "Check server IP");
        setLED(LED_RED, true);
        beepError();
    }

    http.end();

    // Reset to ready after 3 seconds
    delay(3000);
    lcdShow("SIRT Library", "Scan RFID Card");
    setLED(-1, false); // All LEDs off — ready state
}

// ─────────────────────────────────────────────
//  🚀  SETUP
// ─────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n===========================================");
    Serial.println("  SIRT Smart Library — ESP32 Booting...");
    Serial.println("===========================================");

    // Load saved settings from flash memory
    preferences.begin("library", false);
    String savedIP = preferences.getString("serverIP", "");
    if (savedIP != "") serverIP = savedIP;
    String savedSSID = preferences.getString("wifiSSID", "");
    if (savedSSID != "") wifiSSID = savedSSID;
    String savedPass = preferences.getString("wifiPass", "");
    if (savedPass != "") wifiPassword = savedPass;

    Serial.println("📂 Server IP: " + serverIP);
    Serial.println("📶 WiFi SSID: " + wifiSSID);

    // Pin setup
    pinMode(LED_GREEN, OUTPUT);
    pinMode(LED_RED,   OUTPUT);
    pinMode(LED_BLUE,  OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);

    // I2C + LCD init
    Wire.begin();                    // Default SDA=21, SCL=22
    lcd.init();
    lcd.backlight();
    lcdShow("SIRT Library", "Starting...");
    delay(1000);

    // SPI + RFID reader init
    SPI.begin();
    rfid.PCD_Init();
    Serial.println("✅ RFID Reader Initialized");

    // Show RFID firmware version
    rfid.PCD_DumpVersionToSerial();

    // Connect to WiFi (falls back to AP mode if it fails)
    connectWiFi();

    // Always start config portal — works in both WiFi and AP mode
    setupConfigPortal();
    if (isAPMode) {
        lcdShow("AP:" + String(AP_SSID), WiFi.softAPIP().toString());
        Serial.println("🌐 Connect to WiFi '" + String(AP_SSID) + "' then open http://" + WiFi.softAPIP().toString());
    } else {
        lcdShow(WiFi.localIP().toString(), "Config Portal ON");
        Serial.println("🌐 Open http://" + WiFi.localIP().toString() + " to configure");
    }
    delay(2500);

    // Ready
    lcdShow("SIRT Library", "Scan RFID Card");
    Serial.println("\n🟢 System Ready! Waiting for RFID scan...");
    Serial.println("🌐 Open http://" + WiFi.localIP().toString() + " in any browser to change server IP!\n");
}

// ─────────────────────────────────────────────
//  🔄  MAIN LOOP
// ─────────────────────────────────────────────
void loop() {

    // 1. Handle web config portal requests (works on battery — no USB needed!)
    configServer.handleClient();

    // 2. ALSO keep Serial Monitor support (for when USB IS connected)
    if (Serial.available()) {
        String input = Serial.readStringUntil('\n');
        input.trim();
        if (input.startsWith("IP:")) {
            serverIP = input.substring(3);
            preferences.putString("serverIP", serverIP);
            Serial.println("\n✅ NEW IP ADDRESS SAVED TO MEMORY: " + serverIP);
            Serial.println("🔄 ESP32 will use this IP permanently until you change it again.");
            lcdShow("IP Updated!", serverIP);
            delay(2000);
            lcdShow("SIRT Library", "Scan RFID Card");
        }
    }

    // Check WiFi — reconnect if dropped
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("⚠️  WiFi dropped. Reconnecting...");
        connectWiFi();
        return;
    }

    // Wait for a new RFID card to be present
    if (!rfid.PICC_IsNewCardPresent()) return;

    // Try to read the card serial
    if (!rfid.PICC_ReadCardSerial()) return;

    // Build UID string from raw bytes
    String cardUID = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10) cardUID += "0";
        cardUID += String(rfid.uid.uidByte[i], HEX);
        if (i < rfid.uid.size - 1) cardUID += ":";
    }
    cardUID.toUpperCase();

    Serial.println("🏷️  Card UID Detected: " + cardUID);

    // Debounce — don't re-scan the same card within cooldown window
    unsigned long now = millis();
    if (cardUID == lastCardUID && (now - lastScanTime) < SCAN_COOLDOWN_MS) {
        Serial.println("⏳ Duplicate scan ignored (cooldown active)");
        rfid.PICC_HaltA();
        rfid.PCD_StopCrypto1();
        return;
    }

    lastCardUID  = cardUID;
    lastScanTime = now;

    // Send to server
    sendRFIDToServer(cardUID);

    // Halt PICC and stop encryption
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
}

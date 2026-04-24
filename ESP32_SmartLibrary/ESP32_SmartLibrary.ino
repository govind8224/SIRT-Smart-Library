// ============================================================
//  SIRT Smart Library — ESP32 RFID Firmware
//  Hardware : ESP32 Dev Module + MFRC522 RC522 RFID
//             + I2C 16x2 LCD + LEDs + Buzzer
//
//  Flow  : Scan card → POST /rfid-scan → Parse JSON response
//          → Show result on LCD + LED + Buzzer feedback
//
//  Server : Node.js at 10.47.61.207:3000
// ============================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Preferences.h>

// ─────────────────────────────────────────────
//  ⚙️  CONFIGURATION  — CHANGE THESE TO MATCH YOUR SETUP
// ─────────────────────────────────────────────

// 1. Your WiFi credentials
const char* WIFI_SSID     = "987654321";       // e.g. "SIRT_WiFi"
const char* WIFI_PASSWORD = "999999990";   // e.g. "12345678"

// 2. Server IP — This is the default, but can be updated dynamically!
String serverIP = "10.248.112.207";
const int SERVER_PORT = 3000;

// 3. We will dynamically build the endpoint URL in the code!

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
//  📡  HELPER: WiFi CONNECTION
// ─────────────────────────────────────────────
void connectWiFi() {
    Serial.print("🔌 Connecting to WiFi: ");
    Serial.println(WIFI_SSID);

    lcdShow("Connecting WiFi", WIFI_SSID);
    setLED(LED_BLUE, true);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

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
        beepSuccess();
        delay(2000);
    } else {
        Serial.println("\n❌ WiFi Connection Failed!");
        lcdShow("WiFi FAILED!", "Check credentials");
        setLED(LED_RED, true);
        beepError();
        delay(3000);
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

    // Load saved IP from memory
    preferences.begin("library", false);
    String savedIP = preferences.getString("serverIP", "");
    if (savedIP != "") {
        serverIP = savedIP;
    }
    Serial.println("📂 Current Server IP: " + serverIP);
    Serial.println("💡 TIP: To change IP without re-uploading, type 'IP:192.168.X.X' in this Serial Monitor and press Enter!");

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

    // Connect to WiFi
    connectWiFi();

    // Ready
    lcdShow("SIRT Library", "Scan RFID Card");
    Serial.println("\n🟢 System Ready! Waiting for RFID scan...\n");
}

// ─────────────────────────────────────────────
//  🔄  MAIN LOOP
// ─────────────────────────────────────────────
void loop() {

    // 1. Check for IP updates via Serial Monitor
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

/*
 * ===================================================
 *  Lost & Found — BLE Beacon Firmware v3.0 (STABLE)
 *  Hardware: ESP32-C3 Super Mini
 * ===================================================
 *
 *  Layer 3 (App Relay): Broadcasts "LF-BLE-XXXX" name
 *    → Our app scans for "LF-BLE-" prefix
 *    → Detected by any phone running Lost & Found app
 *
 *  Layers 1 & 2 (Google FMDN / Apple Find My):
 *    → Added at Bridge Point after Software Sprint
 *      generates real cryptographic keys
 *    → Requires separate advertisement packets with
 *      rotating EIDs — not just a UUID flag
 *
 *  Board: ESP32C3 Dev Module
 *  Settings: USB CDC On Boot = Enabled
 * ===================================================
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEAdvertising.h>

// ===================================================
//  CONFIGURATION — edit per beacon
// ===================================================

// Beacon ID — MUST start with "LF-BLE-"
// Replace with the ID from your app's register-item screen
#define BEACON_NAME  "LF-BLE-518EEB"

// LED pin (confirmed working = 8 on your board)
#define LED_PIN  8

// ===================================================
//  GLOBALS
// ===================================================

BLEAdvertising* pAdvertising;
unsigned long lastBlink = 0;
uint32_t blinkCount = 0;

// ===================================================
//  SETUP
// ===================================================

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  delay(2000);

  Serial.println();
  Serial.println("===================================================");
  Serial.println("  Lost & Found Beacon v3.0");
  Serial.println("  ID: " + String(BEACON_NAME));
  Serial.println("===================================================");

  // 3 blinks = starting
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH); delay(200);
    digitalWrite(LED_PIN, LOW);  delay(200);
  }

  // Init BLE — this sets the device name in advertisements
  BLEDevice::init(BEACON_NAME);

  // Create a BLE server (makes the device connectable + scannable)
  BLEServer* pServer = BLEDevice::createServer();

  // Get advertising handle
  pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->setScanResponse(false);  // Keep packet small

  // Start broadcasting
  BLEDevice::startAdvertising();

  Serial.println("Broadcasting: " + String(BEACON_NAME));
  Serial.println("Open nRF Connect to verify.");
  Serial.println();

  // 5 rapid blinks = live
  for (int i = 0; i < 5; i++) {
    digitalWrite(LED_PIN, HIGH); delay(80);
    digitalWrite(LED_PIN, LOW);  delay(80);
  }

  lastBlink = millis();
}

// ===================================================
//  LOOP — heartbeat LED + watchdog
// ===================================================

void loop() {
  unsigned long now = millis();

  if (now - lastBlink >= 3000) {
    lastBlink = now;
    blinkCount++;

    // Single blink = alive
    digitalWrite(LED_PIN, HIGH); delay(80);
    digitalWrite(LED_PIN, LOW);

    // Status every ~30 sec
    if (blinkCount % 10 == 0) {
      unsigned long uptime = now / 1000;
      Serial.println("[" + String(uptime) + "s] " + String(BEACON_NAME) +
                     " | beats: " + String(blinkCount));

      // Watchdog: restart if advertising stopped
      if (!pAdvertising->isAdvertising()) {
        Serial.println("Restarting advertising...");
        BLEDevice::startAdvertising();
      }
    }
  }

  delay(10);
}

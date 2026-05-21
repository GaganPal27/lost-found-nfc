# 🔧 HARDWARE SPRINT — BLE Beacon Firmware Development
> **Owner:** User (Hardware) | **Status:** IN PROGRESS | **Last Updated:** 2026-04-26
> **Hardware:** ESP32-C3 Super Mini + CR2032 + USB-C cable

---

## 📍 CHECKPOINT (Resume from here)

| Step | Task | Status |
|---|---|---|
| H1 | Inventory check (ESP32 + battery + cable) | ✅ DONE |
| H2 | Install Arduino IDE on Windows | ✅ DONE |
| H3 | Install ESP32 board support + USB driver | ✅ DONE |
| H4 | Connect board + verify serial port | ✅ DONE |
| H5 | Flash "Blink" test sketch | ✅ DONE |
| H6 | Flash BLE beacon test sketch | ✅ DONE |
| H7 | Verify BLE broadcast with phone scanner | ✅ DONE |
| H8 | Flash multi-network beacon firmware (v3.0) | ✅ DONE |
| H9 | Battery power test (coin cell) | ⏸️ OPTIONAL (needs soldering) |
| H10 | Integration test with app backend | 🔴 BLOCKED → Software Sprint S12+ |

**Bridge Point:** H10 requires Software Sprint S6+ to be complete.

---

## 🛠️ STEP H2 — Install Arduino IDE

### What to do:
1. Open browser → go to **https://www.arduino.cc/en/software**
2. Click **"Windows Win 10 and newer, 64 bits"** → Download the `.exe` installer
3. Run the installer → click **Next** through all screens → click **Install**
4. When done, open **Arduino IDE** from Start Menu

### How to verify:
- Arduino IDE opens with a blank sketch showing `void setup()` and `void loop()`
- ✅ Mark H2 as DONE

---

## 🛠️ STEP H3 — Install ESP32 Board Support + USB Driver

### Part A — Add ESP32 Board URL
1. In Arduino IDE, go to **File → Preferences** (top menu bar)
2. Find the field **"Additional boards manager URLs"**
3. Paste this EXACT URL:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Click **OK**

### Part B — Install ESP32 Board Package
1. Go to **Tools → Board → Boards Manager** (or click the board icon on left sidebar)
2. In the search box, type: **esp32**
3. Find **"esp32 by Espressif Systems"**
4. Click **Install** (this downloads ~300MB, takes 2-5 minutes)
5. Wait until it says "INSTALLED" next to the package name

### Part C — USB Driver (CH340)
> Your ESP32-C3 uses a CH340 USB-to-serial chip. Windows 10/11 usually auto-installs the driver.

1. **DO NOT** plug in the ESP32 yet
2. Download CH340 driver: **https://www.wch-ic.com/downloads/CH341SER_EXE.html**
3. Run the `.exe` → click **INSTALL**
4. Restart your PC if prompted

### How to verify:
- In Arduino IDE: **Tools → Board → ESP32 Arduino** — you should see a long list of ESP32 boards
- ✅ Mark H3 as DONE

---

## 🛠️ STEP H4 — Connect Board + Verify Serial Port

### What to do:
1. Plug your **ESP32-C3 Super Mini** into your PC using the **USB-C cable**
2. The small **red LED** on the board should light up (power indicator)
3. Open **Device Manager** (press `Win + X` → select "Device Manager")
4. Expand **"Ports (COM & LPT)"**
5. You should see something like: `USB-SERIAL CH340 (COM3)` — the number may differ

### Configure Arduino IDE:
1. Go to **Tools → Board → ESP32 Arduino → ESP32C3 Dev Module**
2. Go to **Tools → Port → COM3** (or whatever number showed up)
3. Go to **Tools → USB CDC On Boot → Enabled** ← IMPORTANT!

### Troubleshooting:
| Problem | Fix |
|---|---|
| No COM port shows up | Try a different USB-C cable (some are charge-only, not data) |
| "Unknown device" in Device Manager | Re-install CH340 driver from H3-C |
| Board not listed | Re-do H3-B (ESP32 board install) |
| Multiple COM ports | Unplug the board, check which port disappears, that's the one |

### How to verify:
- You see a COM port in Device Manager
- Arduino IDE shows the correct board and port in the bottom status bar
- ✅ Mark H4 as DONE

---

## 🛠️ STEP H5 — Flash "Blink" Test Sketch

> This confirms the upload process works. The built-in LED will blink.

### What to do:
1. In Arduino IDE, delete everything in the editor and paste this code:

```cpp
// H5 - Blink Test for ESP32-C3 Super Mini
// The built-in LED is on GPIO 8
#define LED_PIN 8

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  Serial.println("ESP32-C3 Super Mini — Blink test started!");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);  // LED ON
  delay(500);
  digitalWrite(LED_PIN, LOW);   // LED OFF
  delay(500);
  Serial.println("blink!");
}
```

2. Click the **→ Upload** button (right arrow icon at top left)
3. Wait for compilation (first time takes 1-2 minutes)
4. You'll see `Connecting...` in the output console
5. If it gets stuck at `Connecting...`:
   - **Hold the BOOT button** on the ESP32 (tiny button on the board)
   - **Press and release the RESET button** (other tiny button)
   - **Release the BOOT button**
   - It should start uploading now
6. When you see `Hard resetting via RTS pin...` — upload is complete!

### How to verify:
- The **blue LED** on the board blinks on/off every 0.5 seconds
- Open **Tools → Serial Monitor**, set baud to **115200** — you should see "blink!" printed repeatedly
- ✅ Mark H5 as DONE

---

## 🛠️ STEP H6 — Flash BLE Beacon Test Sketch

> This makes your ESP32-C3 broadcast as a BLE beacon named "LF-BLE-TEST01". We'll verify it with a phone scanner.

### What to do:
1. In Arduino IDE, paste this code (replace everything):

```cpp
// H6 - BLE Beacon Test for Lost & Found NFC
// Broadcasts as "LF-BLE-TEST01" so our app can detect it

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLEAdvertising.h>

// ═══ CONFIGURATION ═══════════════════════════════════════
#define BEACON_NAME    "LF-BLE-TEST01"        // Our app looks for "LF-BLE-" prefix
#define LED_PIN        8                       // Built-in LED
#define ADV_INTERVAL   500                     // Advertising interval in ms
// ═════════════════════════════════════════════════════════

BLEAdvertising *pAdvertising;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  
  Serial.println("═══════════════════════════════════════");
  Serial.println("  Lost & Found — BLE Beacon v1.0");
  Serial.println("  Name: " + String(BEACON_NAME));
  Serial.println("═══════════════════════════════════════");

  // Initialize BLE
  BLEDevice::init(BEACON_NAME);
  
  // Create server (required for advertising)
  BLEServer *pServer = BLEDevice::createServer();
  
  // Configure advertising
  pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  
  // Set TX power to save battery (-12 dBm ≈ 10m range)
  esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_ADV, ESP_PWR_LVL_N12);
  
  // Start advertising!
  BLEDevice::startAdvertising();
  
  Serial.println("✅ BLE advertising started!");
  Serial.println("📱 Open nRF Connect on your phone to verify");
  
  // Blink LED 3 times to indicate ready
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH); delay(200);
    digitalWrite(LED_PIN, LOW);  delay(200);
  }
}

void loop() {
  // Heartbeat LED — slow pulse means beacon is alive
  digitalWrite(LED_PIN, HIGH);
  delay(100);
  digitalWrite(LED_PIN, LOW);
  delay(2900);  // 3-second cycle

  // Re-start advertising (some phones need periodic restart to see updates)
  pAdvertising->start();
  
  Serial.println("📡 Broadcasting: " + String(BEACON_NAME));
}
```

2. Click **→ Upload**
3. Wait for upload to complete

### How to verify:
- Serial Monitor shows: `✅ BLE advertising started!`
- LED blinks 3 times, then slow pulse every 3 seconds
- Continue to Step H7 for phone verification
- ✅ Mark H6 as DONE

---

## 🛠️ STEP H7 — Verify BLE Broadcast With Phone

### What to do:
1. On your **Android phone**, go to **Google Play Store**
2. Search for **"nRF Connect for Mobile"** (by Nordic Semiconductor)
3. Install it (free, ~15MB)
4. Open **nRF Connect**
5. Tap **SCAN** (top right button)
6. Wait 5-10 seconds
7. Look for a device named **"LF-BLE-TEST01"** in the list

### What you should see:
- Device name: `LF-BLE-TEST01`
- Signal strength (RSSI): around -40 to -70 dBm (depending on distance)
- If you walk away from the ESP32, the RSSI number gets more negative (weaker signal)

### Troubleshooting:
| Problem | Fix |
|---|---|
| Don't see the device | Make sure Bluetooth is ON on your phone |
| Still don't see it | Close nRF Connect, turn Bluetooth off/on, reopen, scan again |
| Shows up but wrong name | Re-upload the sketch, make sure BEACON_NAME is correct |
| Very weak signal | Move phone closer to ESP32 (within 2 meters) |

### How to verify:
- You see "LF-BLE-TEST01" in nRF Connect scanner
- Take a screenshot for your records
- ✅ Mark H7 as DONE

---

## 🛠️ STEP H8 — Flash Multi-Network Beacon Firmware

> This is the production firmware. It broadcasts THREE advertisement types in rotation (every 2 seconds):
> 1. **FMDN** (Google Find My Device — Layer 1) → detected by ~3B Android phones
> 2. **OpenHaystack** (Apple Find My — Layer 2) → detected by ~1.8B iPhones
> 3. **LF-BLE-XXXX** (our app relay — Layer 3) → detected by Lost & Found app users

### Prerequisites:
- ✅ Steps H2-H7 complete
- ✅ Firmware file created at: `firmware/beacon/beacon.ino`

### What to do:

1. In **Arduino IDE**, go to **File → Open**
2. Navigate to your project folder:
   ```
   c:\Users\7rc10\OneDrive\Desktop\poki\lost-found-nfc\firmware\beacon\beacon.ino
   ```
3. The firmware code will open in a new Arduino IDE window

4. **Review the configuration** at the top of the file:
   - `BEACON_NAME` — should be `"LF-BLE-TEST01"` for now (will match app later)
   - `FMDN_EID_KEY` — test keys (will be replaced with real keys from app)
   - `OFHA_PUBLIC_KEY` — test keys (will be replaced with real keys from app)

5. **Upload the firmware:**
   - Make sure board is still set to **ESP32C3 Dev Module** on the correct COM port
   - Hold **BOOT** button → press **RESET** → release **BOOT** (bootloader mode)
   - Click **→ Upload** button
   - Wait for compilation + upload (first time ~2 minutes)
   - After upload, press **RESET** button once

6. **Open Serial Monitor** (Tools → Serial Monitor, 115200 baud)

### What you should see in Serial Monitor:
```
═══════════════════════════════════════════════════
  Lost & Found — Multi-Network Beacon v2.0
  Beacon ID:  LF-BLE-TEST01
  Layers:     FMDN + OpenHaystack + App Relay
  Cycle:      2000ms per layer
  TX Power:   -12 dBm (~10m range)
═══════════════════════════════════════════════════

✅ Multi-network beacon started!
📡 Layer 1: FMDN advertising (Google Find My)
🍎 Layer 2: OpenHaystack advertising (Apple Find My)
📱 Layer 3: App relay advertising (LF-BLE-TEST01)
📡 Layer 1: FMDN advertising (Google Find My)
...
```

### LED Pattern Guide:
| Pattern | Meaning |
|---|---|
| 1 quick flash | Layer 1 active (FMDN / Google) |
| 2 quick flashes | Layer 2 active (OpenHaystack / Apple) |
| 3 quick flashes | Layer 3 active (App Relay / LF-BLE) |
| 5 rapid flashes | Startup complete |

### Verify with phone (nRF Connect):
1. Open **nRF Connect** on your phone
2. Tap **SCAN**
3. You should see **"LF-BLE-TEST01"** appear and disappear in cycles
   - It appears during Layer 3 (every 6 seconds for 2 seconds)
   - During Layers 1 and 2, the name disappears (different advertisement format)
4. You may also see **unnamed devices** with Apple manufacturer data — that's Layer 2!

### Troubleshooting:
| Problem | Fix |
|---|---|
| Compilation error about BLEDevice.h | Ensure ESP32 board package is installed (H3) |
| Upload fails | Use bootloader mode: hold BOOT → press RESET → release BOOT |
| Serial shows garbage characters | Set Serial Monitor baud to **115200** |
| Don't see beacon on phone | Wait 6+ seconds — Layer 3 only broadcasts 2 out of every 6 seconds |
| LED doesn't flash at all | Try changing `LED_PIN` from 8 to 3 in the firmware |

### ✅ H8 STATUS — COMPLETE (v3.0 STABLE)
- ✅ BLE hardware confirmed working
- ✅ `LF-BLE-TEST01` visible in nRF Connect (Layer 3 — App Relay)
- ✅ Heartbeat LED + serial watchdog running
- ⚠️ **Finding:** ESP32-C3 BLE ad packet = 31 bytes max.
  Adding service UUIDs or manufacturer data overflows it → kills advertising silently.
- 📌 **Layers 1 & 2 plan:** Will use time-sliced advertising (alternating packets)
  at the Bridge Point (H10) after Software Sprint generates real FMDN/OFHA crypto keys.
  Raw test keys are pointless — Google/Apple networks only respond to properly signed EIDs.
- **Next: H9 Battery test OR jump to Bridge Point (H10)**

---

## 🛠️ STEP H9 — Battery Power Test

> Test running the ESP32-C3 off the CR2032 coin cell battery.

### Prerequisite:
- H8 firmware flashed and working
- You'll need to solder the header pins (or use jumper wires) to connect:
  - **CR2032 positive (+)** → ESP32 **3V3 pin**
  - **CR2032 negative (-)** → ESP32 **GND pin**

### ⚠️ IMPORTANT: Header Pins
> Looking at your photo, the header pins are NOT soldered yet. You have two options:
> 1. **Solder them** (need soldering iron — ₹200-300 from Amazon)
> 2. **Skip soldering** — for testing, just hold jumper wires to the pin holes (works for quick tests)
> 3. **USB power** — for all development/testing, USB power is fine. Battery is only needed for final deployment.

### Status: 🔴 TODO (after H8)

---

## 🛠️ STEP H10 — Integration Test With App

> **BRIDGE POINT** 🌉 — This is where Hardware and Software sprints merge.

### Prerequisites:
- Hardware: H8 firmware flashed, broadcasting multi-network
- Software: S6+ deployed (migration, edge functions, FMDN auth)
- Both: The FMDN keys in the firmware must match the keys stored in Supabase

### Test procedure:
1. Register a BLE item in the Lost & Found app
2. App generates FMDN keys → stores in Supabase
3. Flash those keys into the ESP32 firmware (H8)
4. Walk away from the beacon with a different Android phone (no app)
5. Wait 15 minutes
6. Check the app — item location should update

### Status: 🔴 BLOCKED (needs both sprints)

---

## 📐 BOARD PINOUT REFERENCE — ESP32-C3 Super Mini

```
              USB-C Port
         ┌────────────────┐
         │  ┌──────────┐  │
         │  │  ESP32-C3 │  │
    3V3 ─┤  │  RISC-V  │  ├─ 3V3
    GND ─┤  │   Core   │  ├─ GND
    GP0 ─┤  │          │  ├─ GP10
    GP1 ─┤  │  160MHz  │  ├─ GP9
    GP2 ─┤  │          │  ├─ GP8 ← LED
    GP3 ─┤  │  BLE 5.0 │  ├─ GP7
    GP4 ─┤  │  WiFi    │  ├─ GP6
    GP5 ─┤  └──────────┘  ├─ GP5
         │                │
         │  [BOOT] [RST]  │
         └────────────────┘

    Size: 22.52mm × 18mm (tiny!)
    Voltage: 3.3V logic (5V USB input)
    LED: GPIO 8 (active LOW on some variants)
```

### Key pins for battery connection:
- **3V3** — Connect CR2032 positive (+) here
- **GND** — Connect CR2032 negative (-) here
- Do NOT connect battery to the 5V/USB pin

---

## 🎯 WHAT TO DO RIGHT NOW

1. **Download Arduino IDE** → https://www.arduino.cc/en/software
2. Follow Step H2 → H3 → H4 → H5 → H6 → H7 in order
3. **Report back** after each step (especially if something goes wrong)
4. Expected time: **30-60 minutes** for H2 through H7

> After H7 is verified, we'll proceed to H8 (production firmware) which needs coordination with the Software Sprint.

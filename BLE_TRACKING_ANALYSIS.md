# 🔍 BLE Beacon Tracking — Full Analysis & Real Solution
> **Document created:** 2026-04-18  
> **Purpose:** Exhaustive analysis of achieving app-independent BLE tracking  
> **Status:** ✅ IMPLEMENTED — All decisions approved, code shipped

---

## 📋 CURRENT PROJECT STATE

### Architecture
| Layer | Tech | Status |
|---|---|---|
| **Frontend** | React Native / Expo Router, NativeWind, Zustand | ✅ Complete |
| **Backend** | Supabase (Auth + Postgres + Edge Functions + Realtime) | ✅ Complete |
| **Payments** | RevenueCat (basic ₹Free / pro ₹99/mo / max ₹149/mo) | ✅ Complete |
| **NFC Tags** | NTAG213 stickers — programmed/linked-existing dual mode | ✅ Complete |
| **BLE Beacons** | Multi-network: FMDN + OpenHaystack + App Relay | ✅ IMPLEMENTED |

### File Map — BLE-Relevant Code
| File | Purpose | Status |
|---|---|---|
| `src/lib/ble.ts` | Background BLE scanning + relay task | ✅ Enhanced |
| `src/lib/fmdn.ts` | FMDN key generation, protocol helpers | ✅ NEW |
| `src/lib/openhaystack.ts` | OpenHaystack key generation | ✅ NEW |
| `src/lib/constants.ts` | Plan limits + NETWORK_INFO metadata | ✅ Enhanced |
| `src/app/ble-status.tsx` | Multi-network status (real data) | ✅ Rewritten |
| `src/app/item-tracking/[id].tsx` | Multi-source sighting history | ✅ Rewritten |
| `src/app/beacon-firmware.tsx` | Firmware flash guide | ✅ NEW |
| `src/app/register-item/index.tsx` | Auto FMDN/OFHA key generation | ✅ Enhanced |
| `supabase/functions/ble-location-relay/` | Multi-source relay + dedup | ✅ Enhanced |
| `supabase/functions/fmdn-poll/` | Google FMDN API poller | ✅ NEW |
| `supabase/functions/openhaystack-poll/` | Apple Find My poller | ✅ NEW |
| `supabase/migrations/005_fmdn_tracking.sql` | Multi-network schema | ✅ NEW |
| `src/stores/itemStore.ts` | Multi-network Item interface | ✅ Enhanced |

### Current BLE Flow (BROKEN)
```
BLE Beacon (broadcasts "LF-BLE-XXXX")
     ↓ only detected by...
Lost & Found App User's Phone (background BLE scan)
     ↓
POST to ble-location-relay Edge Function
     ↓
Updates item.last_seen_lat/lng + creates notification
```

**Why this is broken:** On day one, zero phones are scanning. Even at scale, only *our* app users contribute. If you lose your keys in a park and nobody nearby has our app, the beacon screams into the void.

---

## ❌ THE CORE PROBLEM

### The Requirement
> "It should work irrespective of the app users or not through their devices"

Translation: A person with a **stock Android phone** or **stock iPhone** — who has **never heard of Lost & Found** — should unknowingly relay our beacon's location via their device.

### Why This Seems Impossible
BLE beacons are radio transmitters. For a radio signal to become a location report, something must:
1. Hear the signal (BLE receiver)
2. Know its own GPS position
3. Combine beacon ID + position into a report
4. Upload that report to a server

On a stock phone, no random app can just scan BLE in the background and upload data. The OS doesn't allow it for privacy reasons.

### Why It IS Possible
**Apple and Google have already solved this at the OS level:**

| Network | Reach | How |
|---|---|---|
| **Apple Find My** | ~1.8B active iPhones/iPads | Built into iOS. Every iPhone scans for Find My-compatible BLE devices 24/7 and relays encrypted reports to Apple's servers. |
| **Google Find My Device** | ~3B active Android devices | Built into Google Play Services. Every Android phone scans for FMDN-compatible BLE devices and relays reports to Google's servers. |

**Combined: ~4.8 BILLION devices already scanning for BLE beacons 24/7.**

The trick isn't building our own network. It's making our beacons speak the language that these existing networks already understand.

---

## 🔬 EVERY APPROACH EVALUATED

### ~~Approach 1: Eddystone-URL / Physical Web~~
- Beacons broadcast a URL → Chrome showed a notification
- **KILLED by Google in December 2018** due to spam
- No modern phone responds to these broadcasts
- **VERDICT: Dead. Not viable.**

### ~~Approach 2: Our Own Relay Network (Current)~~
- Requires app users to be within BLE range (~30m)
- Zero-user cold start problem
- Even at scale, coverage will have massive gaps  
- **VERDICT: Supplementary only. Cannot be primary.**

### ~~Approach 3: Samsung SmartThings Find~~
- 500M+ Galaxy devices
- **No third-party BLE tag support** — Samsung only
- **VERDICT: Not viable.**

### ✅ Approach 4: Google Find My Device Network (FMDN) — PRIMARY
- **3 BILLION Android phones already scanning 24/7**
- Third-party hardware support via **Find Hub Accessory Specification**
- Commercial trackers (Chipolo ONE Point, Pebblebee, Moto Tag) already use this
- Community project **GoogleFindMyTools** has reverse-engineered the protocol for ESP32/nRF52
- **Our beacon just needs to broadcast FMDN-compatible advertisements**
- **VERDICT: THIS IS THE REAL SOLUTION**

### ⚠️ Approach 5: Apple Find My (OpenHaystack) — SUPPLEMENTARY
- **1.8B iPhones scanning 24/7**
- OpenHaystack = open-source reverse-engineering of Find My protocol
- Works with ESP32/nRF52 custom firmware
- **Risk: Not officially sanctioned by Apple, could break**
- **VERDICT: Powerful supplement, but legally grey**

### 📌 Approach 6: DULT Compliance — MANDATORY
- Apple + Google's "Detecting Unwanted Location Trackers" standard
- Any BLE tracker MUST be detectable by both platforms for anti-stalking
- Not a solution itself but a **compliance requirement**
- **VERDICT: Must implement regardless of approach chosen**

---

## ✅ THE REAL SOLUTION: Multi-Layer Beacon Architecture

### How It Works

```
┌─────────────────────────────────────────────────────┐
│            CUSTOM BLE BEACON HARDWARE                │
│    (ESP32-C3 / nRF52832 with multi-protocol FW)      │
│                                                       │
│   Broadcasts THREE types of advertisements:          │
│   [1] FMDN packets (Google Find My Device)           │
│   [2] OpenHaystack packets (Apple Find My)           │
│   [3] LF-BLE-XXX packets (Our app relay)             │
│   Rotates between them every ~2 seconds              │
└───────────┬───────────────┬───────────────┬──────────┘
            │               │               │
    ┌───────▼───────┐ ┌─────▼─────┐ ┌───────▼────────┐
    │   LAYER 1     │ │  LAYER 2  │ │   LAYER 3      │
    │ Google FMDN   │ │ Apple FM  │ │ Our App Relay  │
    │ 3B devices    │ │ 1.8B dev  │ │ Our users only │
    │ Stock Android │ │ Stock iOS │ │ Premium feature│
    │ NO APP NEEDED │ │ NO APP    │ │ App required   │
    └───────┬───────┘ └─────┬─────┘ └───────┬────────┘
            │               │               │
    ┌───────▼───────────────▼───────────────▼────────┐
    │             SUPABASE BACKEND                    │
    │                                                │
    │  fmdn-poll (cron) ──→ Google API ──→ decrypt  │
    │  ofha-poll (cron) ──→ Apple API ──→ decrypt   │
    │  ble-location-relay ──→ direct from our app    │
    │                                                │
    │  All three → ble_pings → item.last_seen_*     │
    │            → notifications → owner alert       │
    └────────────────────────────────────────────────┘
```

### Why This Works For Non-App Users

1. **Android user (no app):** Their phone has Google Play Services running → automatically detects FMDN beacons → uploads encrypted report to Google servers → our backend polls Google and gets the location

2. **iPhone user (no app):** Their iPhone has Find My running → automatically detects OpenHaystack-compatible beacons → uploads encrypted report to Apple servers → our backend polls Apple and gets the location

3. **Our app user:** Direct BLE relay as currently implemented → higher frequency updates → premium feature

**Result:** ~4.8 billion devices worldwide become our tracking network. Zero cold-start problem.

---

## 🛠️ IMPLEMENTATION REQUIREMENTS

### Hardware Requirements
The ₹300 Bimatix BLE beacons from IndiaMART may or may not support custom firmware flashing. Three paths:

| Path | Cost/Unit | User Effort | Reliability |
|---|---|---|---|
| **A. ESP32/nRF52 + custom firmware** | ₹200-500 | User flashes via app/web tool | High (we control firmware) |
| **B. Pre-flashed custom beacons** | ₹400-800 | Zero (we sell pre-configured) | Highest |
| **C. Commercial FMDN trackers** | ₹2000-3000 | Zero (use Chipolo/Pebblebee) | Highest (certified) |

### Backend Changes Required
1. **New migration:** `005_fmdn_tracking.sql` — key storage, multi-source reports
2. **New Edge Function:** `fmdn-poll` — polls Google FMDN API on cron
3. **New Edge Function:** `openhaystack-poll` — polls Apple Find My API
4. **Modified:** `ble-location-relay` — multi-source deduplication
5. **New:** ECC key pair management, encrypted storage

### Frontend Changes Required
1. **New:** `src/lib/fmdn.ts` — key generation, advertisement encoding
2. **Modified:** Register item flow — generate FMDN keys during beacon setup
3. **Modified:** BLE status screen — real multi-network status (not mock data)
4. **Modified:** Item tracking — multi-source sighting history
5. **Modified:** Plan constants — tier gating for network layers

### Compliance Requirements
1. **DULT compliance** — beacon must be detectable for anti-stalking alerts
2. **Privacy policy update** — disclose crowdsourced location tracking
3. **Key rotation** — periodic rotation of BLE advertisement identifiers

---

## 🤔 DECISIONS NEEDED FROM USER

### Decision 1: Hardware Path
**Which beacon hardware approach do you want?**
- A) Cheap modules + user flashes firmware
- B) We sell pre-flashed beacons  
- C) Use commercial trackers (Chipolo, etc.)

### Decision 2: API Approach
**Are you okay with the reverse-engineered Google FMDN API initially?**
- The plan would be to use GoogleFindMyTools initially, then apply for official Google certification
- Official certification requires going through Google's partner program

### Decision 3: Apple Find My (OpenHaystack)
**Include Layer 2 (Apple Find My)?**
- Pro: Adds ~1.8B iPhone devices as relays
- Con: Legally grey, could break, requires macOS proxy
- Alternative: Skip for now, focus on Google FMDN + our relay

### Decision 4: NFC as Primary Finder Interaction
**Keep NFC tags on the physical items alongside the beacon?**
- The NFC tag is the "found item" interaction: someone finds your keys, taps NFC, lands on a web page
- The BLE beacon is the "passive tracking": your keys are somewhere and you want to know where
- **Recommendation: YES, keep both. They solve different problems.**

---

## 📝 CHANGE LOG

| Date | Action | Details |
|---|---|---|
| 2026-04-18 | Created analysis document | Full codebase review, BLE research, solution architecture |
| 2026-04-18 | User approved all decisions | Path A (ESP32 firmware), reverse-engineered API, include OpenHaystack, keep NFC |
| 2026-04-18 | Created `005_fmdn_tracking.sql` | beacon_keys, fmdn_reports, openhaystack_reports, beacon_firmware_configs tables |
| 2026-04-18 | Created `src/lib/fmdn.ts` | ECC key generation, EID rotation, FMDN advertisement encoding, firmware config gen |
| 2026-04-18 | Created `src/lib/openhaystack.ts` | P-224 key generation, OpenHaystack advertisement encoding |
| 2026-04-18 | Created `fmdn-poll` Edge Function | Polls Google FMDN API, decrypts reports, updates locations, sends notifications |
| 2026-04-18 | Created `openhaystack-poll` Edge Function | Polls Apple Find My via OpenHaystack proxy, same pipeline |
| 2026-04-18 | Enhanced `ble-location-relay` Edge Function | Multi-source support, deduplication, source-attributed notifications |
| 2026-04-18 | Enhanced `src/lib/constants.ts` | NETWORK_INFO metadata, trackingNetworks per tier, updated plan descriptions |
| 2026-04-18 | Rewrote `src/app/ble-status.tsx` | Real Supabase data, per-network cards, live stats, recent sightings |
| 2026-04-18 | Rewrote `src/app/item-tracking/[id].tsx` | Multi-source timeline, source filter, color-coded map markers |
| 2026-04-18 | Created `src/app/beacon-firmware.tsx` | Hardware selection, flash instructions, network registration status |
| 2026-04-18 | Enhanced `src/app/register-item/index.tsx` | Auto FMDN + OpenHaystack key generation during BLE item registration |
| 2026-04-18 | Enhanced `src/lib/ble.ts` | Source tracking, scanForNearbyBeacons export, improved docs |
| 2026-04-18 | Enhanced `src/stores/itemStore.ts` | Added tracking_networks, fmdn_registered, openhaystack_registered fields |


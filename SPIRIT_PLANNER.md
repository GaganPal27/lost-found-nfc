# 🧭 SPIRIT PLANNER — Lost & Found NFC
> **Scrum Master Orchestration Document** | Token-Optimized | Resumable | Self-Contained
> Last Updated: 2026-04-26 | Sprint 11 (Parallel Development — HW + SW)

---

## 🔀 PARALLEL DEVELOPMENT TRACKS

> Sprint 11 runs as **two parallel tracks** that merge at the **Bridge Point** (integration test).

| Track | Document | Owner | Status |
|---|---|---|---|
| 🔧 **Hardware** | [`SPRINT_HARDWARE.md`](./SPRINT_HARDWARE.md) | User | 🔄 Step H2 — Install Arduino IDE |
| 💻 **Software** | [`SPRINT_SOFTWARE.md`](./SPRINT_SOFTWARE.md) | AI + User | ✅ Code complete, deploy pending |
| 🌉 **Bridge** | Integration test (H10 + S17) | Both | 🔴 Blocked by both tracks |

```
HARDWARE TRACK               SOFTWARE TRACK
H2 Install Arduino ──┐       S12 Deploy migration ──┐
H3 Board support     │       S13 Deploy edge fns    │
H4 Connect + verify  │       S14 Configure cron     │
H5 Blink test        │       S15 FMDN API auth      │
H6 BLE beacon test   │       S16 Build APK          │
H7 Phone verify      │                              │
H8 Multi-net FW ─────┴──→ 🌉 BRIDGE ←──────────────┘
H9 Battery test            (H10 + S17)
```

---

## 📍 PROJECT SNAPSHOT (Read This First — Avoid Full Codebase Scan)

| Property | Value |
|---|---|
| **App** | Lost & Found NFC — React Native (Expo + NativeWind/TailwindCSS) |
| **Backend** | Supabase (Auth + Postgres + Edge Functions + Realtime) |
| **Payments** | RevenueCat (3 tiers: basic/pro/max) |
| **Hardware** | ESP32-C3 Super Mini + NFC tags + CR2032 batteries |
| **Root** | `c:\Users\7rc10\OneDrive\Desktop\poki\lost-found-nfc` |
| **Design System** | Dark mode (darkBg: #0f172a, darkCard: #1e293b, primary: #06b6d4 cyan) |

---

## 🗂️ STRUCTURAL ARCHITECTURE MAP

```
lost-found-nfc/
├── src/
│   ├── app/                          # Expo Router screens
│   │   ├── _layout.tsx               ✅ Auth guard, session listener
│   │   ├── index.tsx                 ✅ Redirect entry
│   │   ├── login.tsx                 ✅ REDESIGNED - onSubmitEditing / Next Key Focus
│   │   ├── registration.tsx          ✅ REDESIGNED - onSubmitEditing / Next Key Focus
│   │   ├── forgot-password.tsx       ✅ REDESIGNED - onSubmitEditing / returnKeyType
│   │   ├── profile.tsx               ✅ REDESIGNED - plan, device, logout
│   │   ├── subscription.tsx          ✅ REDESIGNED - RevenueCat purchase flow
│   │   ├── nfc-ble-setup.tsx         ⚠️  EXISTS but needs polish review
│   │   ├── ble-status.tsx            ✅ REWRITTEN - Multi-network real data (Sprint 10)
│   │   ├── beacon-firmware.tsx       ✅ NEW - Firmware flash guide (Sprint 10)
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx           ✅ Tab bar (my-items, scan, notifications)
│   │   │   ├── my-items.tsx          ✅ REDESIGNED - FAB, plan banner, FlatList
│   │   │   ├── scan.tsx              ✅ REDESIGNED - animated NFC pulse rings
│   │   │   └── notifications.tsx     ✅ REDESIGNED - realtime, read/unread
│   │   ├── item/
│   │   │   └── [nfc_uid].tsx         ✅ Public finder page - share location
│   │   ├── item-detail/
│   │   │   └── [id].tsx              ✅ Lost mode toggle, scan history, re-program
│   │   ├── item-tracking/
│   │   │   └── [id].tsx              ✅ REWRITTEN - Multi-source sighting history (Sprint 10)
│   │   ├── register-item/
│   │   │   ├── index.tsx             ✅ ENHANCED + FMDN/OFHA key gen (Sprint 10)
│   │   │   └── write-tag.tsx         ✅ Animated NFC write / BLE beacon ID copy
│   │   └── notification/
│   │       └── [id].tsx              ✅ Share phone/location, message to finder
│   ├── components/
│   │   ├── ItemCard.tsx              ✅ ENHANCED - category icons, lost mode, teal badges
│   │   ├── TagTypeSelector.tsx       ✅ EXISTS - NFC/BLE tag picker
│   │   └── subscription/
│   │       ├── PlanSelector.tsx      ✅ EXISTS
│   │       ├── EntitlementGate.tsx   ✅ EXISTS
│   │       └── TagBuyingGuide.tsx    ✅ EXISTS
│   ├── lib/
│   │   ├── supabase.ts               ✅ Client init + safe fallback
│   │   ├── nfc.ts                    ✅ readNDEFUrl()
│   │   ├── ble.ts                    ✅ ENHANCED - Multi-network, source tracking (Sprint 10)
│   │   ├── fmdn.ts                   ✅ NEW - FMDN key gen, EID rotation (Sprint 10)
│   │   ├── openhaystack.ts           ✅ NEW - OpenHaystack key gen (Sprint 10)
│   │   ├── revenuecat.ts             ✅ Purchase wrapper
│   │   └── constants.ts             ✅ ENHANCED - NETWORK_INFO, tier networks (Sprint 10)
│   └── stores/                       # Zustand state
│       ├── authStore.ts              ✅ user, session, setSession
│       ├── itemStore.ts              ✅ ENHANCED - tracking_networks, fmdn fields (Sprint 10)
│       └── subscriptionStore.ts      ✅ tier, setTier
├── supabase/
│   ├── migrations/
│   │   ├── 001-004                   ✅ Base schema + UAT fixes
│   │   └── 005_fmdn_tracking.sql     ✅ NEW - Multi-network schema (Sprint 10)
│   └── functions/
│       ├── ble-location-relay/       ✅ ENHANCED - Multi-source + dedup (Sprint 10)
│       ├── fmdn-poll/                ✅ NEW - Google FMDN API poller (Sprint 10)
│       └── openhaystack-poll/        ✅ NEW - Apple Find My poller (Sprint 10)
├── BLE_TRACKING_ANALYSIS.md          ✅ NEW - Full research + architecture doc (Sprint 10)
├── tailwind.config.js                ✅ Custom colors defined
├── global.css                        ✅ Base styles
├── app.json                          ✅ Expo config
├── metro.config.js                   ✅ Web NativeWind config
└── .env                              ✅ Supabase keys set
```

---

## 📋 MASTER TASK REGISTRY

### 🟢 SPRINT 1-8: COMPLETED
*Core features, auth, navigation, UI polish, and Supabase reliability synchronized perfectly.*

### 🟢 SPRINT 9: UAT TESTING & DEPLOYMENT — COMPLETED
| # | Task | Status | Priority |
|---|---|---|---|
| 9.1 | Codebase Validation (`tsc --noEmit`) | ✅ PASS | HIGH |
| 9.2 | Frontend to Backend flow sync audit | ✅ PASS | HIGH |
| 9.3 | Resolve Web UI Broken Rendering | ✅ Fixed | HIGH |
| 9.4 | Add form "Enter" key submit logic | ✅ Added | HIGH |
| 9.5 | QA Android Studio Deployment | ✅ PASS | HIGH |
| 9.6 | UAT: NFC scan + notification flow | 🔴 Device Test Pending | HIGH |
| 9.7 | UAT: Plan upgrade flow via RevenueCat | 🔴 Device Test Pending | MEDIUM |
| 9.8 | Generate Production Android APK | 🔴 After UAT passes | HIGH |

### 🟢 SPRINT 10: MULTI-NETWORK BLE IMPLEMENTATION — CODE COMPLETE
*All code written. Infrastructure ready. Awaiting external dependencies for activation.*

| # | Task | Status | Priority |
|---|---|---|---|
| 10.1 | BLE research & architecture design | ✅ DONE | HIGH |
| 10.2 | Database migration `005_fmdn_tracking.sql` | ✅ DONE (needs deploy) | HIGH |
| 10.3 | FMDN protocol library `fmdn.ts` | ✅ DONE | HIGH |
| 10.4 | OpenHaystack protocol library | ✅ DONE | HIGH |
| 10.5 | `fmdn-poll` Edge Function | ✅ DONE (needs cron) | HIGH |
| 10.6 | `openhaystack-poll` Edge Function | ✅ DONE (needs proxy) | MEDIUM |
| 10.7 | Enhanced `ble-location-relay` with multi-source | ✅ DONE | HIGH |
| 10.8 | BLE status screen rewrite (real data) | ✅ DONE | HIGH |
| 10.9 | Item tracking screen rewrite (multi-source) | ✅ DONE | HIGH |
| 10.10 | Beacon firmware guide screen | ✅ DONE | MEDIUM |
| 10.11 | Registration flow + auto key generation | ✅ DONE | HIGH |
| 10.12 | Constants + store updates | ✅ DONE | HIGH |

---

### 🔄 SPRINT 11: ACTIVATION & EXTERNAL DEPENDENCIES — CURRENT

> This sprint has TWO parallel tracks: **Software (you + me)** and **Hardware (you only)**.

#### TRACK A — SOFTWARE (Our Side)

| # | Task | Owner | Blocked By | Status | Priority |
|---|---|---|---|---|---|
| 11.1 | **Run migration 005** on production Supabase | YOU | Supabase access | 🔴 TODO | ⚡ CRITICAL |
| 11.2 | **Deploy Edge Functions** (fmdn-poll, openhaystack-poll, updated ble-location-relay) | YOU | Supabase CLI setup | 🔴 TODO | ⚡ CRITICAL |
| 11.3 | **Set up pg_cron** for fmdn-poll (every 5 min) | YOU+ME | 11.1 + 11.2 | 🔴 TODO | HIGH |
| 11.4 | **Configure Google FMDN API auth** (GoogleFindMyTools or official partner) | ME+YOU | Google account, research | 🔴 TODO | ⚡ CRITICAL |
| 11.5 | **Set OPENHAYSTACK_PROXY_URL** env var (optional for now) | YOU | macOS machine + Apple ID | 🔴 OPTIONAL | LOW |
| 11.6 | **Build & deploy Android APK** with updated BLE code | ME+YOU | 11.1, 11.2 | 🔴 TODO | HIGH |
| 11.7 | **End-to-end test**: register BLE item → keys generated → beacon configured | ME+YOU | 11.1, 11.6, beacon HW | 🔴 TODO | HIGH |
| 11.8 | **DULT compliance review** (unwanted tracker detection) | ME | Research | 🔴 TODO | MEDIUM |

#### TRACK B — HARDWARE (Your Side)

| # | Task | Owner | Status | Priority |
|---|---|---|---|---|
| 11.H1 | **Order ESP32-C3 Super Mini** (×2-3 for dev/testing) | YOU | 🔴 ORDER NOW | ⚡ CRITICAL |
| 11.H2 | **Order JioTag Go** (×1-2 for reference/benchmarking) | YOU | 🔴 ORDER NOW | HIGH |
| 11.H3 | **Order CR2032 coin cell batteries** (×10 pack) | YOU | 🔴 ORDER NOW | HIGH |
| 11.H4 | **Order USB-C cable** for ESP32 flashing (if you don't have one) | YOU | 🔴 CHECK | MEDIUM |
| 11.H5 | **Receive hardware + initial power-on test** | YOU | Depends on shipping | 🔴 WAITING | HIGH |
| 11.H6 | **Flash custom firmware** to ESP32-C3 (I'll guide you step-by-step) | ME+YOU | 11.H1, 11.H5 | 🔴 TODO | ⚡ CRITICAL |

---

## 🛒 BEACON HARDWARE — WHERE TO ORDER (INDIA)

### ✅ RECOMMENDED: ESP32-C3 Super Mini (₹200-400)
> Best choice for our custom multi-network firmware. Tiny, cheap, BLE 5.0, flashable via USB-C.

| Platform | Product | Price | Link |
|---|---|---|---|
| **Robu.in** | ESP32-C3 Super Mini Dev Board | ~₹249-349 | robu.in → search "ESP32-C3 Super Mini" |
| **Probots.co.in** | ESP32-C3 SuperMini WiFi+BLE | ~₹279-399 | probots.co.in → search "ESP32-C3" |
| **Amazon.in** | ESP32-C3 Mini Development Board | ~₹299-450 | Amazon → search "ESP32-C3 Super Mini" |
| **Sharvi Electronics** | ESP32-C3 Super Mini | ~₹249 | sharvielectronics.com |
| **AliExpress** | ESP32-C3 Super Mini (bulk) | ~₹150-200 | aliexpress.com (7-15 day shipping) |

> **Order 2-3 units** — one for development, one for production testing, one backup.

### 📌 REFERENCE DEVICE: JioTag Go (₹999-1499)
> Official Google FMDN-certified tracker. Buy to benchmark against our custom solution.

| Platform | Product | Price | Link |
|---|---|---|---|
| **Amazon.in** | JioTag Go Bluetooth Tracker | ~₹999-1499 | Amazon → search "JioTag Go" |
| **Reliance Digital** | JioTag Go | ~₹1499 | reliancedigital.in |
| **JioMart** | JioTag Go | ~₹999-1299 | jiomart.com |

> **Order 1-2 units** — use to understand how a certified FMDN tracker behaves and benchmark detection speed.

### 🔋 BATTERIES & ACCESSORIES

| Item | Where | Price |
|---|---|---|
| **CR2032 coin cell** (10-pack) | Amazon.in | ~₹150-250 |
| **USB-C data cable** (for flashing) | Amazon.in | ~₹150-300 |
| **3D printed case** (optional, for ESP32) | Order from any local 3D printing service | ~₹50-100 |

### 💡 WHY NOT THE ₹300 BIMATIX BEACON (from IndiaMART)?

The generic BLE beacons from IndiaMART (the one you linked) **won't work** for Layer 1/2 because:
- They use proprietary firmware that can't be reflashed
- They only broadcast iBeacon/Eddystone, not FMDN/OpenHaystack
- They'll only work with Layer 3 (our app relay) — which defeats the purpose
- The ESP32-C3 costs the same (~₹300) and is infinitely more capable

---

## ⚡ YOUR DEPENDENCY CHECKLIST (Action Items for YOU)

### 🔴 IMMEDIATE (Do This Week)
1. **Order hardware** — ESP32-C3 Super Mini (×3) + JioTag Go (×1) + CR2032 batteries + USB-C cable
2. **Confirm Supabase project access** — I need to know you can run migrations and deploy edge functions
3. **Share your Google Developer account status** — Do you have a Google Play Developer account? (needed for eventual official FMDN certification)

### 🟡 WHEN HARDWARE ARRIVES (1-5 days after ordering)
4. **Power-on test** — Plug ESP32-C3 into USB-C, confirm your PC sees a serial port
5. **Install Arduino IDE** — Download from arduino.cc (or PlatformIO via VS Code)
6. **Install ESP32 board support** — I'll give you exact commands when the hardware arrives
7. **JioTag Go setup** — Pair with your phone via Google Find My Device app, test detection range

### 🟢 TOGETHER (When hardware + software are both ready)
8. **I build the ESP32 firmware** — Custom multi-protocol advertisement code (FMDN + OFHA + LF-BLE)
9. **We flash together** — Step-by-step via this chat
10. **End-to-end test** — Walk away from beacon, verify location appears in app within 15 min
11. **Iterate** — Tune power, range, battery life, advertisement rotation timing

### 🔵 LATER (Production Readiness)
12. **Apply for Google FMDN partner access** — Official certification for commercial use
13. **Set up OpenHaystack proxy** — Requires a macOS machine (even a Mac Mini) with Apple ID
14. **DULT compliance testing** — Verify anti-stalking alerts work on both iOS and Android
15. **Production APK build** — Final build with all multi-network features active

---

## 📊 TIMELINE ESTIMATE

| Phase | Duration | Depends On |
|---|---|---|
| Hardware ordering + delivery | 2-5 days | You ordering now |
| Arduino/firmware setup + flashing | 1-2 days | Hardware arrival |
| Migration + Edge Function deploy | 30 min | Supabase access |
| FMDN API auth configuration | 1-2 days | Research + testing |
| End-to-end testing | 2-3 days | Everything above |
| **Total to working prototype** | **~7-10 days** | **You ordering hardware TODAY** |

---

## 🤖 CRITICAL PATH

```
YOU order ESP32-C3 ──→ Hardware arrives ──→ I build firmware ──→ We flash
         │                                                         │
         ├── YOU run migration 005 on Supabase ──────────────────┤
         │                                                         │
         ├── YOU deploy edge functions ─────────────────────────┤
         │                                                         │
         └── I configure FMDN API auth ────────────────────────┤
                                                                    │
                                                              END-TO-END TEST
                                                              (≈ 7-10 days)
```

**Bottleneck: Hardware delivery.** Everything else can be done in parallel while you wait for the ESP32-C3 to arrive.

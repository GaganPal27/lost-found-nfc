# 🧭 SPIRIT PLANNER — Lost & Found NFC
> **Scrum Master Orchestration Document** | Token-Optimized | Resumable | Self-Contained
> Last Updated: 2026-04-08 | Sprint 9 (UAT Testing)

---

## 📍 PROJECT SNAPSHOT (Read This First — Avoid Full Codebase Scan)

| Property | Value |
|---|---|
| **App** | Lost & Found NFC — React Native (Expo + NativeWind/TailwindCSS) |
| **Backend** | Supabase (Auth + Postgres + Edge Functions + Realtime) |
| **Payments** | RevenueCat (3 tiers: basic/pro/max) |
| **Hardware** | NFC tags + BLE beacons |
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
│   │   ├── ble-status.tsx            ⚠️  EXISTS but needs polish review
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx           ✅ Tab bar (my-items, scan, notifications)
│   │   │   ├── my-items.tsx          ✅ REDESIGNED - FAB, plan banner, FlatList
│   │   │   ├── scan.tsx              ✅ REDESIGNED - animated NFC pulse rings
│   │   │   └── notifications.tsx     ✅ REDESIGNED - realtime, read/unread
│   │   ├── item/
│   │   │   └── [nfc_uid].tsx         ✅ Public finder page - share location
│   │   ├── item-detail/
│   │   │   └── [id].tsx              ✅ Lost mode toggle, scan history, re-program
│   │   ├── register-item/
│   │   │   ├── index.tsx             ✅ REDESIGNED + real image picker (expo-image-picker)
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
│   │   ├── ble.ts                    ✅ BLE scanning
│   │   ├── revenuecat.ts             ✅ Purchase wrapper
│   │   └── constants.ts             ✅ PLAN_LIMITS config
│   └── stores/                       # Zustand state
│       ├── authStore.ts              ✅ user, session, setSession
│       ├── itemStore.ts              ✅ items, fetchMyItems, subscribeToItems
│       └── subscriptionStore.ts      ✅ tier, setTier
├── supabase/
│   ├── migrations/                   ✅ DB schema + UAT fixes implemented
│   └── functions/
│       └── ble-location-relay/       ✅ Edge function for BLE relay
├── tailwind.config.js                ✅ Custom colors defined
├── global.css                        ✅ Base styles
├── app.json                          ✅ Expo config
├── metro.config.js                   ✅ Web NativeWind config (Added to fix web UI)
└── .env                              ✅ Supabase keys set
```

---

## 📋 MASTER TASK REGISTRY

### 🟢 SPRINT 1-8: COMPLETED
*Core features, auth, navigation, UI polish, and Supabase reliability synchronized perfectly.*

### 🔄 SPRINT 9: UAT TESTING & DEPLOYMENT — IN PROGRESS
| # | Task | Status | Priority |
|---|---|---|---|
| 9.1 | Codebase Validation (`tsc --noEmit`) | ✅ PASS - Zero errors | HIGH |
| 9.2 | Frontend to Backend flow synchronization audit | ✅ PASS - DB & Stores mapped | HIGH |
| 9.3 | Resolve Web UI Broken Rendering | ✅ Fixed (Missing metro.config.js) | HIGH |
| 9.4 | Add form "Enter" key submit logic | ✅ Added to Auth Screens | HIGH |
| 9.5 | **QA ANDROID STUDIO DEPLOYMENT** | 🔄 In Progress | HIGH |
| 9.6 | UAT: NFC scan + notification flow | 🔴 Pending Device Test | HIGH |
| 9.7 | UAT: Plan upgrade flow via RevenueCat | 🔴 Pending Device Test | MEDIUM |
| 9.8 | Generate Production Android APK (EAS Build) | 🔴 After Android Studio passes | HIGH |

---

## 🤖 QA ANDROID DEPLOYMENT ACTION REQUIRED

The developer is currently testing via the Web port (`localhost:8081`), but Native Components like NativeWind, ImagePicker, NFC Manager, and BLE scanning often behave unpredictably on Web because they require native iOS/Android compilation bindings.

**To test like an actual Android QA tester:**
1. You must restart the bundler with `npx expo start -c` to clear the cache (this will immediately fix the unstyled Web view).
2. To fully test standard native features (like NFC and hardware), open up Android Studio or run `npx expo run:android`. 
3. Run through: Sign-Up, Register Item, Upload Image.

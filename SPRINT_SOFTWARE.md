# 💻 SOFTWARE SPRINT — Multi-Network BLE Backend & App
> **Owner:** AI + User | **Status:** CODE COMPLETE, DEPLOY PENDING | **Last Updated:** 2026-04-26
> **Stack:** Supabase (Postgres + Edge Functions) + React Native (Expo)

---

## 📍 CHECKPOINT (Resume from here)

| Step | Task | Status | Blocked By |
|---|---|---|---|
| S1 | Database migration `005_fmdn_tracking.sql` | ✅ CODE DONE | — |
| S2 | FMDN protocol library `src/lib/fmdn.ts` | ✅ CODE DONE | — |
| S3 | OpenHaystack library `src/lib/openhaystack.ts` | ✅ CODE DONE | — |
| S4 | Edge Function: `fmdn-poll` | ✅ CODE DONE | — |
| S5 | Edge Function: `openhaystack-poll` | ✅ CODE DONE | — |
| S6 | Edge Function: `ble-location-relay` (enhanced) | ✅ CODE DONE | — |
| S7 | BLE status screen rewrite | ✅ CODE DONE | — |
| S8 | Item tracking screen rewrite | ✅ CODE DONE | — |
| S9 | Beacon firmware screen | ✅ CODE DONE | — |
| S10 | Registration flow + key generation | ✅ CODE DONE | — |
| S11 | Constants + stores updated | ✅ CODE DONE | — |
| S12 | **Deploy migration to Supabase** | ✅ DEPLOYED | — |
| S13 | **Deploy edge functions** (×3) | ✅ DEPLOYED | — |
| S14 | **Configure pg_cron** (5-min polling) | ⏸️ DEFERRED | FMDN API not ready yet |
| S15 | **FMDN API auth setup** | 🔴 TODO | Research + Google account |
| S16 | **Build Android APK** with new code | ✅ BUILT | — |
| S17 | **End-to-end app test** | 🔴 TODO ← NEXT | S16 + Hardware H8 ✅ |

**Bridge Point:** S17 requires Hardware Sprint H8+ to be complete.

---

## 📁 FILES CREATED/MODIFIED (Sprint 10)

### New Files
| File | Purpose |
|---|---|
| `supabase/migrations/005_fmdn_tracking.sql` | Schema: beacon_keys, fmdn_reports, openhaystack_reports, firmware_configs |
| `src/lib/fmdn.ts` | FMDN key generation, EID rotation, firmware config builder |
| `src/lib/openhaystack.ts` | OpenHaystack P-224 key generation |
| `supabase/functions/fmdn-poll/index.ts` | Google FMDN API poller (cron-triggered) |
| `supabase/functions/openhaystack-poll/index.ts` | Apple Find My poller (cron-triggered) |
| `src/app/beacon-firmware.tsx` | Firmware flash guide screen |

### Modified Files
| File | Changes |
|---|---|
| `supabase/functions/ble-location-relay/index.ts` | Multi-source + dedup + source-attributed notifications |
| `src/lib/constants.ts` | NETWORK_INFO metadata, trackingNetworks per tier |
| `src/lib/ble.ts` | Source tracking, scanForNearbyBeacons export |
| `src/app/ble-status.tsx` | Full rewrite — real Supabase data, per-network cards |
| `src/app/item-tracking/[id].tsx` | Full rewrite — multi-source timeline, source filter |
| `src/app/register-item/index.tsx` | Auto FMDN + OpenHaystack key gen on BLE item creation |
| `src/stores/itemStore.ts` | tracking_networks, fmdn_registered, last_seen_source fields |

---

## 🔄 DEPLOYMENT STEPS (S12-S16)

### S12 — Deploy Migration
```bash
# From project root, with Supabase CLI installed:
supabase db push
# OR run the SQL manually in Supabase Dashboard → SQL Editor:
# Copy contents of supabase/migrations/005_fmdn_tracking.sql → paste → Run
```

### S13 — Deploy Edge Functions
```bash
supabase functions deploy ble-location-relay
supabase functions deploy fmdn-poll
supabase functions deploy openhaystack-poll
```

### S14 — Configure pg_cron
```sql
-- In Supabase SQL Editor, enable pg_cron then add:
SELECT cron.schedule(
  'fmdn-poll-5min',
  '*/5 * * * *',
  $$SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/fmdn-poll',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'
  )$$
);
```

### S15 — FMDN API Auth
- Research GoogleFindMyTools reverse-engineered API
- Configure OAuth2 credentials
- Set env vars on Supabase Edge Functions

### S16 — Build APK
```bash
npx expo run:android
# OR for production:
eas build --platform android --profile production
```

---

## 🌉 BRIDGE DEPENDENCIES (Software ↔ Hardware)

| Software Needs From Hardware | Hardware Needs From Software |
|---|---|
| Beacon MAC address (from H7) | FMDN key pair (from S10/S12) |
| Confirmation of BLE broadcast range | Firmware config blob (from S10/S12) |
| Battery life data (from H9) | Edge function polling active (from S13/S14) |

### Integration Handshake (S17 + H10):
1. User registers BLE item in app → app generates FMDN/OFHA keys → stores in Supabase
2. User copies key config from beacon-firmware screen → pastes into Arduino sketch
3. User flashes firmware → beacon starts broadcasting
4. Nearby Android phones relay signal → fmdn-poll picks it up → app shows location

---

## 📊 TIER GATING SUMMARY

| Tier | Monthly | BLE | Networks | Items |
|---|---|---|---|---|
| Basic | Free | ❌ | — | 5 |
| Pro | ₹99 | ✅ | FMDN + App Relay | 15 |
| Max | ₹149 | ✅ | FMDN + OpenHaystack + App Relay | ∞ |

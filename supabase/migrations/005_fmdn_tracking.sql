-- ============================================================
-- Migration 005: Multi-Network BLE Tracking
-- Google Find My Device Network (FMDN) + OpenHaystack (Apple Find My)
-- + Enhanced relay tracking with multi-source support
-- Safe to run multiple times (idempotent)
-- ============================================================

-- -------------------------------------------------------
-- 1. Beacon Keys — stores ECC key pairs for FMDN & OpenHaystack
--    Each item with a BLE beacon gets key pairs for each network
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS beacon_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  network         TEXT NOT NULL,           -- 'fmdn' | 'openhaystack' | 'app_relay'
  public_key      TEXT NOT NULL,           -- Base64-encoded ECC public key
  private_key     TEXT NOT NULL,           -- Base64-encoded ECC private key (encrypted at rest via Supabase)
  identity_key    TEXT,                    -- FMDN identity key (for EID rotation)
  current_eid     TEXT,                    -- Current Ephemeral Identifier being broadcast
  eid_rotated_at  TIMESTAMPTZ,            -- When the EID was last rotated
  registered_at   TIMESTAMPTZ DEFAULT now(),
  is_active       BOOLEAN DEFAULT true,
  CONSTRAINT beacon_keys_item_network_unique UNIQUE (item_id, network)
);

ALTER TABLE beacon_keys ENABLE ROW LEVEL SECURITY;

-- Owner can manage their beacon keys
DROP POLICY IF EXISTS "beacon_keys_owner" ON beacon_keys;
CREATE POLICY "beacon_keys_owner" ON beacon_keys
  USING (
    item_id IN (
      SELECT id FROM items
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Service role can read all (for edge functions)
-- (Edge functions use service role key, bypassing RLS)

-- -------------------------------------------------------
-- 2. FMDN Reports — raw location reports from Google FMDN
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS fmdn_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beacon_key_id   UUID REFERENCES beacon_keys(id) ON DELETE CASCADE,
  item_id         UUID REFERENCES items(id) ON DELETE CASCADE,
  encrypted_location BYTEA,               -- Raw encrypted report from Google
  lat             DOUBLE PRECISION,        -- Decrypted latitude
  lng             DOUBLE PRECISION,        -- Decrypted longitude
  accuracy_metres INTEGER,
  report_timestamp TIMESTAMPTZ,           -- When the sighting occurred (from report)
  fetched_at      TIMESTAMPTZ DEFAULT now(),
  relay_device_type TEXT DEFAULT 'android' -- 'android' (FMDN)
);

ALTER TABLE fmdn_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fmdn_reports_owner" ON fmdn_reports;
CREATE POLICY "fmdn_reports_owner" ON fmdn_reports FOR SELECT
  USING (
    item_id IN (
      SELECT id FROM items
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- -------------------------------------------------------
-- 3. OpenHaystack Reports — raw location reports from Apple Find My
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS openhaystack_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beacon_key_id   UUID REFERENCES beacon_keys(id) ON DELETE CASCADE,
  item_id         UUID REFERENCES items(id) ON DELETE CASCADE,
  encrypted_location BYTEA,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  accuracy_metres INTEGER,
  report_timestamp TIMESTAMPTZ,
  fetched_at      TIMESTAMPTZ DEFAULT now(),
  relay_device_type TEXT DEFAULT 'ios'     -- 'ios' (Apple Find My)
);

ALTER TABLE openhaystack_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ofha_reports_owner" ON openhaystack_reports;
CREATE POLICY "ofha_reports_owner" ON openhaystack_reports FOR SELECT
  USING (
    item_id IN (
      SELECT id FROM items
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- -------------------------------------------------------
-- 4. Enhance ble_pings with source tracking
-- -------------------------------------------------------
ALTER TABLE ble_pings ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'app_relay';
-- source: 'app_relay' | 'fmdn' | 'openhaystack'

ALTER TABLE ble_pings ADD COLUMN IF NOT EXISTS report_id UUID;
-- References the raw report ID from fmdn_reports or openhaystack_reports

-- -------------------------------------------------------
-- 5. Enhanced items table for multi-network tracking
-- -------------------------------------------------------
ALTER TABLE items ADD COLUMN IF NOT EXISTS tracking_networks JSONB DEFAULT '[]';
-- e.g. ["app_relay", "fmdn", "openhaystack"]

ALTER TABLE items ADD COLUMN IF NOT EXISTS fmdn_registered BOOLEAN DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS openhaystack_registered BOOLEAN DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS last_seen_source TEXT;
-- Tracks which network provided the most recent location

-- -------------------------------------------------------
-- 6. Beacon firmware configs — stores firmware flash data
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS beacon_firmware_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  firmware_payload TEXT NOT NULL,          -- Base64-encoded firmware configuration blob
  hardware_type   TEXT NOT NULL,           -- 'esp32_c3' | 'nrf52832' | 'nrf52840' | 'generic_ble'
  flash_status    TEXT DEFAULT 'pending',  -- 'pending' | 'flashed' | 'verified'
  created_at      TIMESTAMPTZ DEFAULT now(),
  flashed_at      TIMESTAMPTZ,
  CONSTRAINT firmware_config_item_unique UNIQUE (item_id)
);

ALTER TABLE beacon_firmware_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "firmware_owner" ON beacon_firmware_configs;
CREATE POLICY "firmware_owner" ON beacon_firmware_configs
  USING (
    item_id IN (
      SELECT id FROM items
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- -------------------------------------------------------
-- 7. Indexes for performance
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_beacon_keys_item     ON beacon_keys(item_id);
CREATE INDEX IF NOT EXISTS idx_beacon_keys_network  ON beacon_keys(network);
CREATE INDEX IF NOT EXISTS idx_beacon_keys_eid      ON beacon_keys(current_eid);
CREATE INDEX IF NOT EXISTS idx_fmdn_reports_item    ON fmdn_reports(item_id);
CREATE INDEX IF NOT EXISTS idx_fmdn_reports_beacon  ON fmdn_reports(beacon_key_id);
CREATE INDEX IF NOT EXISTS idx_fmdn_reports_ts      ON fmdn_reports(report_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ofha_reports_item    ON openhaystack_reports(item_id);
CREATE INDEX IF NOT EXISTS idx_ofha_reports_beacon  ON openhaystack_reports(beacon_key_id);
CREATE INDEX IF NOT EXISTS idx_ofha_reports_ts      ON openhaystack_reports(report_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ble_pings_source     ON ble_pings(source);
CREATE INDEX IF NOT EXISTS idx_firmware_item        ON beacon_firmware_configs(item_id);

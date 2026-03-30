-- ENUMS
CREATE TYPE user_role         AS ENUM ('student', 'admin', 'public_user');
CREATE TYPE subscription_tier AS ENUM ('basic', 'pro', 'max');
CREATE TYPE item_status       AS ENUM ('active', 'lost', 'found', 'deleted');
CREATE TYPE tag_type          AS ENUM ('nfc_only', 'nfc_ble', 'ble_only');
CREATE TYPE notif_type        AS ENUM ('nfc_tap', 'ble_location', 'message');

-- TABLES

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name         TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  role              user_role NOT NULL DEFAULT 'student',
  university        TEXT,
  subscription_tier subscription_tier NOT NULL DEFAULT 'basic',
  revenuecat_id     TEXT,              -- RevenueCat appUserID
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  item_name       TEXT NOT NULL,
  category        TEXT NOT NULL,
  color           TEXT,
  description     TEXT,
  image_url       TEXT,
  nfc_uid         TEXT UNIQUE,        -- UUID written to NFC tag (nullable for BLE-only)
  ble_beacon_id   TEXT UNIQUE,        -- BLE beacon ID (nullable for NFC-only)
  tag_type        tag_type NOT NULL DEFAULT 'nfc_only',
  status          item_status DEFAULT 'active',
  last_seen_lat   DOUBLE PRECISION,   -- updated by BLE pings
  last_seen_lng   DOUBLE PRECISION,
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT must_have_id CHECK (nfc_uid IS NOT NULL OR ble_beacon_id IS NOT NULL)
);

CREATE TABLE nfc_scans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfc_uid          TEXT NOT NULL REFERENCES items(nfc_uid),
  scanner_user_id  UUID REFERENCES users(id),  -- nullable = anonymous
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  location_label   TEXT,              -- reverse geocoded area name
  scanned_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ble_pings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beacon_id        TEXT NOT NULL,     -- matches items.ble_beacon_id
  lat              DOUBLE PRECISION NOT NULL,
  lng              DOUBLE PRECISION NOT NULL,
  accuracy_metres  INTEGER,
  relay_app_version TEXT,
  pinged_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        notif_type NOT NULL,
  message     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',    -- { lat, lng, item_name, location_label }
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- INDEXES
CREATE INDEX idx_items_user        ON items(user_id);
CREATE INDEX idx_items_nfc_uid     ON items(nfc_uid);
CREATE INDEX idx_items_ble_beacon  ON items(ble_beacon_id);
CREATE INDEX idx_items_status      ON items(status);
CREATE INDEX idx_scans_nfc_uid     ON nfc_scans(nfc_uid);
CREATE INDEX idx_ble_beacon_id     ON ble_pings(beacon_id);
CREATE INDEX idx_ble_pinged_at     ON ble_pings(pinged_at DESC);
CREATE INDEX idx_notif_user_unread ON notifications(user_id, is_read);

-- RLS
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfc_scans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ble_pings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "own_user" ON users USING (auth.uid() = auth_id);

CREATE POLICY "items_owner_write" ON items FOR ALL
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "items_public_read" ON items FOR SELECT
  USING (status != 'deleted');

CREATE POLICY "scans_public_insert" ON nfc_scans FOR INSERT WITH CHECK (true);
CREATE POLICY "scans_owner_read" ON nfc_scans FOR SELECT
  USING (nfc_uid IN (SELECT nfc_uid FROM items
    WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())));

-- ble_pings: insert only via edge function (service role), no direct client access
CREATE POLICY "ble_no_direct_access" ON ble_pings USING (false);

CREATE POLICY "notif_own" ON notifications
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

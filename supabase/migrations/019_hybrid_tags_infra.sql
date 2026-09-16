-- =============================================================================
-- Migration 019: Hybrid QR + NFC Tag Infrastructure
--
-- Creates:
--   • tags_pool       — pre-generated QR IDs, unclaimed → claimed lifecycle
--   • tag_orders      — records of physical tag orders (v1: simple, manual fulfil)
--   • items.qr_id     — links each item back to its pool entry
--   • claim_tag_and_create_item() — atomic RPC: claim + insert in one transaction
--   • fn_reset_tag_on_item_delete() — trigger: resets tag to unclaimed on item delete
-- =============================================================================

-- ── 1. ENUM ──────────────────────────────────────────────────────────────────
CREATE TYPE tag_pool_status AS ENUM ('unclaimed', 'claimed');

-- ── 2. tags_pool ─────────────────────────────────────────────────────────────
CREATE TABLE tags_pool (
  qr_id       TEXT PRIMARY KEY,            -- e.g. 'KEEP-AB2C3D4E'
  batch_id    TEXT,                        -- e.g. 'BATCH-2026-09'
  status      tag_pool_status NOT NULL DEFAULT 'unclaimed',
  -- The BEFORE DELETE trigger fires first and resets status + claimed_by.
  -- ON DELETE SET NULL is a defence-in-depth safety net in case the trigger
  -- is ever dropped — keeps referential integrity even in that edge case.
  claimed_by  UUID REFERENCES items(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tags_pool_status ON tags_pool(status);

-- ── 3. tag_orders ─────────────────────────────────────────────────────────────
CREATE TABLE tag_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_email      TEXT NOT NULL,
  buyer_name       TEXT,
  shipping_address TEXT NOT NULL,
  quantity         INTEGER NOT NULL DEFAULT 1,
  qr_ids           TEXT[],                 -- assigned when packing; NULL until shipped
  status           TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'shipped'
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. Add qr_id to items ────────────────────────────────────────────────────
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS qr_id TEXT UNIQUE REFERENCES tags_pool(qr_id);

-- ── 5. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE tags_pool  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_orders ENABLE ROW LEVEL SECURITY;

-- tags_pool: anyone can SELECT (needed to validate a QR before registration)
-- No INSERT/UPDATE/DELETE for client sessions — all writes via SECURITY DEFINER RPCs.
CREATE POLICY "tags_pool_public_read"
  ON tags_pool FOR SELECT USING (true);

-- tag_orders: a buyer can read their own orders by email
CREATE POLICY "orders_owner_read"
  ON tag_orders FOR SELECT
  USING (buyer_email = auth.jwt()->>'email');

-- ── 6. Atomic claim RPC ───────────────────────────────────────────────────────
-- Marks a tag as claimed, inserts the item, and back-links the pool row —
-- all in a single transaction. This is the ONLY path that can claim a tag.
--
-- Security: p_user_id is intentionally absent. The function resolves the
-- caller's profile ID from auth.uid() (the JWT) so there is no client-
-- supplied parameter that can be forged to create items under another account.
CREATE OR REPLACE FUNCTION claim_tag_and_create_item(
  p_qr_id         TEXT,
  p_item_name     TEXT,
  p_category      TEXT,
  p_color         TEXT       DEFAULT NULL,
  p_description   TEXT       DEFAULT NULL,
  p_image_url     TEXT       DEFAULT NULL,
  p_tag_type      TEXT       DEFAULT 'nfc_only',
  p_ble_beacon_id TEXT       DEFAULT NULL,
  p_service_uuid  TEXT       DEFAULT NULL
)
RETURNS UUID          -- returns the new item's id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id    UUID;
  v_profile_id UUID;
BEGIN
  -- ① Resolve caller's profile from JWT — never trust a client-supplied user id.
  SELECT id INTO v_profile_id
  FROM users
  WHERE auth_id = auth.uid();

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED'
      USING HINT = 'Must be logged in to register a tag.';
  END IF;

  -- ② Atomic claim: UPDATE succeeds only if status = 'unclaimed'.
  --    If two concurrent callers race on the same QR code, only one UPDATE
  --    wins (Postgres row-level locking); the other gets NOT FOUND → clean error.
  UPDATE tags_pool
  SET    status = 'claimed'
  WHERE  qr_id = p_qr_id
    AND  status = 'unclaimed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAG_ALREADY_CLAIMED'
      USING HINT = 'This QR code is already registered or does not exist.';
  END IF;

  -- ③ Insert the item using the verified profile id.
  --    nfc_uid is intentionally NULL here — write-tag.tsx fills it after the
  --    physical NFC tap, which is a separate async step.
  INSERT INTO items (
    user_id, item_name, category, color, description,
    image_url, qr_id, tag_type, ble_beacon_id, service_uuid, status
  ) VALUES (
    v_profile_id, p_item_name, p_category, p_color, p_description,
    p_image_url, p_qr_id, p_tag_type::tag_type, p_ble_beacon_id, p_service_uuid, 'active'
  )
  RETURNING id INTO v_item_id;

  -- ④ Back-link pool row to the item for admin visibility.
  UPDATE tags_pool
  SET    claimed_by = v_item_id
  WHERE  qr_id = p_qr_id;

  RETURN v_item_id;
END;
$$;

-- ── 7. Orphan-prevention trigger ─────────────────────────────────────────────
-- When an item is deleted (directly OR via cascade when a user account is
-- deleted), reset the linked tags_pool row so the physical tag can be reused.
-- BEFORE DELETE gives us access to OLD.qr_id before the row disappears.
-- Fires per-row regardless of why the delete happened (direct / cascading).
CREATE OR REPLACE FUNCTION fn_reset_tag_on_item_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.qr_id IS NOT NULL THEN
    UPDATE tags_pool
    SET    status     = 'unclaimed',
           claimed_by = NULL
    WHERE  qr_id = OLD.qr_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_reset_tag_on_item_delete
  BEFORE DELETE ON items
  FOR EACH ROW
  EXECUTE FUNCTION fn_reset_tag_on_item_delete();

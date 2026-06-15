-- Sprint 1: BLE Service UUID support
-- Each BLE beacon advertises a unique 128-bit Service UUID
-- derived from its beacon_id. This allows detection even when
-- the device name is not visible (e.g. iOS background scanning).

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS service_uuid TEXT;

-- Unique constraint so two items can't share a UUID
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_service_uuid
  ON items (service_uuid)
  WHERE service_uuid IS NOT NULL;

COMMENT ON COLUMN items.service_uuid IS
  'Custom 128-bit BLE Service UUID advertised by this beacon. Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx. Derived deterministically from ble_beacon_id.';

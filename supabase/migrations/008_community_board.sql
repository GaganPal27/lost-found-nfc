-- Enum for community post status
DO $$ BEGIN
  CREATE TYPE community_status AS ENUM ('open', 'claimed', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Main community found-items board
CREATE TABLE IF NOT EXISTS community_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finder_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  description           TEXT,
  category              TEXT NOT NULL DEFAULT 'Other',
  location_found_lat    DOUBLE PRECISION,
  location_found_lng    DOUBLE PRECISION,
  location_label        TEXT,           -- reverse-geocoded, human readable
  image_url             TEXT,
  status                community_status NOT NULL DEFAULT 'open',
  proof_question        TEXT NOT NULL,  -- e.g. "What color is the wallet?"
  created_at            TIMESTAMPTZ DEFAULT now(),
  expires_at            TIMESTAMPTZ DEFAULT now() + INTERVAL '30 days'
);

-- Claims made by potential owners
CREATE TABLE IF NOT EXISTS community_claims (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_item_id   UUID NOT NULL REFERENCES community_items(id) ON DELETE CASCADE,
  claimant_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proof_answer        TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending', -- pending / approved / rejected
  created_at          TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_claimant_item UNIQUE (community_item_id, claimant_id)
);

-- Link conversations to community items if needed
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS community_item_id UUID REFERENCES community_items(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE community_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_claims ENABLE ROW LEVEL SECURITY;

-- Policies for community_items
DROP POLICY IF EXISTS "community_items_public_read" ON community_items;
CREATE POLICY "community_items_public_read" ON community_items
  FOR SELECT USING (status != 'closed');

DROP POLICY IF EXISTS "community_items_finder_insert" ON community_items;
CREATE POLICY "community_items_finder_insert" ON community_items
  FOR INSERT WITH CHECK (
    finder_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "community_items_finder_update" ON community_items;
CREATE POLICY "community_items_finder_update" ON community_items
  FOR UPDATE USING (
    finder_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- Policies for community_claims
DROP POLICY IF EXISTS "community_claims_insert" ON community_claims;
CREATE POLICY "community_claims_insert" ON community_claims
  FOR INSERT WITH CHECK (
    claimant_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "community_claims_finder_read" ON community_claims;
CREATE POLICY "community_claims_finder_read" ON community_claims
  FOR SELECT USING (
    community_item_id IN (
      SELECT id FROM community_items
      WHERE finder_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "community_claims_claimant_read" ON community_claims;
CREATE POLICY "community_claims_claimant_read" ON community_claims
  FOR SELECT USING (
    claimant_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "community_claims_finder_update" ON community_claims;
CREATE POLICY "community_claims_finder_update" ON community_claims
  FOR UPDATE USING (
    community_item_id IN (
      SELECT id FROM community_items
      WHERE finder_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_community_items_status    ON community_items(status);
CREATE INDEX IF NOT EXISTS idx_community_items_finder    ON community_items(finder_id);
CREATE INDEX IF NOT EXISTS idx_community_claims_item     ON community_claims(community_item_id);
CREATE INDEX IF NOT EXISTS idx_community_claims_claimant ON community_claims(claimant_id);

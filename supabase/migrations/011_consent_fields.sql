-- Sprint 0: DPDP Act 2023 Compliance
-- Adds granular consent timestamps and age declaration to user profiles

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS consent_account_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_location_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_comms_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS age_declared_at      TIMESTAMPTZ;

-- Index for admin reporting / compliance audits
CREATE INDEX IF NOT EXISTS idx_users_consent_account ON users (consent_account_at);

COMMENT ON COLUMN users.consent_account_at  IS 'DPDP Section 6: Timestamp when user consented to account/identity data processing';
COMMENT ON COLUMN users.consent_location_at IS 'DPDP Section 6: Timestamp when user consented to location data processing (optional)';
COMMENT ON COLUMN users.consent_comms_at    IS 'DPDP Section 6: Timestamp when user consented to communications/notifications (optional)';
COMMENT ON COLUMN users.age_declared_at     IS 'DPDP Section 9: Timestamp when user declared they are 18+ years of age';

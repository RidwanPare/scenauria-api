-- Drop redundant indexes (UNIQUE constraint already creates implicit indexes)
DROP INDEX IF EXISTS idx_refresh_tokens_hash;
DROP INDEX IF EXISTS idx_invitations_hash;

-- Make invited_by nullable and change to SET NULL on delete
ALTER TABLE invitations ALTER COLUMN invited_by DROP NOT NULL;
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_invited_by_fkey;
ALTER TABLE invitations ADD CONSTRAINT invitations_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;

-- Add composite index for deduplication queries
CREATE INDEX idx_invitations_org_email ON invitations(organization_id, email);

-- Add role CHECK constraint
ALTER TABLE invitations ADD CONSTRAINT invitations_role_check
  CHECK (role IN ('owner', 'admin', 'editor', 'viewer'));

CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(10),
  description TEXT,
  logo_url TEXT,
  cover_url TEXT,
  phone VARCHAR(50),
  whatsapp VARCHAR(50),
  website_url TEXT,
  booking_url TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_places_organization ON places(organization_id);
CREATE INDEX idx_places_status ON places(status);
CREATE INDEX idx_places_name ON places USING gin(name gin_trgm_ops);

CREATE TABLE captures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  video_url TEXT,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  resolution VARCHAR(20),
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  quality_score INTEGER,
  quality_report JSONB,
  error_message TEXT,
  uploaded_at TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_captures_place ON captures(place_id);
CREATE INDEX idx_captures_status ON captures(status);

CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  capture_id UUID REFERENCES captures(id) ON DELETE SET NULL,
  scene_url TEXT,
  poster_url TEXT,
  thumbnail_url TEXT,
  slug VARCHAR(255) UNIQUE NOT NULL,
  publication_status VARCHAR(50) NOT NULL DEFAULT 'draft',
  viewer_settings JSONB NOT NULL DEFAULT '{}',
  published_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  required_plan VARCHAR(50) NOT NULL DEFAULT 'start',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visits_place ON visits(place_id);
CREATE INDEX idx_visits_slug ON visits(slug);
CREATE INDEX idx_visits_status ON visits(publication_status);

CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  session_id VARCHAR(255),
  source VARCHAR(100),
  device_type VARCHAR(50),
  duration_seconds INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_visit ON analytics_events(visit_id);
CREATE INDEX idx_analytics_place ON analytics_events(place_id);
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_occurred_at ON analytics_events(occurred_at DESC);
CREATE INDEX idx_analytics_session ON analytics_events(session_id);

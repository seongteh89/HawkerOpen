CREATE TABLE IF NOT EXISTS hawker_centres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  photo_url TEXT,
  description TEXT,
  no_market_stalls INTEGER DEFAULT 0,
  no_food_stalls INTEGER DEFAULT 0,
  source_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS closure_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hawker_centre_id UUID NOT NULL REFERENCES hawker_centres(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('cleaning', 'rr', 'other_works')),
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  remarks TEXT,
  source_quarter TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_closure_events_hawker_date
ON closure_events (hawker_centre_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL UNIQUE,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_favourites (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  hawker_centre_id UUID NOT NULL REFERENCES hawker_centres(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, hawker_centre_id)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  status TEXT NOT NULL,
  rows_processed INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hawker_centres_updated_at ON hawker_centres;
CREATE TRIGGER trg_hawker_centres_updated_at
BEFORE UPDATE ON hawker_centres
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

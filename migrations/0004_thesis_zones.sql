CREATE TABLE IF NOT EXISTS thesis_zones (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  instrument_code TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('demand', 'supply')),
  timeframe TEXT NOT NULL CHECK (timeframe IN ('monthly', 'daily', 'weekly', '4hr', '1hr', '6M')),
  lower_price NUMERIC NOT NULL CHECK (lower_price >= 0),
  upper_price NUMERIC NOT NULL CHECK (upper_price >= lower_price),
  invalidation_price NUMERIC NOT NULL CHECK (invalidation_price >= 0),
  quality TEXT NOT NULL DEFAULT 'fresh' CHECK (quality IN ('fresh', 'tested', 'removed')),
  active BOOLEAN NOT NULL DEFAULT true,
  alert_weekday INTEGER NOT NULL DEFAULT 4 CHECK (alert_weekday BETWEEN 0 AND 6),
  alert_armed BOOLEAN NOT NULL DEFAULT true,
  last_alerted_at TIMESTAMPTZ,
  last_alert_price NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS thesis_zones_user_active_idx
  ON thesis_zones (user_id, active);
CREATE INDEX IF NOT EXISTS thesis_zones_alert_idx
  ON thesis_zones (active, alert_weekday);

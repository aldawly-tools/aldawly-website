CREATE TABLE IF NOT EXISTS site_visits (
  visitor_id TEXT NOT NULL,
  visit_day TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (visitor_id, visit_day)
);

CREATE INDEX IF NOT EXISTS idx_site_visits_day ON site_visits (visit_day);

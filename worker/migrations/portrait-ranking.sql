CREATE TABLE IF NOT EXISTS portrait_ranking (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ranking TEXT NOT NULL,
  synced_at TEXT NOT NULL
);

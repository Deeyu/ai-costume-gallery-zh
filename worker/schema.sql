CREATE TABLE IF NOT EXISTS totals (name TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO totals(name) VALUES ('pageviews'), ('visitors');
CREATE TABLE IF NOT EXISTS visitors (visitor_hash TEXT PRIMARY KEY, first_seen INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS visit_events (
  event_id TEXT PRIMARY KEY, visitor_hash TEXT NOT NULL, page TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS visit_rate ON visit_events(visitor_hash, created_at);
CREATE INDEX IF NOT EXISTS visit_expiry ON visit_events(created_at);
CREATE TABLE IF NOT EXISTS image_stats (
  gallery TEXT NOT NULL, image_id TEXT NOT NULL,
  copies INTEGER NOT NULL DEFAULT 0, downloads INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(gallery, image_id)
);
CREATE TABLE IF NOT EXISTS action_events (
  event_id TEXT PRIMARY KEY, visitor_hash TEXT NOT NULL, gallery TEXT NOT NULL,
  image_id TEXT NOT NULL, action TEXT NOT NULL CHECK(action IN ('copy', 'download')), created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS action_rate ON action_events(visitor_hash, created_at);
CREATE INDEX IF NOT EXISTS action_expiry ON action_events(created_at);
CREATE TRIGGER IF NOT EXISTS visitor_count AFTER INSERT ON visitors BEGIN
  UPDATE totals SET value = value + 1 WHERE name = 'visitors';
END;
CREATE TRIGGER IF NOT EXISTS visit_count AFTER INSERT ON visit_events BEGIN
  INSERT OR IGNORE INTO visitors(visitor_hash, first_seen) VALUES (NEW.visitor_hash, NEW.created_at);
  UPDATE totals SET value = value + 1 WHERE name = 'pageviews';
END;
CREATE TRIGGER IF NOT EXISTS image_action_count AFTER INSERT ON action_events BEGIN
  INSERT INTO image_stats(gallery, image_id, copies, downloads)
  VALUES(NEW.gallery, NEW.image_id, CASE WHEN NEW.action = 'copy' THEN 1 ELSE 0 END,
         CASE WHEN NEW.action = 'download' THEN 1 ELSE 0 END)
  ON CONFLICT(gallery, image_id) DO UPDATE SET
    copies = copies + excluded.copies, downloads = downloads + excluded.downloads;
END;

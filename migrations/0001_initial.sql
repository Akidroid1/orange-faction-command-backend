CREATE TABLE IF NOT EXISTS faction_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  faction_id INTEGER NOT NULL,
  fetched_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_faction_snapshots_faction_time
ON faction_snapshots (faction_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS faction_current (
  faction_id INTEGER PRIMARY KEY,
  fetched_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS member_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  faction_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  name TEXT,
  level INTEGER,
  position TEXT,
  status TEXT,
  last_action TEXT,
  fetched_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_member_snapshots_faction_time
ON member_snapshots (faction_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_snapshots_member_time
ON member_snapshots (member_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_log_finished
ON sync_log (finished_at DESC);

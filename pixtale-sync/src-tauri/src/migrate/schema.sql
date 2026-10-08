CREATE TABLE IF NOT EXISTS user (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '',
    type INTEGER NOT NULL,
    token TEXT NOT NULL,
    endpoint TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS storage (
    storage_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS task (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    path TEXT NOT NULL,
    task_type INTEGER NOT NULL DEFAULT 1 CHECK (task_type IN (1, 2)),
    storage_id TEXT NOT NULL DEFAULT '',
    item_count INTEGER NOT NULL DEFAULT 0,
    item_size INTEGER NOT NULL DEFAULT 0,
    completed_count INTEGER NOT NULL DEFAULT 0,
    completed_size INTEGER NOT NULL DEFAULT 0,
    task_status INTEGER NOT NULL DEFAULT 1 CHECK (task_status IN (1, 2)),
    last_sync_at TEXT,
    sort_at INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS task_user_id_idx ON task(user_id);

CREATE TABLE IF NOT EXISTS log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    task_name TEXT NOT NULL DEFAULT '',
    event_name TEXT NOT NULL DEFAULT '',
    status INTEGER NOT NULL CHECK (status IN (1, 2)),
    message TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    task_interval INTEGER NOT NULL DEFAULT 10,
    log_max_count INTEGER NOT NULL DEFAULT 10000,
    task_status INTEGER NOT NULL DEFAULT 2 CHECK (task_status IN (1, 2)),
    upload_concurrency INTEGER NOT NULL DEFAULT 4 CHECK (upload_concurrency BETWEEN 1 AND 20),
    last_sync_at TEXT,
    schema_version INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO settings (id) VALUES (1);

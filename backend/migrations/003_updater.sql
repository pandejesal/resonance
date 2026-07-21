-- Updater state
-- Version: 003

CREATE TABLE IF NOT EXISTS updater_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO updater_state (key, value) VALUES ('current_version', '0.1.0');
INSERT OR IGNORE INTO updater_state (key, value) VALUES ('current_commit', '');
INSERT OR IGNORE INTO updater_state (key, value) VALUES ('latest_commit', '');
INSERT OR IGNORE INTO updater_state (key, value) VALUES ('latest_version', '');
INSERT OR IGNORE INTO updater_state (key, value) VALUES ('last_checked', '');
INSERT OR IGNORE INTO updater_state (key, value) VALUES ('auto_check', 'false');
INSERT OR IGNORE INTO updater_state (key, value) VALUES ('check_interval_hours', '6');
INSERT OR IGNORE INTO updater_state (key, value) VALUES ('docker_socket', 'false');

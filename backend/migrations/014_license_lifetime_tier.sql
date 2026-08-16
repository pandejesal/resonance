-- Extend the licenses tier CHECK to include the 'lifetime' tier
-- (annual Pro keys stay expiring; lifetime keys never expire).
-- SQLite cannot ALTER a CHECK constraint, so rebuild the table.
CREATE TABLE licenses_new (
    id TEXT PRIMARY KEY,
    license_key TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise', 'lifetime')),
    user_id TEXT,
    activated_at DATETIME,
    expires_at DATETIME,
    device_count INTEGER DEFAULT 0,
    max_devices INTEGER DEFAULT 1,
    features TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO licenses_new (id, license_key, tier, user_id, activated_at, expires_at, device_count, max_devices, features, created_at)
SELECT id, license_key, tier, user_id, activated_at, expires_at, device_count, max_devices, features, created_at FROM licenses;

DROP TABLE licenses;

ALTER TABLE licenses_new RENAME TO licenses;

CREATE INDEX idx_licenses_key ON licenses(license_key);
CREATE INDEX idx_licenses_user ON licenses(user_id);
CREATE INDEX idx_licenses_tier ON licenses(tier);
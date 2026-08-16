-- Lifetime tier: same feature set as Pro, never expires.
-- Covers both fresh installs and existing DBs (INSERT OR IGNORE upsert).
INSERT OR IGNORE INTO tier_features (tier, feature_key, enabled)
SELECT 'lifetime', feature_key, enabled FROM tier_features WHERE tier = 'pro';
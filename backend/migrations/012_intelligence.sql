-- Resonance Intelligence feature key (Pro-gated).
-- Stats-based taste analysis computed on-device; no cloud, no models.
INSERT OR IGNORE INTO tier_features (tier, feature_key, enabled) VALUES
('free', 'intelligence', 0),
('pro', 'intelligence', 1),
('enterprise', 'intelligence', 1);
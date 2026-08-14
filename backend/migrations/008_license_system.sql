-- License and subscription system
CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY,
    license_key TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    user_id TEXT,
    activated_at DATETIME,
    expires_at DATETIME,
    device_count INTEGER DEFAULT 0,
    max_devices INTEGER DEFAULT 1,
    features TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_user ON licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_tier ON licenses(tier);

-- Feature definitions per tier
CREATE TABLE IF NOT EXISTS tier_features (
    tier TEXT NOT NULL,
    feature_key TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tier, feature_key)
);

-- Insert default tier features
INSERT OR IGNORE INTO tier_features (tier, feature_key, enabled) VALUES
-- Free tier
('free', 'basic_playback', 1),
('free', 'local_files', 1),
('free', 'equalizer', 1),
('free', 'gapless_playback', 1),
('free', 'crossfade', 1),
('free', 'import_files', 1),
('free', 'playlists', 1),
('free', 'waveform', 1),
('free', 'metadata_editor', 0),
('free', 'audio_effects', 0),
('free', 'cloud_sync', 0),
('free', 'ai_recommendations', 0),
('free', 'cross_device_sync', 0),
('free', 'advanced_analytics', 0),
('free', 'custom_themes', 0),
('free', 'api_access', 0),
('free', 'priority_support', 0),
-- Pro tier
('pro', 'basic_playback', 1),
('pro', 'local_files', 1),
('pro', 'equalizer', 1),
('pro', 'gapless_playback', 1),
('pro', 'crossfade', 1),
('pro', 'import_files', 1),
('pro', 'playlists', 1),
('pro', 'waveform', 1),
('pro', 'metadata_editor', 1),
('pro', 'audio_effects', 1),
('pro', 'cloud_sync', 1),
('pro', 'ai_recommendations', 1),
('pro', 'cross_device_sync', 1),
('pro', 'advanced_analytics', 1),
('pro', 'custom_themes', 1),
('pro', 'api_access', 0),
('pro', 'priority_support', 1),
-- Enterprise tier
('enterprise', 'basic_playback', 1),
('enterprise', 'local_files', 1),
('enterprise', 'equalizer', 1),
('enterprise', 'gapless_playback', 1),
('enterprise', 'crossfade', 1),
('enterprise', 'import_files', 1),
('enterprise', 'playlists', 1),
('enterprise', 'waveform', 1),
('enterprise', 'metadata_editor', 1),
('enterprise', 'audio_effects', 1),
('enterprise', 'cloud_sync', 1),
('enterprise', 'ai_recommendations', 1),
('enterprise', 'cross_device_sync', 1),
('enterprise', 'advanced_analytics', 1),
('enterprise', 'custom_themes', 1),
('enterprise', 'api_access', 1),
('enterprise', 'priority_support', 1);

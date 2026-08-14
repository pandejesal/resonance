-- ReplayGain / loudness normalization columns
-- track_gain / album_gain in dB (the value the player adds), peak 0.0-1.0
-- track_loudness caches per-track integrated LUFS for album aggregation
ALTER TABLE tracks ADD COLUMN track_gain REAL;
ALTER TABLE tracks ADD COLUMN track_peak REAL;
ALTER TABLE tracks ADD COLUMN album_gain REAL;
ALTER TABLE tracks ADD COLUMN album_peak REAL;
ALTER TABLE tracks ADD COLUMN gain_computed_at TEXT;
ALTER TABLE tracks ADD COLUMN track_loudness REAL;

-- Add waveform_peaks column to tracks table
-- Version: 007

ALTER TABLE tracks ADD COLUMN waveform_peaks TEXT;

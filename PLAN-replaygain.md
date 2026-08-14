# PLAN-replaygain.md — ReplayGain / Loudness Normalization

**Status:** Implemented (verified 2026-08-14 — `npm run build` clean, `cargo check` clean, unit test `sine_wave_loudness_matches_expected_lufs` passes; backend migration is `009_replaygain.sql`, not `008` as written below)
**Goal:** Per-track and per-album loudness normalization that preserves the
"bit-perfect playback" promise.

## Design Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Gain source | **Read `REPLAYGAIN_*` tags first**, compute only when missing | FLAC/MP3 files often already carry tags; no redundant work |
| Compute method | symphonia decode + **ebur128** (ReplayGain 2.0, LUFS-based) | Reuses symphonia (already used for waveform peaks); ebur128 is a new dependency |
| Compute timing | **On-demand at first play**, cache result in DB | Scan-time compute for 500k songs is prohibitive |
| Application | **Client-side Web Audio `GainNode`** | No re-encode → bit-perfect streams preserved for all clients (including Subsonic) |
| Scope | **Track gain + Album gain** | Album mode matters for gapless album listening (already supported) |

## Data Model

New columns on `tracks` (migration `008_replaygain.sql`):

```sql
ALTER TABLE tracks ADD COLUMN track_gain REAL;   -- dB, e.g. -6.4
ALTER TABLE tracks ADD COLUMN track_peak REAL;   -- 0.0–1.0 (post-gain peak estimate)
ALTER TABLE tracks ADD COLUMN album_gain REAL;   -- dB, NULL until album computed
ALTER TABLE tracks ADD COLUMN album_peak REAL;
ALTER TABLE tracks ADD COLUMN gain_computed_at TEXT; -- ISO timestamp, NULL = not computed
```

- Gain values are stored **without** tag normalization (i.e. the value the player should add in dB).
- Existing tags read: `REPLAYGAIN_TRACK_GAIN`, `REPLAYGAIN_TRACK_PEAK`,
  `REPLAYGAIN_ALBUM_GAIN`, `REPLAYGAIN_ALBUM_PEAK` (via lofty-rs `TagItem`).

## Backend

1. **Tag extraction (scan time)** — in `scanner.rs`, when a track is scanned, read the four
   ReplayGain tag items from lofty metadata and store them. No audio decode.

2. **Compute fallback (`compute_gain.rs`, new)** — `compute_track_gain(db, track_id)`:
   - Decode with symphonia (reuse `waveform` decode path), feed samples to `ebur128` state
     (EBU R128, relative gate -10 LUFS).
   - Produce `track_gain = -integrated_loudness` (clamped to ±15 dB), `track_peak` from
     ebur128's sample peak.
   - Persist to `tracks`, set `gain_computed_at`.
   - **Album gain:** computed on demand when a track in an album without computed album gain
     is played — decode all album tracks (or, faster: compute from already-computed per-track
     short-term loudness if all tracks in the album have been measured). Initial implementation:
     compute per-track integrated loudness once per track (cached), then album gain =
     `-10 * log10(mean(10^(track_loudness/10)))` across the album's tracks. Store on each track.

3. **API** — new endpoints (auth required):
   - `GET /api/tracks/{id}/gain` — returns `{ track_gain, track_peak, album_gain, album_peak, computed: bool }`
   - `POST /api/tracks/{id}/gain/compute` — force compute (used by frontend on first play;
     returns after compute, ~1–2s per track)
   - `PUT /api/settings/replaygain` — `{ mode: "off" | "track" | "album", prevent_clipping: bool }`

4. **Settings storage** — `settings` table keys: `replaygain_mode`, `replaygain_prevent_clipping`.

## Frontend

1. **Gain application (`audio-engine.ts`)** — insert `GainNode` between `MediaElementSource`
   and destination:
   - On track change, fetch gain via `GET /api/tracks/{id}/gain`; if missing, call
     `POST /api/tracks/{id}/gain/compute` (show "Analyzing loudness…" state).
   - Apply `gain = 10^(dB/20)`; if `prevent_clipping` and peak > 1.0, clamp gain so
     `gain * peak <= 1.0` (per ReplayGain spec).
   - Album mode: use album gain when the track belongs to a completed album; else fall back
     to track gain.
   - Ramp gain in/out over ~50ms on play/pause/seek to avoid clicks (reuse crossfade ramp
     helpers).

2. **Settings UI (SettingsPage → Playback)** — mode selector (Off / Track / Album) +
   "Prevent clipping" toggle. Note: gain applies client-side only; Subsonic/cast clients get
   bit-perfect streams (documented).

## Verification

- Unit test: ebur128 gain for a known loud sine wave ≈ expected LUFS (within ±0.5 LU).
- Integration: tag-bearing FLAC → gain read at scan, no compute; tag-less WAV → gain computed
  on first play and cached; second play hits DB only.
- UI: play two tracks with very different loudness with mode=Track → perceived level similar;
  mode=Album within an album → no level jump between gapless tracks.
- Bit-perfect check: raw stream bytes identical whether or not ReplayGain is enabled.

## Open Details (small, decide during implementation)

- Clamp window for computed gain (±15 dB) — confirm.
- Whether `GET /api/tracks/{id}/gain` should auto-trigger compute or require the explicit
  POST (currently: explicit POST to keep the play path fast; UI fires it once per track).
- Album compute concurrency: serialize album computes per album id to avoid duplicate work
  when several tracks of the same album play in a gapless row.

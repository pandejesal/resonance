# Resonance Roadmap

> **Status: reconciled 2026-08-14.** All phases 1–10 verified against the codebase.
> ReplayGain (PLAN-replaygain.md) is implemented; the remaining plan is the three
> parallel next-work slices (see [Next Work](#next-work-parallel-slices)).

## README Accuracy Audit ✅ RESOLVED

Verified against the codebase:

| README Claim | Actual Status | Action |
|---|---|---|
| "Gapless playback" | ✅ Implemented — `canplaythrough` event, swap audio elements | **Kept** |
| "Crossfade" | ✅ Implemented — dual audio elements, gain ramping | **Kept** |
| "ReplayGain" | ✅ Implemented — tags-first + ebur128 compute + Web Audio GainNode | **Kept** — moved to Features (PLAN-replaygain.md) |
| "Audio-reactive visualization" | ✅ Implemented — `audio-engine.ts` creates `AnalyserNode`, `AudioVisualizer.tsx` reads `getFrequencyData()` | **Moved to Features list** |

---

## Phase 1: Ship It Right (Fix What's Broken) ✅ DONE

### 1a. README accuracy ✅ DONE
- ReplayGain: kept as Planned (implementation plan in PLAN-replaygain.md)
- Audio-reactive visualization: moved from Roadmap to Features (implemented)
- "Roadmap" section points to PLAN-*.md files

### 1b. Player Enhancements ✅ DONE
- ✅ Gapless playback — `canplaythrough` event, dual audio element swap
- ✅ Crossfade — gain ramping, configurable 1-12s
- ✅ Real audio visualization — `AnalyserNode` → `AudioVisualizer.tsx` bars (NowPlaying)
- ✅ Equalizer UI — `EqualizerPage.tsx` with 10-band sliders, presets
- ✅ MediaSession API — metadata + play/pause/prev/next/seek handlers, playbackState

### 1c. Lyrics ✅ DONE
- ✅ LRCLIB integration — `backend/src/lyrics.rs`
- ✅ Synced lyrics display — `SyncedLyrics.tsx` + `LyricsPanel.tsx` (`parseLrc`, auto-highlight)
- ✅ Lyrics editing — paste/edit UI in LyricsPanel (LRC or plain)

### 1d. Scrobbling ✅ DONE
- ✅ Last.fm + ListenBrainz — `backend/src/scrobble.rs`
- ✅ Pending retry queue — `pending_scrobbles` table, `retry_pending_scrobbles()`, retried on next play
- ✅ Connection test UI — `POST /api/settings/scrobbling/test` performs **real** connectivity checks:
  - Last.fm: signed `user.getInfo` call (validates api_key + session_key + api_secret)
  - ListenBrainz: `validate-token` endpoint
  - "Test Connection" buttons + per-service status in Settings → Scrobbling

### 1e. Updater ✅ DONE
- ✅ GitHub API check — `backend/src/updater.rs`
- ✅ Auto-check background task — `start_background_check()` with configurable interval
- ✅ Update banner — `UpdateBanner.tsx` + Settings updater UI with Docker socket warning

---

## Phase 2: Unwire the Unused ✅ DONE

- ✅ `actix-ws` push — `backend/src/ws.rs` (`/api/ws`, `subscribe:scan_progress`, `subscribe:now_playing`)
- ✅ `notify` filesystem watcher — `backend/src/watcher.rs` (5s debounce, incremental rescan, hidden-file filter)

---

## Phase 3: Security (Auth / Multi-User) ✅ DONE

- ✅ `users` table, argon2 hashing, base64 cookie/header token auth, default admin
- ✅ Per-user data (`user_id` FK on playlists, history, favorites)
- ✅ LoginPage, useAuthStore, admin user management, session cookie

---

## Phase 4: Subsonic / OpenSubsonic API ✅ DONE

16 endpoints in `backend/src/subsonic.rs` (960 lines): ping, getMusicFolders, getArtists,
getAlbumList, getAlbum, getSongsByAlbumId, stream, getCoverArt, search2, playlists CRUD,
scrobble, getUser, login. ID mapping `s`/`al`/`ar`/`pl`, JSON per Subsonic spec.

---

## Phase 5: Smart Playlists & Ratings ✅ DONE

- ✅ `rating` column, `PUT /api/tracks/{id}/rating`, StarRating component
- ✅ Smart playlist engine — JSON rules, evaluate + rules endpoints, rule builder UI
- Migration `005_smart_playlists.sql`

---

## Phase 6: Duplicate Detection ✅ DONE

- ✅ Content fingerprint (first/last/middle 64KB + size), `compute_fingerprint()` at scan
- ✅ `/api/tracks/duplicates`, `/api/tracks/similar`, batch delete
- ✅ MusicToolsPage duplicate UI

---

## Phase 7: Waveform Peaks ✅ DONE

- ✅ symphonia decode → 50ms chunks → max 2000 peaks per track (~20KB)
- ✅ WaveformSeekBar SVG, click/drag seek
- Migration `007_waveform_peaks.sql`

---

## Phase 8: PWA Enhancements ✅ DONE

- ✅ MediaSession API (see 1b)
- ✅ Lossy transcode profile (opt-in) — AAC/Opus/OGG 128–320 kbps via ffmpeg with fallback

---

## Phase 9: Codebase Hardening ✅ DONE

- ✅ `PRAGMA busy_timeout=5000` alongside WAL
- ✅ Keyset pagination (`last_id`/`order`), backward-compatible `?page=`
- ✅ `/api/health` → `{status, db, version}`; Docker HEALTHCHECK uses it
- ✅ Docker socket isolation — socket mount removed from `docker-compose.yml` (commented out
  with root-access warning). Note: the separate `docker-compose.override.yml` was not created;
  the socket is simply not exposed. Safe to re-enable intentionally via override if desired.
- ✅ Removed unused `rusqlite` dependency

---

## Phase 10: Multi-Room / Cast Output ✅ DONE

HTTP Push approach: CastTarget model, `/api/cast/*` CRUD + play + control, NowPlaying cast
button, Settings management UI, `useCastStore`.

---

## Undocumented Features (verified in code, not previously planned)

| Feature | Where | Status |
|---|---|---|
| Platform import/export | `importer.rs`, ImportPage, TransferPage (Spotify CSV, YT Music, Apple M3U, SoundCloud, M3U, XSPF) | ✅ Wired |
| License / Pro tier | `license.rs`, `license_handlers.rs`, UpgradePage (Free/Pro pricing, device limits, key activation) | ✅ Wired — **Pro features listed on UpgradePage mostly NOT implemented yet** (cloud sync, AI recs, audio effects, custom themes) — metadata editor done, see Next Work |

---

## Next Work (Parallel Slices)

Three areas, one small slice per milestone, interleaved. Nothing ships until a slice is
end-to-end.

### A. ReplayGain ✅ DONE
See **PLAN-replaygain.md**. Implemented: read `REPLAYGAIN_*` tags first, compute
(symphonia + ebur128, ReplayGain 2.0) only when missing and on first play, apply client-side
via Web Audio GainNode, track + album gain support (settings: mode off|track|album,
prevent clipping). Verified: `npm run build` + `cargo check` clean, backend unit test passes.

### B. Pro Tier — first slice: Metadata editor ✅ DONE
Per-track metadata editing (title/artist/album/art/year): PUT endpoint + edit UI.
- ✅ `UpdateTrackRequest` + `update_track` now persist `album_artist`, `track_number`,
  `disc_number`, `composer`, `musical_key` (previously silently dropped by serde)
- ✅ Artwork: `PUT/DELETE /api/tracks/{id}/artwork` (16 MB cap, image validation via `image`
  crate, sha2 hash, writes `artwork_cache` + `tracks`/`albums` flags); upload/remove UI in
  `MetadataEditor.tsx`
- ✅ UI Pro-gated via `metadata_editor` feature key (seeded in `008_license_system.sql`)
- Next slice (Pro tier): remaining UpgradePage promises (cloud sync, AI recs, audio
  effects, custom themes) — **re-scoped into PLAN-upgrade.md** (2026-08-16):
  the "download & buy" cycle ships Resonance Intelligence v1 first, then
  pricing/website/demo/apps/launch.

### C. Sync/Offline — first slice: Offline playback ✅ DONE
PWA offline-first shell: service worker caching app assets + streamed tracks (Cache API),
queue-while-offline.
- ✅ `sw.js` v2 — separate `resonance-streams-v1` cache; streams + artwork network-first with
  cache fallback (range-stripped keys → full 200 responses cached for offline seeking)
- ✅ `useOfflineStore` — `downloadForOffline` / `removeFromOffline` (stream + artwork), persisted
  track list; "Offline" button in NowPlaying, "Save for Offline" in TrackList context menu
- ✅ Queue-while-offline — queue/queueIndex already persisted via zustand `resonance-player`
- Next slice (sync/offline): cross-device sync or downloads manager

### D. Native — first slice: Desktop installer polish ✅ DONE
Installable packages (Windows Inno Setup + Linux AppImage + macOS DMG) from `installer/`.
- ✅ Scripts no longer copy `release/static` + `release/migrations` (frontend embedded via
  `include_dir!`, migrations via `sqlx migrate!`)
- ✅ Version read from `../VERSION` (0.7.0) instead of hardcoded 0.1.0
- ✅ DMG launcher uses `~/Library/Application Support/Resonance` (was inside the .app bundle);
  AppImage launcher resolves paths relative to its own location
- ✅ Desktop update-channel wiring — `POST /api/updater/open-download` opens the download page in
  the system browser (via `webbrowser` crate); Settings + UpdateBanner show a "Download Update"
  button when no Docker socket is mounted; Android opens it through the `AndroidBridge.openUrl`
  intent. `RESONANCE_DOWNLOAD_URL` overrides the default `https://resonance.app/download`
- Next slice (native): auto-install via signed update manifests (needs code-signing keys)

---

## Priority Order (completed)

| Priority | Phase | Status | Impact |
|---|---|---|---|
| 1 | README accuracy + finish existing plans | ✅ DONE | High |
| 2 | actix-ws + notify wiring | ✅ DONE | High |
| 3 | Subsonic API | ✅ DONE | Very High |
| 4 | SQLite busy_timeout + keyset pagination | ✅ DONE | High |
| 5 | Health endpoint | ✅ DONE | Medium |
| 6 | Smart playlists + ratings | ✅ DONE | Medium |
| 7 | MediaSession API | ✅ DONE | Medium |
| 8 | Auth / multi-user | ✅ DONE | Medium |
| 9 | Waveform peaks | ✅ DONE | Medium |
| 10 | Duplicate detection | ✅ DONE | Medium |
| 11 | Lossy transcode profile | ✅ DONE | Low |
| 12 | Multi-room / cast | ✅ DONE | High |
| 13 | License tier + platform transfer (documented) | ✅ DONE | Medium |

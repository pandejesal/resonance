# Resonance Roadmap

## README Accuracy Audit

The README currently claims these as shipped features, but PLAN-player-enhancements.md says they don't work yet:

| README Claim | Actual Status | Action |
|---|---|---|
| "Gapless playback" | ✅ Implemented (v0.5.3) — `canplaythrough` event, swap audio elements | **Keep** |
| "Crossfade" | ✅ Implemented (v0.5.3) — dual audio elements, gain ramping | **Keep** |
| "ReplayGain" | ❌ Not implemented — no ReplayGain parsing or application | **Remove from README or add to Roadmap** |
| "Audio-reactive visualization" | ❌ Fake random bars — not wired to AnalyserNode | **Remove from README or add to Roadmap** |

**Decision needed:** Remove "ReplayGain" from README features, or keep as planned?

---

## Phase 1: Ship It Right (Fix What's Broken)

Fix README claims and get the four existing plans fully operational.

### 1a. Fix README accuracy
- Remove "ReplayGain" from README features (or mark as Planned)
- Remove "audio-reactive visualization" claim (or mark as Planned)
- Add "Roadmap" section pointing to PLAN-*.md files

### 1b. Complete Player Enhancements (PLAN-player-enhancements.md)
- ✅ Gapless playback — DONE
- ✅ Crossfade — DONE
- ❌ Real audio visualization — wire AnalyserNode to NowPlaying bars
- ❌ Equalizer UI — 10-band sliders with presets
- ❌ MediaSession API — lock screen/notification controls for mobile PWA

### 1c. Complete Lyrics (PLAN-lyrics.md)
- ✅ LRCLIB integration — DONE
- ❌ Synced lyrics display — LRC parsing, auto-scroll, highlight current line
- ❌ Lyrics editing — manual paste/edit UI

### 1d. Complete Scrobbling (PLAN-scrobbling.md)
- ✅ Last.fm + ListenBrainz — DONE
- ❌ Pending retry queue — store failed scrobbles, retry on next play
- ❌ Connection test UI — "Test" button in settings

### 1e. Complete Updater (PLAN-updater.md)
- ✅ GitHub API check — DONE
- ❌ Auto-check background task — periodic checking
- ❌ Update banner — notification when update available

---

## Phase 2: Unwire the Unused (Use What's Already There)

Two crates already in `Cargo.toml` but not used in any source file.

### 2a. Wire `actix-ws` for push-based updates
- Scan progress: replace polling `GET /api/libraries/{id}/scan/progress` with WebSocket push
- Now-playing state: push current track to all connected clients (multi-device sync)
- Future: Spotify-Connect-style "control this room from my phone" handoff
- WebSocket endpoint: `ws://host/api/ws`

### 2b. Wire `notify` for filesystem-triggered rescans
- Monitor each library's path for file changes (create, modify, delete)
- Debounce events (batch within 5-second window)
- Trigger incremental rescan on change
- This means the UI "Scan" button becomes optional — changes auto-detect

---

## Phase 3: Security (Auth / Multi-User)

Basic accounts to protect the write API.

### 3a. Backend auth
- Add `users` table: `id`, `username`, `password_hash`, `role` (admin/user)
- Use `argon2` crate for password hashing (already common in Rust ecosystem)
- Session-based auth via signed cookies (or JWT)
- Protected routes: all `PUT`, `POST`, `DELETE` endpoints
- Read-only routes stay public (useful for kiosk/shared display)

### 3b. Per-user data
- Add `user_id` FK to: `playlists`, `listening_history`, `favorites`
- Play history, ratings, playlists become per-user
- Admin can see all; regular users see only their own

### 3c. Frontend auth
- Login page (simple, no OAuth complexity)
- Store session in cookie (httpOnly, secure)
- Sidebar shows current user, logout button

---

## Phase 4: Subsonic / OpenSubsonic API

**Highest-leverage addition.** Implement even a subset and every Subsonic client works immediately.

### 4a. Core endpoints (Symfonium, play:Sub, Amperfy compatible)
```
GET /rest/ping.view
GET /rest/getArtists.view
GET /rest/getAlbum.view
GET /rest/getSongsByAlbumId.view
GET /rest/stream.view (proxy to /api/tracks/{id}/stream)
GET /rest/getCoverArt.view (proxy to /api/tracks/{id}/cover)
GET /rest/search2.view
GET /rest/getPlaylists.view
POST /rest/createPlaylist.view
POST /rest/updatePlaylist.view
POST /rest/deletePlaylist.view
POST /rest/scrobble.view (proxy to play_track)
GET /rest/getUser.view
POST /rest/login.view
```

### 4b. Implementation approach
- New `subsonic.rs` module with its own router (`/rest/*.view`)
- Reuse existing handlers — thin adapter layer
- No new DB schema — read from existing tables
- Auth: HTTP Basic auth (Subsonic standard) mapped to local users

---

## Phase 5: Smart Playlists & Ratings

Leverage existing `play_count` and `listening_history` data.

### 5a. Ratings system
- Add `rating` column to `tracks` table (1-5 stars)
- Frontend: star rating in NowPlaying and library views
- API: `PUT /api/tracks/{id}/rating`

### 5b. Smart playlist engine
- Rule-based: "not played in 30 days", "4★+", "genre=Jazz AND year>2000"
- Stored as JSON rule set in `smart_playlists` table
- API: `GET /api/smart-playlists/{id}/tracks` — evaluate rules, return matching tracks
- UI: create/edit smart playlist with rule builder

---

## Phase 6: Duplicate Detection & MusicBrainz Fingerprinting

Fits the "archival" framing.

### 6a. Acoustic fingerprinting
- Use `symphonia` (already a dependency) for PCM access
- Integrate `acoustid` crate for AcoustID lookup
- Store fingerprint in DB, match against MusicBrainz releases

### 6b. Batch retagging
- After fingerprint match, batch-update metadata (artist, album, year, etc.)
- UI: "Find duplicates" → show groups → merge/delete manually

---

## Phase 7: Server-Computed Waveform Peaks

Seek bar shows real waveform shape.

### 7a. Peak generation
- At scan time, compute peak amplitude per 50ms chunk
- Store as JSON array in `waveform_peaks` column (or separate table)
- ~2000 peaks per 100-minute track → ~20KB storage per track

### 7b. Frontend
- Replace flat seek bar with SVG waveform visualization
- Peaks rendered as filled bars, seek position highlighted

---

## Phase 8: PWA Enhancements

### 8a. MediaSession API
- Wire `navigator.mediaSession` to player store
- Lock screen shows track title, artist, album art
- Media notification controls: play/pause, next/previous, seek

### 8b. Lossy transcode profile (opt-in)
- Off by default, never affects bit-perfect LAN playback
- When enabled, stream transcoded AAC/OGG for cellular
- Uses `ffmpeg` sidecar or built-in `symphonia` encoder

---

## Phase 9: Codebase Hardening

### 9a. SQLite busy_timeout
- Add `PRAGMA busy_timeout = 5000;` to `db.rs` alongside WAL PRAGMAs
- Prevents "database is locked" when scan + stream land simultaneously

### 9b. Keyset pagination
- Replace `OFFSET` in `GET /api/tracks` with `WHERE id > last_id ORDER BY id LIMIT n`
- Keeps query fast at offset 100,000+

### 9c. Health endpoint
- `GET /api/health` → `{ status: "ok", db: "connected", version: "0.5.3" }`
- Docker HEALTHCHECK uses this instead of raw port check
- Updater uses this to verify server restarted successfully

### 9d. Docker socket isolation
- Separate `docker-compose.override.yml` for Docker socket mount
- Main compose file has no socket access
- Document the security implications

---

## Phase 10: Multi-Room / Cast Output

Biggest lift, but the premium differentiator (Roon's whole pitch).

- Chromecast: `chromecast` crate or `device_discovery`
- AirPlay: `raop` crate
- UPnP/DLNA: `upnp` crate
- Architecture: backend pushes PCM to cast target; frontend just sends control commands

---

## Priority Order

| Priority | Phase | Effort | Impact |
|---|---|---|---|
| 1 | README accuracy + finish existing plans | Low | High |
| 2 | actix-ws + notify wiring | Medium | High |
| 3 | Subsonic API | Medium | Very High |
| 4 | SQLite busy_timeout + keyset pagination | Low | High |
| 5 | Health endpoint | Low | Medium |
| 6 | Smart playlists + ratings | Medium | Medium |
| 7 | MediaSession API | Low | Medium |
| 8 | Auth / multi-user | High | Medium |
| 9 | Waveform peaks | Medium | Medium |
| 10 | Duplicate detection | High | Medium |
| 11 | Lossy transcode profile | Medium | Low |
| 12 | Multi-room / cast | Very High | High |

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

## Phase 2: Unwire the Unused (Use What's Already There) ✅ DONE

Two crates already in `Cargo.toml` but not used in any source file.

### 2a. Wire `actix-ws` for push-based updates ✅ DONE
- `backend/src/ws.rs` — WebSocket endpoint at `/api/ws`
- Client tracking in `DashMap<String, Session>`
- `subscribe:scan_progress` and `subscribe:now_playing` commands
- `broadcast_scan_progress()` and `broadcast_now_playing()` functions
- Wired into `AppState` and `lib.rs`

### 2b. Wire `notify` for filesystem-triggered rescans ✅ DONE
- `backend/src/watcher.rs` — `WatcherService` with `RecommendedWatcher`
- Monitors library paths recursively for create/modify/delete
- Debounces events (5-second window)
- Auto-triggers incremental rescan on file changes
- Filters hidden files and unsupported audio extensions
- Started automatically on server boot

---

## Phase 3: Security (Auth / Multi-User) ✅ DONE

Basic accounts to protect the write API.

### 3a. Backend auth ✅ DONE
- `users` table with id, username, password_hash, role (admin/user)
- `argon2` crate for password hashing
- Base64 token auth (cookie or Authorization header)
- Default admin user created on first startup (username: admin, password: admin)

### 3b. Per-user data
- Add `user_id` FK to: `playlists`, `listening_history`, `favorites`
- Play history, ratings, playlists become per-user
- Admin can see all; regular users see only their own

### 3c. Frontend auth ✅ DONE
- `frontend/src/pages/LoginPage.tsx` — glassmorphism login form
- `useAuthStore` with login/logout/checkAuth
- `App.tsx` checks auth on mount
- Settings page: admin-only user management (create/delete users)
- Sidebar: logged-in user info with logout button
- Store session in cookie (httpOnly, secure)
- Sidebar shows current user, logout button

---

## Phase 4: Subsonic / OpenSubsonic API ✅ DONE

**Highest-leverage addition.** Implement even a subset and every Subsonic client works immediately.

### 4a. Core endpoints (Symfonium, play:Sub, Amperfy compatible) ✅ DONE
```
GET /rest/ping.view ✅
GET /rest/getMusicFolders.view ✅
GET /rest/getArtists.view ✅
GET /rest/getAlbumList.view ✅
GET /rest/getAlbum.view ✅
GET /rest/getSongsByAlbumId.view ✅
GET /rest/stream.view ✅
GET /rest/getCoverArt.view ✅
GET /rest/search2.view ✅
GET /rest/getPlaylists.view ✅
POST /rest/createPlaylist.view ✅
POST /rest/updatePlaylist.view ✅
POST /rest/deletePlaylist.view ✅
POST /rest/scrobble.view ✅
GET /rest/getUser.view ✅
POST /rest/login.view ✅
```

### 4b. Implementation approach ✅ DONE
- `backend/src/subsonic.rs` — 960 lines, 16 endpoints
- ID mapping: `s` prefix for songs, `al` for albums, `ar` for artists, `pl` for playlists
- JSON response format matching Subsonic spec
- Wired via `.configure(subsonic::configure)` in `lib.rs`

---

## Phase 5: Smart Playlists & Ratings ✅ DONE

Leverage existing `play_count` and `listening_history` data.

### 5a. Ratings system ✅ DONE
- `rating` column in `tracks` table (already existed)
- `PUT /api/tracks/{id}/rating` — updates rating (0-5 or null)
- `frontend/src/components/StarRating.tsx` — 5 clickable stars, brand-500 color
- StarRating in NowPlaying and TrackList views
- Migration: `005_smart_playlists.sql`

### 5b. Smart playlist engine ✅ DONE
- Rule-based: "not played in 30 days", "4★+", "genre=Jazz AND year>2000"
- Stored as JSON rule set in `smart_playlists` table
- `GET /api/playlists/{id}/smart/evaluate` — evaluate rules, return matching tracks
- `PUT /api/playlists/{id}/smart/rules` — save rules
- Full rule builder UI in PlaylistToolsPage: field/operator/value, AND/OR toggle

---

## Phase 6: Duplicate Detection & MusicBrainz Fingerprinting ✅ DONE

Fits the "archival" framing.

### 6a. Content fingerprinting ✅ DONE
- Content-based hash (first/last/middle 64KB + file size) in `compute_fingerprint()`
- Stored in `fingerprint` column, computed at scan time
- `GET /api/tracks/duplicates` — finds exact duplicates by fingerprint
- `GET /api/tracks/similar` — finds tracks with same title+artist
- `POST /api/tracks/duplicates/delete` — batch delete selected duplicates
- Full duplicate detection UI in MusicToolsPage with checkbox selection

---

## Phase 7: Server-Computed Waveform Peaks ✅ DONE

Seek bar shows real waveform shape.

### 7a. Peak generation ✅ DONE
- Uses symphonia to decode audio and compute 50ms chunk peaks
- Downsampled to max 2000 peaks per track (~20KB storage)
- Computed at scan time, stored in `waveform_peaks` column
- Migration: `007_waveform_peaks.sql`

### 7b. Frontend ✅ DONE
- `frontend/src/components/WaveformSeekBar.tsx` — SVG waveform visualization
- Click/drag to seek, brand-500 color for played portion
- Replaces flat progress bar in NowPlaying when peaks available

---

## Phase 8: PWA Enhancements ✅ DONE

### 8a. MediaSession API ✅ DONE
- `navigator.mediaSession.metadata` set on track play (title, artist, album, artwork)
- Action handlers: play, pause, previous, next, seekto, seekbackward, seekforward
- `playbackState` updated on play/pause
- `positionState` updated on seek

### 8b. Lossy transcode profile (opt-in) ✅ DONE
- Settings page: enable/disable, format (AAC/Opus/OGG), bitrate (128-320 kbps)
- Backend transcodes via ffmpeg, falls back to original when unavailable
- `GET/PUT /api/settings/transcode` — config endpoints
- `GET /api/tracks/{id}/stream/transcoded` — transcoded stream

---

## Phase 9: Codebase Hardening

### 9a. SQLite busy_timeout ✅ DONE
- Added `PRAGMA busy_timeout=5000` to `db.rs` alongside WAL PRAGMAs
- Prevents "database is locked" when scan + stream land simultaneously

### 9b. Keyset pagination ✅ DONE
- `GET /api/tracks?last_id=xxx&order=DESC` uses `WHERE id < last_id ORDER BY id DESC LIMIT n`
- Backward compatible: `?page=2` still works via OFFSET
- Keeps query fast at offset 100,000+

### 9c. Health endpoint ✅ DONE
- `GET /api/health` → `{ status: "ok", db: "connected", version: "0.5.4" }`
- Docker HEALTHCHECK uses this instead of raw port check
- Updater reads version from VERSION file

### 9d. Docker socket isolation
- Separate `docker-compose.override.yml` for Docker socket mount
- Main compose file has no socket access
- Document the security implications

### 9e. Remove unused dependencies ✅ DONE
- Removed `rusqlite` from workspace and backend Cargo.toml

---

## Phase 10: Multi-Room / Cast Output

Biggest lift, but the premium differentiator (Roon's whole pitch).

### HTTP Push approach ✅ DONE
- `CastTarget` model with id, name, host, port, protocol, is_connected, volume
- `POST /api/cast/targets` — register a cast target
- `DELETE /api/cast/targets/{id}` — unregister
- `GET /api/cast/targets` — list targets
- `POST /api/cast/play` — tell target to stream from server
- `POST /api/cast/control` — send play/pause/stop/seek/volume commands
- Frontend: cast button in NowPlaying with target dropdown
- Settings page: cast target management UI
- `useCastStore` with full cast lifecycle management

---

## Priority Order

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

# PLAN-polish.md — Polish Milestone

**Status:** COMPLETE (all three slices done, gates passed; final gate 2026-08-15)
**Goal:** Code-level polish across all five areas (UI/UX, small bug fixes, performance,
backend hardening, docs/consistency). No new features except the two sanctioned items
(MusicTools Transfer tab wiring, album/artist card navigation).

## Process (locked)

- Slice pattern: three sequential slices, end-to-end each, verification gate between.
- DoD: automated only — `npm run build` (frontend/dist embeds into backend) +
  `cargo check -p resonance-backend` + `cargo test -p resonance-backend --lib`.
- Back-to-back in one session; no pause between slices.
- Nothing off-limits; no feature work beyond the two items above.
- New migrations allowed (two: 010, 011).

---

## Slice 1 — Bug Fixes + Backend Correctness

> **STATUS: COMPLETE (2026-08-15).** Gate passed: `npm run build` ✓ · `cargo check -p
> resonance-backend --lib --bins` ✓ · `cargo test -p resonance-backend --lib` ✓ (1/1).
> All 1a-1f items done; see "1g. Decisions / deviations" for where intent was adjusted.

### 1a. Verified bugs (broken features)

- `musical_key`: models.rs:254 + handlers.rs:501-502/551-552 reference a column no
  migration created → every update_track with musical_key set fails. Fix: add column in
  `010_polish_fixes.sql` (`ALTER TABLE tracks ADD COLUMN musical_key TEXT`).
- Subsonic `songIndexToRemove` (subsonic.rs:959-967): `DELETE ... WHERE id IN (SELECT id
  FROM playlist_tracks ...)` — playlist_tracks (001_initial.sql:104-112) has no `id`
  column (PK is playlist_id+track_id). Fix: rewrite to delete by (playlist_id, track_id)
  pairs: `SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position
  LIMIT 1 OFFSET ?` then `DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?`.
- `/api/history` (handlers.rs:1373): `played_at` is TEXT (`datetime('now')`) but decoded
  as `Option<i64>` → decode error → `unwrap_or_default()` → always empty. Fix: decode as
  `String`; frontend already does `new Date(entry.played_at)` (HistoryPage.tsx:87).

### 1b. Validation

- Pagination: per_page/limit clamped to 1..=200 at handlers.rs:324, 971, 1022, 1054,
  1111, 1128, 1372, 1631 (negative → SQLite negative LIMIT = no limit; 0 → empty).
- updater interval: update_updater_config (handlers.rs:1858) validate check_interval_hours
  >= 1 (0 → sleep(0) hot loop hammering GitHub API).
- create_library (handlers.rs:40): reject empty name/path.
- update_transcode_settings (handlers.rs:3162): validate format whitelist + bitrate range.
- Admin create_user (handlers.rs:3842): validate username/password length (mirror register_handler).

### 1c. Cookies

- `secure(true)` at handlers.rs:3803, 3820, 4023, 4076 breaks plain-HTTP LAN login.
  Fix: scheme-detect — secure only when request is HTTPS or X-Forwarded-Proto=https.
  Small helper `is_https(&req)`.

### 1d. Error-swallowing sweep (all ~24 sites)

- Fetch-all/COUNT sites using `.unwrap_or_default()`/`.unwrap_or(0)` → return real
  500 + `log::error` (handlers.rs:408, 422, 997, 1033, 1038, 1065, 1074, 1082, 1092, 1118,
  1135, 1146, 1157, 1191, 1201, 1208, 1324, 1379, 1692, 2038, 3052, 3627, 3654, 3667).
- `hash_password` panic (handlers.rs:3727) → return Result/error response.
- Discard sites: import_device_music `Err(_) => skipped` (2553-2556), `let _ =
  execute()` inserts (2526-2531 create_library, 4059 guest user), record_play FK-void
  .ok() (1393), generate_playlist insert discard (1706), transcode read_to_end/proc.wait
  `let _` (3249/3252), confirm_import added++ even when OR IGNORE skipped (2467).
  Each: check result, log on error, keep behavior correct.

### 1e. Remaining backend candidates

- X-Forwarded-For rate limit (license_handlers.rs:20) → use peer_addr like handlers.rs:4044.
- Search apostrophe double-escaping (handlers.rs:1053) — remove `replace('\\'', "''")`;
  parameter binding already escapes. (Also fixed by FTS5 in slice 3; keep both consistent.)
- HMAC_SECRET (auth.rs:11-20): persist generated secret to data dir file on first run
  (0600 perms on Unix); env var still wins.
- Dedup: route table triplicated (main.rs:196-459, lib.rs:176-439, lib.rs:515-776) →
  shared `register_routes(cfg, data)` helper; 46-column INSERT ×3 (handlers.rs:188-246,
  watcher.rs:169-221, 279-331) → shared insert helper; path-within-libraries validation
  ×5 (handlers.rs:652-675, 3195-3217, 3291-3312, 2035-2048, subsonic.rs:523-542) → shared helper.
- `require_auth` boilerplate (~75 sites) → lightweight macro `auth_guard!(req)`.
- Subsonic query-string parsing (subsonic.rs:13-47) → `web::Query` structs.
- `format!`-built SQL (handlers.rs:399, 414, 991, 1025-1028) → bind params.
- compute_gain.rs:52/67 lock().unwrap() poison → `unwrap_or_else(|e| e.into_inner())`.

### 1f. Dead code

- Delete `frontend/src/components/WaveformSeekBar.tsx` (never imported; duplicate of
  WaveformDisplay).
- watcher.rs:79 `remove_library` (never used) → delete.
- lib.rs:33 + main.rs:32 unused `static_dir` param → delete (fixes cargo warnings).
- Dead click handlers: SearchModal album/artist rows (165-212) + AlbumsPage cards —
  actually WIRE navigation (slice 2 item) — remove cursor-pointer only if not wired.

### 1g. Decisions / deviations (recorded during implementation)

- **INSERT dedup target:** the shared helper became `impl Track { insert(executor) }` in
  models.rs with a generic `sqlx::Executor` — covers all three 46-column `INSERT OR
  REPLACE` sites (watcher ×2, handlers scan_library, which runs inside a transaction via
  `track.insert(&mut *tx)`). `import_device_music`'s 40-column `INSERT OR IGNORE` is a
  different shape/semantics → left inline (not deduped).
- **`auth_guard!` macro:** local `macro_rules!` in handlers.rs; applied to all 74
  `if let Err(e) = require_auth(&req)` sites. Sites using `match require_auth(&req)` to
  bind the user (4 in handlers.rs, 4 in license_handlers.rs) intentionally untouched.
- **Subsonic query-string parsing (1e):** already satisfied — every subsonic handler
  takes `web::Query<Value>`; only `require_subsonic_auth` re-parses the raw query string
  for t/s/u/p auth params (it runs inside handlers, not as an extractor). Left as-is.
- **`format!`-built SQL (1e):** skipped as churn-optional — `sort_col`/`order_dir` are
  whitelisted and `per_page` is an `i32` bind; no injection or correctness risk.
- **`health_check` unwraps:** intentionally left — `db_ok` flag is the degraded-status
  signal; falling back to `unwrap_or(0)/unwrap_or(false)` is the design.
- **`register_routes`:** verified no `PUT /api/playlists/{id}` route exists in any copy
  and the frontend never calls it → not added (not a bug).
- **import_device_music existing-check:** now `log::error` on query failure instead of
  silent `skipped += 1` (bulk import continues on per-track errors).

---

## Slice 2 — UI/UX Polish (all 5 tiers)

> **STATUS: COMPLETE (2026-08-15).** Gate passed: `npm run build` ✓ (tsc + vite, 32.93s) ·
> `cargo check -p resonance-backend --lib --bins` ✓ · `cargo test -p resonance-backend --lib` ✓
> (1/1). All 2a-2d items done; see "2e. Decisions / deviations".

### 2e. Decisions / deviations (recorded during implementation)

- **ImportPage syntax repair:** the platform-selector ternary introduced in 2d did not
  parse (TS1005/TS1381 at 236-241 despite balanced delimiters) → rewrote the third branch
  as a fragment (`<>...</>`); tsc + build clean after.
- **TransferTab (2d):** replaced the fake "From Platform"/token/OAuth-toast flow entirely —
  it now loads playlists via `api.playlists.list()` and exports with `api.transfer.export`
  (same download handler as TransferPage:58), including real blob download + filename from
  Content-Disposition. No OAuth UI remains.
- **Card navigation (2d):** AlbumCard/ArtistCard gained a default click → navigate to
  `/library?album=<id>`/`?album`/`?artist` is a NEW param — `?album=` previously meant an
  album-NAME filter; now LibraryPage treats `?album=`/`?artist=` as IDs and passes
  `album_id`/`artist_id` to the API. Backend resolves the id via the `albums`/`artists`
  tables to (title, artist) / name, then filters by string columns (tracks have no FK
  columns); unknown id → `1=0` (empty result). `album_id`/`artist_id`/`recent` added to
  `QueryParams` (models.rs + types/index.ts).
- **Recent chip (2d):** now server-side `recent=true` → `date_added >= datetime('now',
  '-7 days')`; client-side date filter removed.
- **TrackList context menu (2d):** anchored via `getBoundingClientRect()` of the More
  button (viewport-relative, clamped to keep menu on-screen on `md+`); mobile keeps the
  bottom sheet (inline style applied only when `window.innerWidth >= 768`).
- **UpdateBanner (2d):** `lg:left-64` so the banner no longer covers the fixed sidebar.
- **UpgradePage (2d):** dead `resonance.app/pricing` text removed — keys are generated
  server-side by the admin; copy now says so (no fake link to invent).
- **`__APP_VERSION__` (2d):** defined in vite.config.ts from package.json (v0.7.0);
  declared in vite-env.d.ts; used in SettingsPage About (replaces hardcoded v0.1.0).
  Sidebar:133/updater:1139 left as-is (no hardcoded version there).
- **HomePage (2d):** stat emoji → inline SVG icons; QuickPickCard `queue` prop removed.
- **LibraryPage album/artist context:** no name banner added (ids only, no extra fetch);
  the filtered list + count + chip reset (`handleChipClick` clears album/artist filters)
  is the affordance.

---

### 2a. Broken CSS

- 7 Settings toggles `translate-x-5.5` (SettingsPage.tsx:900, 922, 988, 1018, 1085, 1163,
  1206) → `translate-x-[22px]` (or extend spacing in tailwind.config).
- EQ `var(--color-brand-500)` (EqualizerPage.tsx:22, 128, 140) → use defined brand token
  (check what's emitted; likely rgb(var(--brand-500)) or hex from config).
- Implement `glass-panel` (FileBrowser.tsx:117), `scrollbar-hide` + `mask-gradient`
  (LyricsPanel.tsx:120) in index.css.

### 2b. Light-theme fixes

- MobileBottomNav.tsx:11,20,33,42,55,122,126 `text-white/50` → text token.
- TrackList.tsx:189-191 + StarRating.tsx:51-58 `#1DB954` → brand token.
- LibraryPage.tsx:282 `bg-gray-800`, :524 `bg-gray-900` → surface tokens.
- HistoryPage.tsx:80 `text-white/40` → text-secondary/tertiary.

### 2c. Touch + a11y

- Hover-only controls → always-visible on `pointer: coarse` (add utility/media query in
  index.css; apply at: NowPlaying volume (740-766) + progress thumb (613), MiniPlayer:232,
  QueuePanel:230, SmartQueue:201, Cards:55).
- Responsive: NowPlaying fullscreen artwork `w-[400px] h-[400px]` (454) → max-w/max-h +
  aspect-square; QueuePanel:52, SmartQueue:97, EffectsPanel:76 `w-80` → max-w-[calc(100vw-1rem)].
- Toast.tsx:61 `bottom-24` + role="status"/aria-live.
- a11y: aria-labels on icon-only buttons (TrackList:212 More, Cards play, EffectsPanel:46-68,
  UpdateBanner:96, FileBrowser:134, LibraryPage:426-455, NowPlaying:344), focus-visible rings
  where `focus:outline-none` (StarRating:43), keyboard handlers for onClick divs
  (GenresPage:42, FoldersPage:37-58, HistoryPage:77, SyncedLyrics:64), KeyboardShortcutsOverlay
  dialog role + close button, ⌘K platform detect (Header:33).

### 2d. Error states + rough UI

- New shared `ErrorState` component (message + retry) in components/; use on AlbumsPage:17,
  ArtistsPage:16, GenresPage:15, FoldersPage:15, PlaylistsPage:40, PlaylistToolsPage:96,
  HistoryPage:40, ImportPage:65, SearchModal:44-46, MusicToolsPage:151 (also empty-state
  for zero search results).
- MusicTools TransferTab (MusicToolsPage.tsx:210-303): wire to existing export API
  (`api.transfer.export`, same as TransferPage:58); drop the OAuth toast.
- Card navigation: AlbumCard/ArtistCard + SearchModal album/artist rows → navigate to
  `/library?album=<id>` / `/library?artist=<id>`; LibraryPage gains server-side
  `?album=`/`?artist=` filters (backend get_tracks gains album_id/artist_id params).
- LibraryPage "Recent" chip (80-84): server-side filter (date param) instead of client-side.
- TrackList context menu (246): anchor to clicked row instead of screen center.
- UpdateBanner:96: avoid fixed top-0 overlap with sticky header.
- ImportPage:244: file size from Blob/actual bytes.
- UpgradePage:167 pricing span → link; :138 contact → mailto/link.
- Version string: Vite `define` `__APP_VERSION__` from package.json; use in Sidebar:133,
  SettingsPage About:1254, updater fallback (1139).
- HomePage emoji icons (375-378) → SVG icon system; remove unused QuickPickCard `queue` prop.

---

## Slice 3 — Performance + Docs

> **STATUS: COMPLETE (2026-08-15).** Gate passed: `npm run build` ✓ (12.55s, tsc clean) ·
> `cargo check -p resonance-backend --lib --bins` ✓ · `cargo test -p resonance-backend --lib` ✓
> (1/1). All 3a-3e items done; see "3f. Decisions / deviations".

### 3f. Decisions / deviations (recorded during implementation)

- **FTS5 table shape:** standalone virtual table (NOT external-content) with a
  `track_id UNINDEXED` column + AFTER INSERT/UPDATE/DELETE triggers keyed on
  `new.rowid`/`old.rowid`. Search does `tracks_fts f JOIN tracks t ON t.id =
  f.track_id WHERE tracks_fts MATCH ? ORDER BY bm25(tracks_fts)`, which gives
  relevance-ranked results (better than the old play_count ordering).
- **Query sanitization:** `build_fts_query` splits on whitespace/punctuation, strips
  FTS5 syntax chars, and prefix-matches every token (`machi*`), preserving the old
  substring behavior; apostrophes are separators in unicode61 (the 1e double-escape
  bug site is gone entirely). Empty sanitized query → empty results.
- **Backfill:** runs at startup in all three server entry points (main.rs + lib.rs ×2)
  as a spawned task: COUNT check, `INSERT INTO tracks_fts(tracks_fts) VALUES('rebuild')`
  once if empty, then sets an `fts_ready: AtomicBool` on AppState. `search()` falls back
  to the old 7-column LIKE query until ready, so the first seconds of a fresh boot
  still return results.
- **Waveform (3c):** scan no longer decodes for peaks (scanner.rs:128 removed);
  `get_waveform` fetches `(waveform_peaks, file_path)`, and when peaks are NULL
  computes them in `spawn_blocking` and persists to the DB before responding
  (exact ReplayGain lazy pattern). Unknown track id now returns 404 (was 200 with
  empty peaks).
- **Importer (3d):** `match_tracks` now builds a HashMap over normalized
  (title, artist) pairs + a normalized-title map once per import. Tiers collapse:
  exact pair key → 1.0 "exact"; title key (artist-preference pick) → 0.9 "fuzzy".
  The O(n×m) substring-contains tiers and the "title_only" 0.6 type are gone
  (no frontend/backend references to "title_only" existed). Sanctioned by the plan.
- **README (3e):** API paths verified against the actual route table (e.g.
  `POST /api/tracks/{id}/gain/compute`, `GET /api/tracks/similar`,
  `POST /api/playlists/generate`, `POST /api/transfer/export`, settings under
  `/api/settings/*`). ReplayGain/offline/installer items moved Roadmap → Features
  per plan; MSI/NSIS → Inno Setup wording; pro-gating note added.

---

### 3a. Migrations

- `010_polish_fixes.sql`: `ALTER TABLE tracks ADD COLUMN musical_key TEXT;` + indexes:
  `idx_tracks_fingerprint` on tracks(fingerprint); composite `idx_lh_track_played` on
  listening_history(track_id, played_at).
- `011_search_fts5.sql`: FTS5 virtual table over tracks (title, artist, album, genre,
  file_name, folder, lyrics) + triggers on tracks INSERT/UPDATE/DELETE + backfill handled
  in code at startup (background task) — NOT in migration (avoid long lock).

### 3b. Search

- handlers.rs search (1054): replace 7-column leading-wildcard LIKE with FTS5 MATCH
  (substring behavior via prefix tokenization; keep lyrics included). Apostrophe handling
  is free (FTS5 tokenizer).
- Startup background backfill task: `INSERT INTO tracks_fts(tracks_fts) VALUES('rebuild')`
  once if empty; log completion.

### 3c. Waveform lazy compute

- scanner.rs:358: stop decoding for peaks at scan; `get_waveform` (handlers.rs) computes +
  persists on first request when missing (exact ReplayGain pattern: spawn_blocking + cache).

### 3d. Importer

- importer.rs:490 `match_tracks`: replace O(n×m) nested loop with a HashMap lookup keyed
  on normalized (title, artist) — or (title) fallback — of all DB tracks.

### 3e. README full pass (14 items)

- ReplayGain, offline playback, desktop installers: Roadmap → Features; fix MSI/NSIS →
  Inno Setup wording.
- Clone URL placeholder → github.com/pandejesal/resonance.
- "Never compresses, transcodes" → qualify (opt-in lossy transcode exists).
- Pro gating note (equalizer etc. pro-locked).
- Architecture tree: add compute_gain.rs, license_handlers.rs.
- "Smart organization by composer/mood/BPM" → qualify; remove "pull-to-refresh".
- Document playlist tools (shuffle/sort/dedupe/stats/share/generate), transfer/export.
- API Reference: waveform, gain, batch-delete, batch-rating, similar, recently/most-played,
  guest-auth endpoints.

---

## Verification (each slice)

1. `npm run build` (workdir frontend) — clean
2. `cargo check -p resonance-backend` (workdir root) — only pre-existing warnings allowed
3. `cargo test -p resonance-backend --lib` — compute_gain + other tests pass
   (use timeout ≥1500000ms; test binary compile is slow on this machine)
4. Disk: check `Get-PSDrive C` free space before cargo work (was 9.5 GB)

# Scrobbling Implementation Plan (Last.fm + ListenBrainz)

## Current State
- Backend tracks play counts and listening history in SQLite
- `play_track` handler updates `play_count` and `listening_history` table
- No external API integration exists yet
- `reqwest` already in Cargo.toml for HTTP requests

## Architecture

```
play_track handler
    ↓
tokio::spawn (background)
    ↓
ScrobbleService
    ├── Last.fm API (POST ws.audioscrobbler.com/2.0/)
    └── ListenBrainz API (POST api.listenbrainz.org/1/submit-listens)
```

Config stored in SQLite `settings` table (JSON blob per service).

## Backend Implementation

### Step 1: Settings Table + Models
Add to `001_initial.sql`:
```sql
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Add to `models.rs`:
- `ScrobblingConfig { lastfm: LastfmConfig, listenbrainz: ListenbrainzConfig }`
- `LastfmConfig { enabled, api_key, session_key, username }`
- `ListenbrainzConfig { enabled, token }`

### Step 2: Scrobble Module
Create `backend/src/scrobble.rs`:
- `ScrobbleService` struct holding `reqwest::Client`
- `scrobble_lastfm(track, config)` — POST with `method=track.scrobble`, MD5 signature
- `scrobble_listenbrainz(track, config)` — POST with `listen_type=import`
- `update_now_playing_lastfm(track, config)` — POST with `method=track.updateNowPlaying`
- `update_now_playing_listenbrainz(track, config)` — POST with `listen_type=playing_now`
- Retry logic: store failed scrobbles in `pending_scrobbles` table, retry on next play

### Step 3: Settings Handlers
Add to `handlers.rs`:
- `GET /api/settings/scrobbling` — return current config
- `PUT /api/settings/scrobbling` — save config
- `POST /api/settings/scrobbling/test` — test connection to each service

### Step 4: Integrate into play_track
Modify `play_track` handler:
- After DB update, `tokio::spawn` scrobble to enabled services
- Send `update_now_playing` immediately
- Send `scrobble` after 50% of track duration or 4 minutes (whichever comes first)

## Frontend Implementation

### Step 5: Scrobbling Settings UI
Add to `SettingsPage.tsx`:
- **Last.fm section**: Enable toggle, API key input, session key input, username display, "Connect" button
- **ListenBrainz section**: Enable toggle, token input, "Connect" button
- Connection status indicators (green dot = connected, red = disconnected)
- "Test Connection" button for each

### Step 6: API Client
Add to `api.ts`:
```typescript
settings: {
  getScrobbling: () => fetchJson<ScrobblingConfig>('/settings/scrobbling'),
  updateScrobbling: (data) => fetchJson('/settings/scrobbling', { method: 'PUT', body: JSON.stringify(data) }),
  testScrobbling: (service) => fetchJson(`/settings/scrobbling/test?service=${service}`, { method: 'POST' }),
}
```

## Last.fm API Details
- Base URL: `https://ws.audioscrobbler.com/2.0/`
- Auth: API key + session key (obtained via web auth flow)
- Scrobble: `method=track.scrobble&artist=X&track=Y&timestamp=Z&sk=SESSION_KEY&api_key=KEY`
- Signature: MD5 of sorted params + secret
- Now Playing: `method=track.updateNowPlaying&artist=X&track=Y&sk=SESSION_KEY&api_key=KEY`

## ListenBrainz API Details
- Base URL: `https://api.listenbrainz.org/1/`
- Auth: User token from listenbrainz.org/settings
- Scrobble: `POST /1/submit-listens` with `listen_type=import`
- Now Playing: `POST /1/submit-listens` with `listen_type=playing_now`
- Payload: `[{ track_metadata: { artist_name, track_name, release_name } }]`

## Files to Create/Modify

| File | Action |
|------|--------|
| `backend/src/scrobble.rs` | **Create** — ScrobbleService, Last.fm + ListenBrainz APIs |
| `backend/src/main.rs` | **Modify** — Add `mod scrobble`, settings routes |
| `backend/src/models.rs` | **Modify** — Add scrobbling config structs, settings models |
| `backend/src/handlers.rs` | **Modify** — Add settings handlers, modify play_track |
| `backend/migrations/002_scrobbling.sql` | **Create** — settings table + pending_scrobbles table |
| `frontend/src/pages/SettingsPage.tsx` | **Modify** — Add scrobbling settings UI |
| `frontend/src/lib/api.ts` | **Modify** — Add settings API methods |
| `frontend/src/types/index.ts` | **Modify** — Add ScrobblingConfig types |

## Verification
1. `docker compose up -d --build` — builds without errors
2. `GET /api/settings/scrobbling` — returns empty config
3. `PUT /api/settings/scrobbling` — saves config
4. Play a track — scrobble fires in background (check logs)
5. Settings page — Last.fm and ListenBrainz sections visible and functional
6. Failed scrobbles retry on next play

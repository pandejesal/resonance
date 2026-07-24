# Auto-Updater Implementation Plan

## Current State
- Docker-based deployment with `docker-compose.yml`
- GitHub repo: `https://github.com/pandejesal/resonance`
- No VERSION file exists — version hardcoded in SettingsPage as `v0.1.0`
- No update mechanism currently

## Architecture

```
Backend (periodic check) ──→ GitHub API ──→ Compare commit hashes
        ↓                                      ↓
  Store in DB                          Update available?
        ↓                                      ↓
  GET /api/updater/status          Show notification in UI
        ↓                                      ↓
  POST /api/updater/update    ──→   git pull → docker rebuild → restart
```

## Backend Implementation

### Step 1: Version File
Create `VERSION` file in project root with current version string (e.g., `0.1.0`). Read at startup, include in API responses.

### Step 2: Updater Module
Create `backend/src/updater.rs`:
- `UpdateStatus { current_version, latest_version, update_available, last_checked, commit_url, checking }`
- `check_for_updates(db)` — GitHub API `GET https://api.github.com/repos/pandejesal/resonance/commits/main`
- Compare latest commit SHA with stored `current_commit` in settings
- `apply_update()` — Execute `git pull` + `docker compose build && docker compose up -d`
- `get_updater_status(db)` — Return cached status
- Background task: check every 6 hours (configurable)

### Step 3: Updater Handlers
Add to `handlers.rs`:
- `GET /api/updater/status` — Return current update status
- `POST /api/updater/check` — Manually trigger update check
- `POST /api/updater/update` — Apply update (requires Docker socket)
- `GET /api/updater/config` — Get auto-check config
- `PUT /api/updater/config` — Update auto-check config

### Step 4: Database
Add to `003_updater.sql` migration:
```sql
CREATE TABLE IF NOT EXISTS updater_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Step 5: Startup Check
In `main.rs`, spawn a background task that checks for updates on startup and every 6 hours.

## Frontend Implementation

### Step 6: Update Banner
Create `frontend/src/components/UpdateBanner.tsx`:
- Fixed banner at top of page when update available
- Shows "Update available: v0.2.0" with "Update Now" and "Dismiss" buttons
- Animated slide-in from top
- Only shows when update is available

### Step 7: Updater Settings
Add to `SettingsPage.tsx`:
- **Updates section**:
  - Current version display
  - Auto-check toggle
  - Check interval selector (1h, 6h, 12h, 24h, weekly)
  - "Check Now" button
  - Last checked timestamp
  - "Update Now" button (when update available)

### Step 8: API Client
Add to `api.ts`:
```typescript
updater: {
  getStatus: () => fetchJson<UpdateStatus>('/updater/status'),
  check: () => fetchJson<UpdateStatus>('/updater/check', { method: 'POST' }),
  update: () => fetchJson('/updater/update', { method: 'POST' }),
  getConfig: () => fetchJson<UpdaterConfig>('/updater/config'),
  updateConfig: (data) => fetchJson('/updater/config', { method: 'PUT', body: JSON.stringify(data) }),
}
```

### Step 9: Notification Store
Add to `UIStore`:
- `updateAvailable: boolean`
- `updateVersion: string | null`
- `showUpdateBanner: boolean`

## Files to Create/Modify

| File | Action |
|------|--------|
| `VERSION` | **Create** — Current version string |
| `backend/migrations/003_updater.sql` | **Create** — updater_state table |
| `backend/src/updater.rs` | **Create** — GitHub API check, update logic |
| `backend/src/handlers.rs` | **Modify** — Add updater endpoints |
| `backend/src/main.rs` | **Modify** — Add mod updater, routes, background check |
| `frontend/src/components/UpdateBanner.tsx` | **Create** — Update notification banner |
| `frontend/src/pages/SettingsPage.tsx` | **Modify** — Add updater settings section |
| `frontend/src/lib/api.ts` | **Modify** — Add updater API methods |
| `frontend/src/types/index.ts` | **Modify** — Add UpdateStatus, UpdaterConfig types |
| `frontend/src/stores/index.ts` | **Modify** — Add update state to UIStore |
| `frontend/src/App.tsx` | **Modify** — Render UpdateBanner |
| `docker/docker-compose.yml` | **Modify** — Optional: mount Docker socket for auto-update |

## Security Considerations
- Update check is safe (read-only GitHub API call)
- Applying updates requires Docker socket access (optional, not enabled by default)
- Without Docker socket, user sees notification but must update manually via `git pull && docker compose up -d --build`
- Auto-update is disabled by default, must be explicitly enabled

## Verification
1. `docker compose up -d --build` — builds without errors
2. `GET /api/updater/status` — returns current version and check status
3. `POST /api/updater/check` — triggers GitHub API check, returns latest version
4. Settings page — updater section visible with current version and check button
5. Update banner appears when update is available
6. "Update Now" button triggers git pull + rebuild (if Docker socket mounted)

# Lyrics Implementation Plan

## Current State
- `tracks` table has `lyrics TEXT` column
- Scanner reads lyrics from file tags via `tag.get_string(&ItemKey::Lyrics)`
- Frontend has `lyricsOpen` state + "Lyrics" button in NowPlaying (no panel renders)
- No external lyrics API integration
- No LRC file parsing
- No synced lyrics display

## Architecture

```
GET /api/tracks/{id}/lyrics → returns stored lyrics (plain or LRC)
POST /api/tracks/{id}/lyrics/fetch → fetches from LRCLIB, saves to DB
POST /api/tracks/{id}/lyrics → update lyrics manually

LRCLIB API (free, no auth):
  GET https://lrclib.net/api/get?artist_name=X&track_name=Y&album_name=Z&duration=D

LRC Format:
  [00:12.34]Line 1
  [00:15.67]Line 2
```

## Backend Implementation

### Step 1: Lyrics Module
Create `backend/src/lyrics.rs`:
- `LrcLine { time_ms: u32, text: String }` struct
- `parse_lrc(content: &str) -> Vec<LrcLine>` — parse LRC format
- `fetch_from_lrclib(artist, track, album, duration) -> Option<LyricsResult>` — HTTP GET to LRCLIB
- `LyricsResult { plain: String, synced: Option<String> }` — result type

### Step 2: Lyrics Handlers
Add to `handlers.rs`:
- `GET /api/tracks/{id}/lyrics` — return `{ plain: "...", synced: "..." }`
- `POST /api/tracks/{id}/lyrics/fetch` — fetch from LRCLIB, save to DB
- `PUT /api/tracks/{id}/lyrics` — update lyrics manually

### Step 3: Database
No migration needed — `lyrics TEXT` column already exists. Store LRC content directly in `lyrics` column. Frontend distinguishes plain vs synced by checking for `[mm:ss.xx]` pattern.

## Frontend Implementation

### Step 4: Lyrics Types
Add to `types/index.ts`:
```typescript
interface LyricsLine {
  timeMs: number;
  text: string;
}

interface LyricsData {
  plain: string;
  synced: string | null;
}
```

### Step 5: Lyrics Panel
Create `frontend/src/components/LyricsPanel.tsx`:
- When `lyricsOpen` is true, render over the waveform area in NowPlaying
- Parse synced lyrics into lines with timestamps
- Auto-scroll to current line based on `progress` from player store
- Highlight current line (brand color, larger text)
- If no synced lyrics, show plain text centered
- "Fetch Lyrics" button when no lyrics available
- "Edit" button to manually paste/type lyrics

### Step 6: Integrate into NowPlaying
Modify `NowPlaying.tsx`:
- When `lyricsOpen`, render `LyricsPanel` instead of waveform visualization
- Pass `progress` for sync, `currentTrack` for fetching

### Step 7: API Client
Add to `api.ts`:
```typescript
tracks: {
  getLyrics: (id: string) => fetchJson<LyricsData>(`/tracks/${id}/lyrics`),
  fetchLyrics: (id: string) => fetchJson<LyricsData>(`/tracks/${id}/lyrics/fetch`, { method: 'POST' }),
  updateLyrics: (id: string, lyrics: string) => fetchJson(`/tracks/${id}/lyrics`, { method: 'PUT', body: JSON.stringify({ lyrics }) }),
}
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `backend/src/lyrics.rs` | **Create** — LRC parser, LRCLIB API client |
| `backend/src/handlers.rs` | **Modify** — Add lyrics endpoints |
| `backend/src/main.rs` | **Modify** — Add `mod lyrics`, routes |
| `frontend/src/types/index.ts` | **Modify** — Add LyricsLine, LyricsData |
| `frontend/src/components/LyricsPanel.tsx` | **Create** — Lyrics display with sync |
| `frontend/src/components/NowPlaying.tsx` | **Modify** — Render LyricsPanel when open |
| `frontend/src/lib/api.ts` | **Modify** — Add lyrics API methods |

## Verification
1. `docker compose up -d --build` — builds without errors
2. `GET /api/tracks/{id}/lyrics` — returns stored lyrics
3. `POST /api/tracks/{id}/lyrics/fetch` — fetches from LRCLIB if available
4. NowPlaying "Lyrics" button — shows lyrics panel
5. Synced lyrics auto-scroll to current line
6. Plain lyrics display centered without scroll
7. Edit button allows manual lyrics input

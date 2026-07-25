# Resonance — Agent Context

## Project Overview
Self-hosted music archival system. Rust backend + React/TypeScript frontend + Android/iOS native shells.

## Architecture
```
resonance/
├── backend/          # Rust (Actix-web + SQLite + sqlx)
│   ├── src/
│   │   ├── main.rs       # Binary entry point
│   │   ├── lib.rs         # start_server() with all routes
│   │   ├── handlers.rs    # 45+ HTTP endpoints
│   │   ├── db.rs          # SQLite connection + PRAGMAs
│   │   ├── scanner.rs     # Parallel file scanning (Rayon)
│   │   ├── models.rs      # All data types (Serialize/Deserialize)
│   │   ├── auth.rs        # Base64 token auth (WARNING: no HMAC)
│   │   ├── subsonic.rs    # Subsonic API emulation
│   │   ├── ws.rs          # WebSocket (actix-ws)
│   │   ├── watcher.rs     # Filesystem watcher (notify)
│   │   ├── scrobble.rs    # Last.fm + ListenBrainz
│   │   ├── lyrics.rs      # LRCLIB integration
│   │   ├── updater.rs     # GitHub-based auto-updater
│   │   └── importer.rs    # Platform import (Spotify, YT Music, etc.)
│   └── migrations/        # SQL migrations (001-007)
├── frontend/         # React 18 + TypeScript + Vite + Tailwind
│   └── src/
│       ├── App.tsx            # Root layout + routing
│       ├── components/        # 14 reusable components
│       ├── pages/             # 15 page components
│       ├── stores/index.ts    # Zustand stores (Player, UI, Auth, Cast)
│       ├── lib/api.ts         # API client
│       ├── lib/audio-engine.ts # Web Audio API EQ
│       └── types/index.ts     # All TypeScript interfaces
├── android/          # Kotlin WebView shell (API 29+)
│   └── app/src/main/java/com/pandejesal/resonance/
│       ├── MainActivity.kt      # WebView + JS bridge
│       ├── BackendPlugin.kt     # JNI native library loader
│       └── MediaSessionService.kt # Foreground notification
└── src-tauri/        # Tauri desktop wrapper (Rust + WebView2)
```

## Tech Stack
- **Backend**: Rust 1.70+, Actix-web 4, SQLx (SQLite WAL), Rayon, lofty-rs, reqwest
- **Frontend**: React 18, TypeScript 5, Vite 5, Tailwind CSS 3, Framer Motion, Zustand
- **Android**: Kotlin, minSdk 29, WebView, JNI (resonance_backend.so)
- **Desktop**: Tauri 2, WebView2 (Windows), WKWebView (macOS)
- **Database**: SQLite with WAL mode, PRAGMA busy_timeout=5000

## Key Patterns
- All music files remain untouched; metadata stored in SQLite
- Backend compiles to both binary (server) and cdylib (Android JNI)
- Frontend served from backend's static file directory
- Authentication: base64 token (WARNING: no HMAC signing — known issue)
- WebSocket for real-time scan progress and now-playing updates

## Build Commands
```bash
# Backend
cd backend && cargo check          # Type check
cd backend && cargo build --release # Release build

# Frontend
cd frontend && npm run build       # TypeScript + Vite build
cd frontend && npm run dev         # Dev server

# Android
cd android && ./gradlew assembleDebug
```

## Known Issues (Fix Priority)
1. **CRITICAL**: auth.rs tokens have no HMAC — forgeable
2. **CRITICAL**: handlers.rs SQL injection via format!() in get_tracks
3. **HIGH**: handlers.rs reads entire files into memory for streaming
4. **HIGH**: CORS allows any origin with credentials
5. **MEDIUM**: No error boundaries in React frontend
6. **MEDIUM**: 27 missing aria-labels in frontend

## Testing
- Backend: no formal test suite (add `#[cfg(test)]` modules)
- Frontend: no test framework configured
- Android: no instrumented tests

## Conventions
- Rust: `snake_case` functions, `PascalCase` types, `clippy::all` warnings
- TypeScript: `camelCase`, functional components, hooks pattern
- Kotlin: standard Android conventions, `PascalCase` classes
- Git: conventional commits (`feat:`, `fix:`, `chore:`)

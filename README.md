# Resonance - Self-Hosted Music Library

A premium, self-hosted music archival system that prioritizes speed, audio quality, and a beautiful user experience. Built with a Rust backend for maximum performance and a React frontend for a fluid, modern interface.

## Features

- **Bit-perfect playback** - Never compresses, transcodes, or modifies music files
- **Massive library support** - Handles 500,000+ songs with instant navigation
- **Modern UI** - Glassmorphism, dynamic gradients, 60-120 FPS animations
- **Universal access** - PWA support for Windows, Linux, macOS, Android, iPhone
- **Smart organization** - By artist, album, genre, composer, year, folder, mood, BPM
- **Instant search** - Results appear while typing across all metadata
- **Gapless playback** - Seamless transitions between tracks
- **ReplayGain & Crossfade** - Optional audio enhancement features
- **Touch-optimized** - Swipe navigation, pull-to-refresh, gestures

## Supported Formats

MP3, FLAC, ALAC, WAV, AIFF, OGG, Opus, AAC, M4A, DSD (optional)

## Tech Stack

### Backend
- **Rust** with Actix-web for blazing-fast API
- **SQLite** with WAL mode for efficient database operations
- **lofty-rs** for metadata extraction (bit-perfect)
- **Rayon** for multithreaded parallel scanning
- **Walkdir** for efficient filesystem traversal

### Frontend
- **React 18** with TypeScript for type safety
- **Vite** for instant development and optimized builds
- **Tailwind CSS** for utility-first styling
- **Framer Motion** for buttery-smooth animations
- **Zustand** for lightweight state management
- **React Virtuoso** for virtual scrolling

## Quick Start

### Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/resonance.git
cd resonance

# Edit docker-compose.yml to mount your music folder
# Update /path/to/your/music to your actual music directory

# Build and start
docker compose -f docker/docker-compose.yml up -d

# Access at http://localhost:8080
```

### Manual Build

#### Prerequisites
- Rust 1.75+
- Node.js 18+
- npm or yarn

#### Backend
```bash
cd backend
cargo build --release
./target/release/resonance-backend
```

#### Frontend
```bash
cd frontend
npm install
npm run build
# Serve the dist/ directory with any web server
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RUST_LOG` | `info` | Log level (info, debug, trace) |
| `DATABASE_URL` | `data/resonance.db` | SQLite database path |
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8080` | Server port |

### First Launch

1. Open the web interface at `http://localhost:8080`
2. Go to Settings → Add Library
3. Enter a name and the path to your music folder
4. Click "Add Library" then "Scan"
5. Wait for the scan to complete (runs in background)
6. Start browsing and playing your music!

## Architecture

```
resonance/
├── backend/
│   ├── src/
│   │   ├── main.rs          # Server entry point
│   │   ├── models.rs        # Data models
│   │   ├── db.rs            # Database layer
│   │   ├── scanner.rs       # Music file scanner
│   │   └── handlers.rs      # API handlers
│   ├── migrations/          # SQL migrations
│   └── Cargo.toml
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Route pages
│   │   ├── stores/          # Zustand stores
│   │   ├── lib/             # Utilities & API
│   │   └── types/           # TypeScript types
│   └── package.json
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
└── README.md
```

## API Reference

### Libraries
- `GET /api/libraries` - List all libraries
- `POST /api/libraries` - Create a library
- `DELETE /api/libraries/:id` - Delete a library
- `POST /api/libraries/:id/scan` - Start scanning
- `GET /api/libraries/:id/scan/progress` - Get scan progress

### Tracks
- `GET /api/tracks` - List tracks (with pagination, sorting, filtering)
- `GET /api/tracks/:id` - Get track details
- `PUT /api/tracks/:id` - Update track metadata
- `POST /api/tracks/:id/play` - Record play
- `GET /api/tracks/:id/stream` - Stream audio file
- `GET /api/tracks/:id/artwork` - Get album artwork

### Albums & Artists
- `GET /api/albums` - List albums
- `GET /api/artists` - List artists

### Search
- `GET /api/search?q=query` - Search tracks, albums, artists

### Playlists
- `GET /api/playlists` - List playlists
- `POST /api/playlists` - Create playlist
- `DELETE /api/playlists/:id` - Delete playlist
- `GET /api/playlists/:id/tracks` - Get playlist tracks
- `POST /api/playlists/:id/tracks` - Add track to playlist

### Statistics
- `GET /api/stats` - Get library statistics

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl + K` | Open search |
| `Space` | Play/Pause |
| `→` | Next track |
| `←` | Previous track |
| `↑` | Volume up |
| `↓` | Volume down |
| `Esc` | Close modals |

## Performance

- **SQLite WAL mode** for concurrent reads
- **Parallel file scanning** using Rayon thread pool
- **Virtual scrolling** for 500K+ track lists
- **Artwork caching** to disk for instant loading
- **Incremental scanning** - only processes new/changed files
- **Memory-efficient** architecture with streaming

## Security

- No authentication by default (suitable for LAN)
- CORS configured for local development
- No file modifications - read-only access to music
- SQL injection prevention via parameterized queries

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

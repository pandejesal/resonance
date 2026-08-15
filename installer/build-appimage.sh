#!/bin/bash
set -e

# Resonance Linux AppImage Builder (v0.8.0)
# Creates a portable AppImage that runs on any Linux distro.
# Expects `release/` containing resonance-backend, static/, VERSION.

APP_NAME="Resonance"
APP_VERSION="$(cat ../VERSION)"
APPDIR="AppDir"

echo "== Building Resonance Linux AppImage ${APP_VERSION} =="

# Check for linuxdeploy
if ! command -v linuxdeploy &>/dev/null && [ ! -f linuxdeploy ]; then
  echo "Downloading linuxdeploy (pinned: 1-alpha-20251107-1)..."
  curl -L -o linuxdeploy https://github.com/linuxdeploy/linuxdeploy/releases/download/1-alpha-20251107-1/linuxdeploy-x86_64.AppImage
  chmod +x linuxdeploy
  APPIMAGE_EXTRACT_AND_RUN=1 ./linuxdeploy --version
fi

# Check for release files
if [ ! -f "../release/resonance-backend" ]; then
  echo "Error: ../release/resonance-backend not found."
  echo "Run the build first: cargo build --release -p resonance-backend"
  exit 1
fi
if [ ! -d "../release/static" ]; then
  echo "Error: ../release/static not found (copy frontend/dist)."
  exit 1
fi

# Create AppDir structure
echo "[*] Creating AppDir..."
rm -rf "$APPDIR"
mkdir -p "$APPDIR/usr/bin"
mkdir -p "$APPDIR/usr/share/applications"
mkdir -p "$APPDIR/usr/share/icons/hicolor/256x256/apps"

# Copy backend + static (backend resolves static next to the exe)
cp ../release/resonance-backend "$APPDIR/usr/bin/"
cp -r ../release/static "$APPDIR/usr/bin/static"
mkdir -p "$APPDIR/usr/share/resonance"
cp ../VERSION "$APPDIR/usr/share/resonance/"

# Create launcher script
cat > "$APPDIR/usr/bin/resonance" <<'LAUNCHER'
#!/bin/bash
BIN_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/resonance"
mkdir -p "$DATA_DIR"
export DATABASE_URL="sqlite:$DATA_DIR/resonance.db"

# Per-user login autostart (created on first run from a stable path).
# Inside the AppImage runtime $APPIMAGE is the stable file path; the
# transient FUSE mount ($BIN_DIR) must never be written into autostart.
AUTOSTART_DIR="$HOME/.config/autostart"
if [ "$1" != "--start" ] && [ ! -f "$AUTOSTART_DIR/resonance.desktop" ]; then
  mkdir -p "$AUTOSTART_DIR"
  cat > "$AUTOSTART_DIR/resonance.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Resonance
Comment=Self-hosted music archival system
Exec=${APPIMAGE:-$BIN_DIR/resonance} --start
X-GNOME-Autostart-enabled=true
EOF
fi

# Start the backend if it is not already running (pidfile guard; the loser
# of a race fails to bind port 8080 and exits cleanly)
PIDFILE="$DATA_DIR/resonance.pid"
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  :
else
  nohup "$BIN_DIR/resonance-backend" >/dev/null 2>&1 &
  echo $! > "$PIDFILE"
fi

if [ "$1" = "--start" ]; then
  exit 0
fi

# Wait for the server to accept connections (max ~20s)
if command -v curl >/dev/null 2>&1; then
  for i in $(seq 1 20); do
    curl -sf -o /dev/null http://127.0.0.1:8080/ && break
    sleep 1
  done
fi

# App-mode browser window (Chrome/Chromium/Edge), fallback to default browser
for b in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge msedge; do
  if command -v "$b" &>/dev/null; then
    "$b" --app=http://127.0.0.1:8080 >/dev/null 2>&1 &
    exit 0
  fi
done
if command -v xdg-open &>/dev/null; then
  xdg-open http://127.0.0.1:8080 >/dev/null 2>&1 &
elif command -v sensible-browser &>/dev/null; then
  sensible-browser http://127.0.0.1:8080 >/dev/null 2>&1 &
fi
echo "Resonance running on http://127.0.0.1:8080"
LAUNCHER
chmod +x "$APPDIR/usr/bin/resonance"

# Convert SVG to PNG for icon
if command -v rsvg-convert &>/dev/null; then
  rsvg-convert -w 256 -h 256 ../frontend/public/favicon.svg -o "$APPDIR/usr/share/icons/hicolor/256x256/apps/resonance.png"
elif command -v convert &>/dev/null; then
  convert ../frontend/public/favicon.svg -resize 256x256 "$APPDIR/usr/share/icons/hicolor/256x256/apps/resonance.png"
else
  echo "Warning: No SVG converter found; skipping icon."
fi

# Copy icon to AppDir root
if [ -f "$APPDIR/usr/share/icons/hicolor/256x256/apps/resonance.png" ]; then
  cp "$APPDIR/usr/share/icons/hicolor/256x256/apps/resonance.png" "$APPDIR/resonance.png"
fi

# Create .desktop file
cat > "$APPDIR/usr/share/applications/resonance.desktop" <<'DESKTOP'
[Desktop Entry]
Name=Resonance
Comment=Self-hosted music archival system
Exec=resonance
Icon=resonance
Type=Application
Categories=Audio;Music;Player;
StartupNotify=false
Terminal=false
DESKTOP

cp "$APPDIR/usr/share/applications/resonance.desktop" "$APPDIR/resonance.desktop"

# Build AppImage
if [ ! -f linuxdeploy ]; then
  echo "Error: linuxdeploy missing (auto-download failed)."
  exit 1
fi
echo "[*] Building AppImage..."
OUTPUT="resonance-${APP_VERSION}-x86_64.AppImage" ./linuxdeploy --appdir "$APPDIR" --output appimage

echo ""
echo "AppImage created: resonance-${APP_VERSION}-x86_64.AppImage"
echo ""
echo "To run:"
echo "  chmod +x resonance-${APP_VERSION}-x86_64.AppImage"
echo "  ./resonance-${APP_VERSION}-x86_64.AppImage"

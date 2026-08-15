#!/bin/bash
set -e

# Resonance Linux .deb Builder (v0.8.0)
# Builds a per-user-friendly deb: backend in /opt/resonance, data in
# $XDG_DATA_HOME/resonance (~/.local/share/resonance), per-user autostart
# created on first run. Uninstalling the package keeps user data.
# Requires: dpkg-deb, fakeroot (or --root-owner-group support).
# Expects `release/` containing resonance-backend, static/, VERSION.

APP_NAME="Resonance"
APP_VERSION="$(cat ../VERSION)"
PKG="resonance"
ARCH="amd64"
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

echo "== Building Resonance Linux .deb ${APP_VERSION} =="

if [ ! -f "../release/resonance-backend" ]; then
  echo "Error: ../release/resonance-backend not found."
  exit 1
fi
if [ ! -d "../release/static" ]; then
  echo "Error: ../release/static not found (copy frontend/dist)."
  exit 1
fi

rm -rf "$STAGING"
mkdir -p "$STAGING/DEBIAN"
mkdir -p "$STAGING/opt/resonance/bin"
mkdir -p "$STAGING/usr/share/applications"
mkdir -p "$STAGING/usr/share/icons/hicolor/256x256/apps"

# control file
cat > "$STAGING/DEBIAN/control" <<EOF
Package: $PKG
Version: $APP_VERSION
Section: sound
Priority: optional
Architecture: $ARCH
Maintainer: Jesal Pande <pandejesal@gmail.com>
Depends: libc6, libssl3
Description: Self-hosted music archival system
 A premium, self-hosted music library server with a web UI.
 Backend: $PKG-backend, data in ~/.local/share/resonance (or \$XDG_DATA_HOME).
EOF

# payload
cp ../release/resonance-backend "$STAGING/opt/resonance/"
cp -r ../release/static "$STAGING/opt/resonance/static"
cp ../VERSION "$STAGING/opt/resonance/"

# launcher
cat > "$STAGING/opt/resonance/bin/resonance" <<'LAUNCHER'
#!/bin/bash
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/resonance"
mkdir -p "$DATA_DIR"
export DATABASE_URL="sqlite:$DATA_DIR/resonance.db"

# Per-user login autostart (created on first run from a stable path).
# $APPIMAGE (set by the AppImage runtime) is the stable AppImage file path;
# for the deb install $APP_DIR is already stable and used as the fallback.
AUTOSTART_DIR="$HOME/.config/autostart"
if [ "$1" != "--start" ] && [ ! -f "$AUTOSTART_DIR/resonance.desktop" ]; then
  mkdir -p "$AUTOSTART_DIR"
  cat > "$AUTOSTART_DIR/resonance.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Resonance
Comment=Self-hosted music archival system
Exec=${APPIMAGE:-$APP_DIR/bin/resonance} --start
X-GNOME-Autostart-enabled=true
EOF
fi

# Start the backend if it is not already running (pidfile guard; the loser
# of a race fails to bind port 8080 and exits cleanly)
PIDFILE="$DATA_DIR/resonance.pid"
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  :
else
  nohup "$APP_DIR/resonance-backend" >/dev/null 2>&1 &
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
chmod +x "$STAGING/opt/resonance/bin/resonance"

# .desktop entry
cat > "$STAGING/usr/share/applications/resonance.desktop" <<'DESKTOP'
[Desktop Entry]
Name=Resonance
Comment=Self-hosted music archival system
Exec=/opt/resonance/bin/resonance
Icon=resonance
Type=Application
Categories=Audio;Music;Player;
StartupNotify=false
Terminal=false
DESKTOP

# icon
if command -v rsvg-convert &>/dev/null; then
  rsvg-convert -w 256 -h 256 ../frontend/public/favicon.svg -o "$STAGING/usr/share/icons/hicolor/256x256/apps/resonance.png"
elif command -v convert &>/dev/null; then
  convert ../frontend/public/favicon.svg -resize 256x256 "$STAGING/usr/share/icons/hicolor/256x256/apps/resonance.png"
else
  echo "Warning: No SVG converter found; skipping icon."
fi

# postrm: remove the per-user autostart entries created by the app
cat > "$STAGING/DEBIAN/postrm" <<'POSTRM'
#!/bin/sh
set -e
for h in /home/* /root; do
  if [ -f "$h/.config/autostart/resonance.desktop" ]; then
    rm -f "$h/.config/autostart/resonance.desktop"
  fi
done
exit 0
POSTRM
chmod 755 "$STAGING/DEBIAN/postrm"

dpkg-deb --build --root-owner-group "$STAGING" "resonance_${APP_VERSION}_${ARCH}.deb"

echo ""
echo "deb created: resonance_${APP_VERSION}_${ARCH}.deb"
echo "Install: sudo apt install ./resonance_${APP_VERSION}_${ARCH}.deb"
echo "Run: resonance"
echo "Uninstall keeps your data (~/.local/share/resonance)."

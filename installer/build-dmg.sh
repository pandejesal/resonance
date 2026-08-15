#!/bin/bash
set -e

# Resonance macOS DMG Builder (v0.8.0)
# Requires: create-dmg (brew install create-dmg)
# Usage: ARCH=x86_64|arm64 ./build-dmg.sh  (defaults: uname -m)
# Expects `release/` containing resonance-backend, static/, VERSION.

APP_NAME="Resonance"
APP_VERSION="$(cat ../VERSION)"
ARCH="${ARCH:-$(uname -m)}"
APP_DIR="Resonance.app"
DMG_NAME="resonance-${APP_VERSION}-macos-${ARCH}.dmg"

echo "== Building Resonance macOS DMG ${APP_VERSION} (${ARCH}) =="

# Check for create-dmg
if ! command -v create-dmg &>/dev/null; then
  echo "Installing create-dmg..."
  brew install create-dmg
fi

# Check for release files
if [ ! -f "../release/resonance-backend" ]; then
  echo "Error: ../release/resonance-backend not found."
  exit 1
fi
if [ ! -d "../release/static" ]; then
  echo "Error: ../release/static not found (copy frontend/dist)."
  exit 1
fi

# Create app bundle structure
echo "[*] Creating app bundle..."
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Copy backend + static (backend resolves static next to the exe)
cp ../release/resonance-backend "$APP_DIR/Contents/MacOS/"
cp -r ../release/static "$APP_DIR/Contents/MacOS/static"
cp ../VERSION "$APP_DIR/Contents/Resources/"

# Create launcher script
cat > "$APP_DIR/Contents/MacOS/resonance" <<'LAUNCHER'
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$HOME/Library/Application Support/Resonance"
mkdir -p "$DATA_DIR"
export DATABASE_URL="sqlite:$DATA_DIR/resonance.db"

# Per-user login autostart (LaunchAgent) — only when installed into
# /Applications; a DMG-mount path ($DIR under /Volumes) must never be
# baked into the plist, it vanishes when the DMG is unmounted.
LA="$HOME/Library/LaunchAgents/com.resonance.server.plist"
if [ "$1" != "--start" ] && [ ! -f "$LA" ] && [ "${DIR#/Applications/}" != "$DIR" ]; then
  mkdir -p "$HOME/Library/LaunchAgents"
  # XML-escape the path (safe for & < >)
  DIR_XML="${DIR//&/&amp;}"
  DIR_XML="${DIR_XML//</&lt;}"
  DIR_XML="${DIR_XML//>/&gt;}"
  cat > "$LA" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.resonance.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>${DIR_XML}/resonance</string>
    <string>--start</string>
  </array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
PLIST
  launchctl load "$LA" 2>/dev/null || true
fi

# Start the backend if it is not already running (pidfile + port probe; the
# loser of a race fails to bind port 8080 and exits cleanly)
PIDFILE="$DATA_DIR/resonance.pid"
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null && curl -sf -o /dev/null http://127.0.0.1:8080/; then
  :
else
  nohup "$DIR/resonance-backend" >/dev/null 2>&1 &
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

# App-mode browser window (Chrome/Edge), fallback to default browser.
# Launch the binary directly so the app-mode flag is honored even when the
# browser is already running (open -a would just focus the existing window).
for b in "Google Chrome" "Microsoft Edge" "Chromium"; do
  if [ -x "/Applications/$b.app/Contents/MacOS/$b" ]; then
    "/Applications/$b.app/Contents/MacOS/$b" --app=http://127.0.0.1:8080 >/dev/null 2>&1 &
    exit 0
  fi
done
open http://127.0.0.1:8080 2>/dev/null || true
echo "Resonance running on http://127.0.0.1:8080"
LAUNCHER
chmod +x "$APP_DIR/Contents/MacOS/resonance"

# Create Info.plist
cat > "$APP_DIR/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>resonance</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundleDisplayName</key>
    <string>$APP_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>com.pandejesal.resonance</string>
    <key>CFBundleVersion</key>
    <string>$APP_VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$APP_VERSION</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>LSUIElement</key>
    <false/>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>CFBundleIconFile</key>
    <string>$APP_NAME</string>
</dict>
</plist>
PLIST

# Convert SVG to ICNS (requires sips and iconutil)
echo "[*] Creating app icon..."
ICONSET="$APP_NAME.iconset"
mkdir -p "$ICONSET"

if command -v rsvg-convert &>/dev/null; then
  for size in 16 32 64 128 256 512; do
    rsvg-convert -w $size -h $size ../frontend/public/favicon.svg -o "$ICONSET/icon_${size}x${size}.png"
    rsvg-convert -w $((size*2)) -h $((size*2)) ../frontend/public/favicon.svg -o "$ICONSET/icon_${size}x${size}@2x.png"
  done
  iconutil -c icns "$ICONSET" -o "$APP_DIR/Contents/Resources/$APP_NAME.icns"
  rm -rf "$ICONSET"
elif command -v qlmanage &>/dev/null; then
  # Fallback: qlmanage converts SVG -> PNG (sips cannot read SVG); sips then
  # scales the PNG into the standard 10-file iconset.
  qlmanage -t -s 512 -o "$ICONSET" ../frontend/public/favicon.svg >/dev/null 2>&1 || true
  if [ -f "$ICONSET/favicon.svg.png" ]; then
    mv "$ICONSET/favicon.svg.png" "$ICONSET/base.png"
    for size in 16 32 128 256 512; do
      sips -z $size $size "$ICONSET/base.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null 2>&1 || true
      sips -z $((size*2)) $((size*2)) "$ICONSET/base.png" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null 2>&1 || true
    done
    rm -f "$ICONSET/base.png"
    iconutil -c icns "$ICONSET" -o "$APP_DIR/Contents/Resources/$APP_NAME.icns" 2>/dev/null || true
  fi
  rm -rf "$ICONSET"
fi

# Create DMG
echo "[*] Creating DMG..."
rm -f "$DMG_NAME"

create-dmg \
  --volname "$APP_NAME" \
  --window-pos 200 120 \
  --window-size 600 400 \
  --icon-size 100 \
  --icon "$APP_NAME.app" 175 190 \
  --hide-extension "$APP_NAME.app" \
  --app-drop-link 425 190 \
  "$DMG_NAME" \
  "$APP_DIR"

echo ""
echo "DMG created: $DMG_NAME"
echo ""
echo "To install:"
echo "  1. Open $DMG_NAME"
echo "  2. Drag Resonance to Applications"
echo "  3. Open Resonance from Applications"

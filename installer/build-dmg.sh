#!/bin/bash
set -e

# Resonance macOS DMG Builder
# Requires: create-dmg (brew install create-dmg)

APP_NAME="Resonance"
APP_VERSION="0.1.0"
APP_DIR="Resonance.app"
DMG_NAME="resonance-${APP_VERSION}-macos.dmg"

echo "== Building Resonance macOS DMG =="

# Check for create-dmg
if ! command -v create-dmg &>/dev/null; then
  echo "Installing create-dmg..."
  brew install create-dmg
fi

# Check for release files
if [ ! -f "release/resonance-backend" ]; then
  echo "Error: release/resonance-backend not found."
  echo "Run the build first: cargo build --release -p resonance-backend"
  exit 1
fi

# Create app bundle structure
echo "[*] Creating app bundle..."
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Copy backend
cp release/resonance-backend "$APP_DIR/Contents/MacOS/"

# Copy static files
cp -r release/static "$APP_DIR/Contents/Resources/"

# Copy migrations
cp -r release/migrations "$APP_DIR/Contents/Resources/"

# Copy VERSION
cp release/VERSION "$APP_DIR/Contents/Resources/"

# Create launcher script
cat > "$APP_DIR/Contents/MacOS/resonance" <<'LAUNCHER'
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES="$DIR/../Resources"
cd "$RESOURCES"
mkdir -p data
export DATABASE_URL="sqlite:$RESOURCES/data/resonance.db"
pkill -f resonance-backend 2>/dev/null || true
nohup "$DIR/resonance-backend" > /dev/null 2>&1 &
sleep 2
open http://127.0.0.1:8080
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
    <string>com.resonance.app</string>
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
</dict>
</plist>
PLIST

# Convert SVG to ICNS (requires sips and iconutil)
echo "[*] Creating app icon..."
ICONSET="$APP_NAME.iconset"
mkdir -p "$ICONSET"

# Use the SVG to create icon sizes
if command -v rsvg-convert &>/dev/null; then
  for size in 16 32 64 128 256 512; do
    rsvg-convert -w $size -h $size frontend/public/favicon.svg -o "$ICONSET/icon_${size}x${size}.png"
    rsvg-convert -w $((size*2)) -h $((size*2)) frontend/public/favicon.svg -o "$ICONSET/icon_${size}x${size}@2x.png"
  done
  iconutil -c icns "$ICONSET" -o "$APP_DIR/Contents/Resources/$APP_NAME.icns"
  rm -rf "$ICONSET"
elif command -v sips &>/dev/null; then
  # Fallback to sips (macOS built-in)
  sips -s format png frontend/public/favicon.svg --out "$ICONSET/icon_512x512.png" 2>/dev/null || true
  iconutil -c icns "$ICONSET" -o "$APP_DIR/Contents/Resources/$APP_NAME.icns" 2>/dev/null || true
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

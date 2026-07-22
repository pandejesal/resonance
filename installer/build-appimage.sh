#!/bin/bash
set -e

# Resonance Linux AppImage Builder
# Creates a portable AppImage that runs on any Linux distro

APP_NAME="Resonance"
APP_VERSION="0.1.0"
APPDIR="AppDir"

echo "== Building Resonance Linux AppImage =="

# Check for linuxdeploy
if ! command -v linuxdeploy &>/dev/null; then
  echo "Downloading linuxdeploy..."
  curl -L -o linuxdeploy https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-x86_64.AppImage
  chmod +x linuxdeploy
fi

# Check for release files
if [ ! -f "release/resonance-backend" ]; then
  echo "Error: release/resonance-backend not found."
  echo "Run the build first: cargo build --release -p resonance-backend"
  exit 1
fi

# Create AppDir structure
echo "[*] Creating AppDir..."
rm -rf "$APPDIR"
mkdir -p "$APPDIR/usr/bin"
mkdir -p "$APPDIR/usr/share/applications"
mkdir -p "$APPDIR/usr/share/icons/hicolor/256x256/apps"

# Copy backend
cp release/resonance-backend "$APPDIR/usr/bin/"

# Copy static files
mkdir -p "$APPDIR/usr/share/resonance/static"
cp -r release/static/* "$APPDIR/usr/share/resonance/static/"

# Copy migrations
mkdir -p "$APPDIR/usr/share/resonance/migrations"
cp -r release/migrations/* "$APPDIR/usr/share/resonance/migrations/"

# Copy VERSION
cp release/VERSION "$APPDIR/usr/share/resonance/"

# Create launcher script
cat > "$APPDIR/usr/bin/resonance" <<'LAUNCHER'
#!/bin/bash
DIR="/usr/share/resonance"
cd "$DIR"
mkdir -p "$HOME/.local/share/resonance/data"
export DATABASE_URL="sqlite:$HOME/.local/share/resonance/data/resonance.db"
pkill -f resonance-backend 2>/dev/null || true
nohup "$DIR/resonance-backend" > /dev/null 2>&1 &
sleep 2
if command -v xdg-open &>/dev/null; then
  xdg-open http://127.0.0.1:8080
elif command -v sensible-browser &>/dev/null; then
  sensible-browser http://127.0.0.1:8080
fi
echo "Resonance running on http://127.0.0.1:8080"
LAUNCHER
chmod +x "$APPDIR/usr/bin/resonance"

# Convert SVG to PNG for icon
if command -v rsvg-convert &>/dev/null; then
  rsvg-convert -w 256 -h 256 frontend/public/favicon.svg -o "$APPDIR/usr/share/icons/hicolor/256x256/apps/resonance.png"
elif command -v convert &>/dev/null; then
  convert frontend/public/favicon.svg -resize 256x256 "$APPDIR/usr/share/icons/hicolor/256x256/apps/resonance.png"
else
  # Use Python + cairosvg or create a minimal PNG as placeholder
  echo "Warning: No SVG converter found. Using Python fallback."
  python3 -c "
import struct, zlib
# Create a minimal 256x256 blue PNG as placeholder
width, height = 256, 256
def create_png(w, h):
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    raw = b''
    for y in range(h):
        raw += b'\x00'  # filter byte
        for x in range(w):
            raw += b'\x3b\x82\xf6'  # blue pixel
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
with open('$APPDIR/usr/share/icons/hicolor/256x256/apps/resonance.png', 'wb') as f:
    f.write(create_png(256, 256))
" 2>/dev/null || echo "Could not create icon"
fi

# Copy icon to AppDir root (copy from the icon dir)
if [ -f "$APPDIR/usr/share/icons/hicolor/256x256/apps/resonance.png" ]; then
  cp "$APPDIR/usr/share/icons/hicolor/256x256/apps/resonance.png" "$APPDIR/resonance.png"
else
  # Last resort: create via Python directly to AppDir root
  python3 -c "
import struct, zlib
width, height = 256, 256
def create_png(w, h):
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    raw = b''
    for y in range(h):
        raw += b'\x00'
        for x in range(w):
            raw += b'\x3b\x82\xf6'
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
with open('$APPDIR/resonance.png', 'wb') as f:
    f.write(create_png(256, 256))
" 2>/dev/null || echo "Could not create icon"
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
echo "[*] Building AppImage..."
if [ -f linuxdeploy ]; then
  ./linuxdeploy --appdir "$APPDIR" --output appimage
else
  # Fallback: create manually
  chmod +x linuxdeploy 2>/dev/null || true
  echo "linuxdeploy not found. Creating manual AppImage..."
  
  # Download AppImage runtime
  curl -L -o runtime "https://github.com/AppImage/AppImageKit/releases/download/continuous/runtime-x86_64"
  chmod +x runtime
  
  # Create squashfs
  mksquashfs "$APPDIR" squashfs-root -comp gzip -noappend
  
  # Combine runtime + squashfs
  cat runtime squashfs-root > "resonance-${APP_VERSION}-x86_64.AppImage"
  chmod +x "resonance-${APP_VERSION}-x86_64.AppImage"
  
  rm -rf runtime squashfs-root
fi

echo ""
echo "AppImage created: resonance-${APP_VERSION}-x86_64.AppImage"
echo ""
echo "To run:"
echo "  chmod +x resonance-${APP_VERSION}-x86_64.AppImage"
echo "  ./resonance-${APP_VERSION}-x86_64.AppImage"

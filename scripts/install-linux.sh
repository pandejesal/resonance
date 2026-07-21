#!/bin/bash
set -e

APPDIR="$HOME/Apps/resonance"
ZIP="$HOME/Downloads/resonance-main.zip"

echo "== Resonance Linux Installer =="

# Check for required tools
check_tool() {
  if ! command -v "$1" &>/dev/null; then
    echo "Missing: $1"
    return 1
  fi
}

MISSING=0
for tool in git node cargo; do
  check_tool "$tool" || MISSING=1
done

if [ "$MISSING" -eq 1 ]; then
  echo ""
  echo "Please install:"
  echo "  Git:      sudo apt install git (or your distro's package manager)"
  echo "  Node.js:  https://nodejs.org/ or sudo apt install nodejs"
  echo "  Rust:     curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  echo ""
  echo "After installing, restart your terminal and run this script again."
  exit 1
fi

mkdir -p "$HOME/Apps" "$HOME/bin"

# Get source code
if [ -f "$ZIP" ]; then
  echo "[*] Extracting from ZIP..."
  rm -rf "$APPDIR" "$HOME/Apps/resonance-main"
  cd "$HOME/Apps"
  unzip -q "$ZIP"
  [ -d resonance-main ] && mv resonance-main resonance
else
  if [ ! -d "$APPDIR" ]; then
    echo "[*] Cloning repository..."
    git clone https://github.com/pandejesal/resonance.git "$APPDIR"
  else
    echo "[*] Updating repository..."
    cd "$APPDIR"
    git pull
  fi
fi

cd "$APPDIR"

mkdir -p data logs

echo "[*] Patching database path..."
sed -i 's|"/app/data/resonance.db"|format!("sqlite:{}/Apps/resonance/data/resonance.db", std::env::var("HOME").unwrap())|' backend/src/main.rs || true

echo "[*] Building frontend..."
cd frontend
npm install
npm run build
cd ..

rm -rf static
cp -r frontend/dist static

if [ ! -f static/index.html ]; then
  echo "Frontend build failed."
  exit 1
fi

echo "[*] Building backend..."
cargo build --release

if [ ! -f target/release/resonance-backend ]; then
  echo "Backend build failed."
  exit 1
fi

cat > "$HOME/bin/resonance" <<'EOF'
#!/bin/bash
APP="$HOME/Apps/resonance"
cd "$APP"
mkdir -p logs
export DATABASE_URL="sqlite:$APP/data/resonance.db"
pkill -f resonance-backend 2>/dev/null || true
nohup "$APP/target/release/resonance-backend" >logs/backend.log 2>&1 &
sleep 2
if command -v xdg-open &>/dev/null; then
  xdg-open http://127.0.0.1:8080
elif command -v sensible-browser &>/dev/null; then
  sensible-browser http://127.0.0.1:8080
fi
echo "Backend running on http://127.0.0.1:8080"
EOF
chmod +x "$HOME/bin/resonance"

cat > "$HOME/bin/resonance-doctor" <<'EOF'
#!/bin/bash
cd "$HOME/Apps/resonance"
echo "Checking installation..."
test -f target/release/resonance-backend && echo "Backend OK" || echo "Backend MISSING"
test -f static/index.html && echo "Frontend OK" || echo "Frontend MISSING"
test -d data && echo "Data dir OK" || echo "Data dir MISSING"
EOF
chmod +x "$HOME/bin/resonance-doctor"

cat > "$HOME/bin/resonance-update" <<'EOF'
#!/bin/bash
cd "$HOME/Apps/resonance"
git pull || true
cd frontend
npm install
npm run build
cd ..
rm -rf static
cp -r frontend/dist static
cargo build --release
echo "Updated."
EOF
chmod +x "$HOME/bin/resonance-update"

echo ""
echo "Installation complete!"
echo ""
echo "Run:"
echo "  resonance"
echo "  or"
echo "  ~/bin/resonance"
echo ""
echo "Doctor:"
echo "  resonance-doctor"
echo ""
echo "Update:"
echo "  resonance-update"

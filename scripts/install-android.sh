#!/data/data/com.termux/files/usr/bin/bash
set -e

APPDIR="$HOME/Apps/resonance"
ZIP="$HOME/storage/downloads/resonance-main.zip"

echo "== Resonance Android Installer v4 =="

pkg update -y
pkg install -y git unzip nodejs rust clang make pkg-config openssl ripgrep termux-api

mkdir -p "$HOME/Apps" "$HOME/bin" "$HOME/.shortcuts"

if [ -f "$ZIP" ]; then
  rm -rf "$APPDIR" "$HOME/Apps/resonance-main"
  cd "$HOME/Apps"
  unzip -q "$ZIP"
  [ -d resonance-main ] && mv resonance-main resonance
else
  if [ ! -d "$APPDIR" ]; then
    git clone https://github.com/pandejesal/resonance.git "$APPDIR"
  else
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
#!/data/data/com.termux/files/usr/bin/bash
APP="$HOME/Apps/resonance"
cd "$APP"
mkdir -p logs
export DATABASE_URL="sqlite:$APP/data/resonance.db"
pkill -f resonance-backend 2>/dev/null || true
nohup "$APP/target/release/resonance-backend" >logs/backend.log 2>&1 &
sleep 2
command -v termux-open-url >/dev/null && termux-open-url http://127.0.0.1:8080
echo "Backend running on http://127.0.0.1:8080"
EOF

chmod +x "$HOME/bin/resonance"

cat > "$HOME/bin/resonance-doctor" <<'EOF'
#!/data/data/com.termux/files/usr/bin/bash
cd "$HOME/Apps/resonance"
echo "Checking installation..."
test -f target/release/resonance-backend && echo "Backend OK"
test -f static/index.html && echo "Frontend OK"
test -d data && echo "Data dir OK"
EOF
chmod +x "$HOME/bin/resonance-doctor"

cat > "$HOME/bin/resonance-update" <<'EOF'
#!/data/data/com.termux/files/usr/bin/bash
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

echo '#!/data/data/com.termux/files/usr/bin/bash
$HOME/bin/resonance' > "$HOME/.shortcuts/Resonance"
chmod +x "$HOME/.shortcuts/Resonance"

echo
echo "Installation complete."
echo "Run:"
echo "  resonance"
echo "or"
echo "  ~/bin/resonance"
echo
echo "Doctor:"
echo "  resonance-doctor"
echo "Update:"
echo "  resonance-update"

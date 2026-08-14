#!/bin/bash
set -e

# Resonance macOS .pkg Builder (v0.8.0)
# Wraps the Resonance.app bundle into an installer .pkg (installer -pkg).
# Requires: pkgbuild, productbuild (built into macOS).
# Usage: ARCH=x86_64|arm64 ./build-pkg.sh  (defaults: uname -m)
# Run AFTER build-dmg.sh (reuses Resonance.app) or build the bundle directly.

APP_NAME="Resonance"
APP_VERSION="$(cat ../VERSION 2>/dev/null || echo "0.8.0")"
ARCH="${ARCH:-$(uname -m)}"
APP_DIR="Resonance.app"
PKG_NAME="resonance-${APP_VERSION}-macos-${ARCH}.pkg"

echo "== Building Resonance macOS .pkg ${APP_VERSION} (${ARCH}) =="

if [ ! -d "$APP_DIR" ]; then
  echo "Error: $APP_DIR not found. Run build-dmg.sh first."
  exit 1
fi

# 1) Component package: installs Resonance.app into /Applications
rm -rf pkg-staging
mkdir -p pkg-staging/Applications
cp -R "$APP_DIR" pkg-staging/Applications/

pkgbuild \
  --root pkg-staging \
  --identifier com.pandejesal.resonance \
  --version "$APP_VERSION" \
  --install-location / \
  resonance-component.pkg

# 2) Wrap into a distributable .pkg
productbuild \
  --package resonance-component.pkg \
  --version "$APP_VERSION" \
  "$PKG_NAME"

rm -rf pkg-staging resonance-component.pkg

echo ""
echo "pkg created: $PKG_NAME"
echo "Install: sudo installer -pkg $PKG_NAME -target /"
echo "Uninstall keeps your data (~/Library/Application Support/Resonance)."

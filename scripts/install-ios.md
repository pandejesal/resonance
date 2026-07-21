# Resonance iOS Setup (PWA)

Resonance on iOS works as a **Progressive Web App (PWA)** — a web app that installs to your home screen and feels like a native app.

## Prerequisites

You need Resonance running on a server that your iPhone can reach. Options:

1. **Same network** — Run Resonance on a computer and access via its local IP
2. **Tailscale/ZeroTier** — Access from anywhere via VPN mesh
3. **Cloud** — Deploy on a VPS and access via HTTPS

## Setup Steps

### 1. Start Resonance on your server/computer

```bash
# On your computer (macOS/Linux/Windows with WSL)
cd ~/Apps/resonance  # or wherever you installed it
./bin/resonance
```

Note your computer's IP address:

```bash
# macOS/Linux
ip addr show | grep "inet " | grep -v 127.0.0.1

# Windows (PowerShell)
Get-NetIPAddress -AddressFamily IPv4 | Where-Object InterfaceAlias -notlike "*Loopback*"
```

### 2. Open Safari on your iPhone

Navigate to: `http://YOUR-IP-ADDRESS:8080`

For example: `http://192.168.1.100:8080`

### 3. Add to Home Screen

1. Tap the **Share** button (square with arrow) in Safari's toolbar
2. Scroll down and tap **"Add to Home Screen"**
3. Name it "Resonance" and tap **Add**

### 4. Launch from Home Screen

Tap the Resonance icon on your home screen. It will open in full-screen mode without Safari's address bar.

## Features on iOS

- Full music playback with background audio
- Gapless playback and crossfade
- Lyrics display with sync
- Equalizer with presets
- Import playlists from Spotify, YouTube Music, etc.
- Scan and browse your library

## Tips

- **Keep screen on**: Settings > Display & Brightness > Auto-Lock > Never (while using)
- **Background playback**: Works in Safari PWA mode
- **Offline caching**: The app caches assets for faster loading
- **Better experience**: Use a VPS with HTTPS for remote access

## Troubleshooting

**Can't connect from iPhone?**
- Make sure both devices are on the same network
- Check that your computer's firewall allows port 8080
- Try disabling the firewall temporarily to test

**No sound?**
- Make sure your iPhone is not on silent mode
- Check the volume slider in the app

**App doesn't install?**
- Make sure you're using Safari (not Chrome)
- The server must be accessible (not blocked by firewall)

## Alternative: Termux on iOS (Advanced)

For users with jailbroken iPhones or using AltStore, you can run the Termux installer directly on iOS. However, this requires:
- Jailbroken device or AltStore
- Termux app installed
- Following the Android installer steps

# Resonance - Security & Quality Audit Fixes

## Project Overview
- Backend: Rust + Actix-web 4 + SQLite (WAL) + lofty-rs + Rayon + reqwest (rustls-tls) + argon2 + actix-ws + notify
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion + Zustand
- Android: Kotlin, minSdk 29, targetSdk 34, WebView wrapper with JS bridge
- Desktop: Tauri v2 wraps Actix-web backend + React frontend
- Repo: https://github.com/pandejesal/resonance

## Instructions
Fix ALL findings below. Each fix must be a separate, clean commit. Do NOT break existing functionality. Follow existing code conventions. After each fix, verify the code compiles (cargo check for Rust, npx tsc --noEmit for TypeScript).

---

## CRITICAL

### 1. Android Release APK is Debug-Signed
Files: .github/workflows/release.yml (line 270), android/app/build.gradle (line 36)
Problem: CI release workflow runs assembleDebug and uploads the debug APK as production. Debug keystore password is the default 'android'. Shipped app is debuggable with JNI debugging enabled.
Fix: Create release signing config using env vars. Build assembleRelease in CI. Store keystore as base64 GitHub secret. Never commit keystore to repo.

### 2. Guest Token Gives Full Access Including RCE via Docker Socket
Files: backend/src/handlers.rs (lines 2066, 3785), backend/src/updater.rs (lines 121-152)
Problem: POST /api/auth/guest issues 24h token with no credentials. Guest role not enforced on destructive endpoints. apply_update runs git pull + docker compose up --build. With docker.sock mount this is host RCE.
Fix: Add require_role(req, "admin") helper. Apply to all destructive endpoints. Make guest opt-in via RESONANCE_ALLOW_GUEST env var. Restrict guest to read-only.

### 3. Android JS Bridge Exposed to Arbitrary Pages
File: android/app/src/main/java/com/pandejesal/resonance/MainActivity.kt (line 126)
Problem: AndroidBridge registered for every page with no origin allowlist. Error page navigates WebView to arbitrary URLs. Attacker page gets scanDeviceMusic(), storage paths, setServerUrl.
Fix: Add origin allowlist in shouldOverrideUrlLoading (only http://127.0.0.1:*). Verify URL in onPageStarted. Remove error page navigation away from localhost.

### 4. Hardcoded Default Admin Password
File: backend/src/db.rs (lines 70-81)
Problem: First-run creates admin user with password 'admin' and no forced password change.
Fix: Generate random 12-char password on first run, print to log once, set must_change_password flag. Require password change on first admin login.

---

## HIGH

### 5. No Role Enforcement on Destructive Endpoints
File: backend/src/handlers.rs
Problem: require_auth only validates token, not roles. Any authenticated user (including guests) can access admin operations.
Fix: Create require_role helper chaining after require_auth. Apply to all write/delete/admin endpoints.

### 6. Open Registration Without Restrictions
File: backend/src/handlers.rs (line 3711)
Problem: POST /api/auth/register is unauthenticated and open to anyone on Docker deployments bound to 0.0.0.0.
Fix: Add RESONANCE_ALLOW_REGISTRATION env var (default: false). Return 403 when disabled.

### 7. No Security Headers on Backend
File: backend/src/lib.rs (line 189)
Problem: No CSP, X-Content-Type-Options, X-Frame-Options, or Referrer-Policy headers.
Fix: Add actix-web middleware setting CSP, nosniff, DENY, strict-origin-when-cross-origin.

### 8. Tauri CSP Neutralized
File: src-tauri/tauri.conf.json (line 26)
Problem: CSP allows unsafe-inline and unsafe-eval. Any XSS can execute arbitrary code in Tauri webview.
Fix: Remove unsafe-inline and unsafe-eval. Configure Vite for hashed scripts.

### 9. Android allowBackup Exposes Auth Tokens
File: android/app/src/main/AndroidManifest.xml (line 26)
Problem: allowBackup=true permits adb/cloud backup of auth cookies, tokens, and SQLite database.
Fix: Set allowBackup=false or create dataExtractionRules excluding auth and database.

### 10. SSRF via Artwork URL
File: android/app/src/main/java/com/pandejesal/resonance/MediaSessionService.kt (line 98)
Problem: loadArtworkAsync fetches absolute URLs from JS bridge. Compromised page can SSRF arbitrary URLs.
Fix: Only allow relative paths or validate against localhost allowlist.

### 11. Docker Binds 0.0.0.0 with Guest Mode
Files: docker/Dockerfile (line 36), docker/docker-compose.yml
Problem: HOST=0.0.0.0 with open registration and guest tokens. Anyone on LAN can access.
Fix: Bind to 127.0.0.1 by default. Disable guest/registration in default config.

### 12. Docker Socket Mount Enables Host RCE
File: docker/docker-compose.yml (line 29)
Problem: docker.sock mount is root-equivalent. Combined with updater reachable by any user, enables full host RCE.
Fix: Remove socket-mount updater pattern. Gate behind admin-only with explicit opt-in.

### 13. HMAC Secret Regenerated on Restart
File: backend/src/auth.rs (lines 10-23)
Problem: Random secret generated per-process when HMAC_SECRET unset. Tokens invalidate on restart.
Fix: Persist generated secret to data directory. Read on subsequent starts.

### 14. Auth Cookie Missing Secure Flag
File: backend/src/handlers.rs (line 3542)
Problem: Auth cookie set with secure(false). Token travels in cleartext over non-HTTPS.
Fix: Set secure(true) and same_site(Strict).

---

## MEDIUM

### 15. Token in URL Query Param Leaks to Logs
File: backend/src/handlers.rs (line 3465)
Problem: require_auth accepts tokens via ?token= URL param. Appears in logs, history, referrers.
Fix: Accept only Authorization header or HttpOnly cookie. Use short-lived signed URLs for stream endpoint.

### 16. Android Backend Process Not Properly Killed
File: android/app/src/main/java/com/pandejesal/resonance/MainActivity.kt (line 315)
Problem: onDestroy sets flag but native actix server keeps running, holding port 8080.
Fix: Expose JNI native function to shut down actix server. Guard startBackend against stale server.

### 17. Battery Optimization Requested Aggressively
File: android/app/src/main/java/com/pandejesal/resonance/MainActivity.kt (line 221)
Problem: requestIgnoreBatteryOptimizations fires at startup unconditionally. Play policy violation.
Fix: Request only after user starts playback with rationale dialog.

### 18. No Certificate Pinning
File: android/app/src/main/res/xml/network_security_config.xml
Problem: No trust-anchors override. MITM can inject metadata/artwork/scripts for remote servers.
Fix: Add certificate pinning or refuse plain-HTTP for remote servers.

### 19. Tauri No Per-Instance API Token
File: src-tauri/src/main.rs (line 45)
Problem: Backend on 127.0.0.1:8080 with no per-instance token. Any local process can hit API.
Fix: Generate random per-launch token, pass as env var, require from frontend.

### 20. Tauri Shell Permissions Unrestricted
File: src-tauri/capabilities/default.json (line 8)
Problem: shell:allow-open with no URL scope. Compromised frontend can open file://, smb://.
Fix: Restrict shell open scope to https:// and mailto: only.

### 21. Subsonic Auth Uses Weak MD5
File: backend/src/subsonic.rs (line 40)
Problem: md5(password_hash + salt) is cryptographically broken.
Fix: Document as known limitation (Subsonic API spec requirement). Add deprecation comment.

---

## LOW

### 22. Lock Screen Visibility Public
File: android/app/src/main/java/com/pandejesal/resonance/MediaSessionService.kt (line 184)
Problem: Notification and lockscreen visibility is PUBLIC, exposing track info.
Fix: Use VISIBILITY_PRIVATE or make configurable.

### 23. ProGuard Keeps Everything
File: android/app/proguard-rules.pro (line 4)
Problem: -keep class ** keeps all app classes, disabling obfuscation.
Fix: Keep only JNI and JavascriptInterface classes. Let R8 obfuscate the rest.

### 24. CI Lacks Quality Checks
File: .github/workflows/ci.yml (line 37)
Problem: CI only runs cargo check and frontend build. No clippy, fmt, tests, audit, or secret scanning.
Fix: Add clippy -D warnings, cargo fmt --check, cargo test, cargo audit, secretscan.

### 25. Unpinned GitHub Actions
File: .github/workflows/release.yml (line 31)
Problem: Unpinned third-party actions and floating versions reduce build reproducibility.
Fix: Pin actions to commit SHAs. Use npm ci with lockfile.

### 26. Floating Docker Base Images
File: docker/Dockerfile (line 1)
Problem: Floating tags (rust:1-slim-bookworm, node:20-slim) make builds non-reproducible.
Fix: Pin to digest. Add renovate flow for updates.

---

## FRONTEND FIXES

### 27. Token Leaked in Stream URL
File: frontend/src/stores/index.ts (line 12)
Problem: getStreamUrl appends ?token= to URL. Token exposed in browser history, logs, referrers.
Fix: For audio element, use short-lived signed URL or set withCredentials and send via cookie only.

### 28. Waveform Fetch Missing Auth
Files: frontend/src/components/WaveformSeekBar.tsx (lines 25-26), WaveformDisplay.tsx (lines 31-38)
Problem: Raw fetch to /api/tracks/{id}/waveform with no auth header. 401s silently swallowed.
Fix: Use the api client (which injects auth) instead of raw fetch.

### 29. Search Results Race Condition
File: frontend/src/components/SearchModal.tsx (lines 37-48)
Problem: In-flight search response can overwrite newer query results.
Fix: Use AbortController to cancel previous requests. Check sequence number before setting results.

### 30. Queue Save Lacks Per-Item Error Handling
File: frontend/src/components/QueuePanel.tsx (lines 35-36)
Problem: saveAsPlaylist does serial await per item. One failure aborts the rest.
Fix: Use Promise.allSettled and report per-item success/failure.

### 31. 401 Does Not Redirect to Login
File: frontend/src/lib/api.ts (lines 44-52)
Problem: 401 clears token and resets store but does not redirect to login. User stuck on dead page.
Fix: After clearing auth state, redirect to /login using window.location or router navigate.

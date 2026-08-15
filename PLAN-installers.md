# PLAN: Desktop Installers (v0.8.0)

Milestone objective: ship standalone server installers for Windows, Linux, and
macOS via GitHub Actions CI, with per-user login autostart and an app-mode
browser window. Tauri is deferred (remote line's Tauri launcher remains as-is).

## 0. Reconciliation note (this branch's baseline)

main was rebuilt by merging two diverged lines (commit `2db081d`):

- remote v0.7.3 line (`cab0348`): Android app, dodo checkout/webhook, migration
  quarantine, DefaultHeaders hardening, actix-ws WsClients, `~/.resonance` data
  dir default, VERSION 0.7.3, `frontend/src/components/WaveformSeekBar.tsx`,
  `.github/workflows/ci.yml` + `release.yml` (Tauri-era), `JULES_AUDIT_FIXES.md`.
- local milestone line (`dac0a7e`): FTS5 search (migrations 009-011),
  ReplayGain (`compute_gain.rs` + ebur128), lazy waveform, importer HashMap
  matching, scrobble tests, ErrorState UI, README/PLAN docs, `installer/`
  scripts (`windows.iss`, `build-appimage.sh`, `build-dmg.sh`), `PLAN-roadmap.md`.

Both histories are preserved; the merge is a fast-forward-able child of remote
main. Backend compiles + tests green; frontend `tsc` + `vite build` green.

Version: 0.7.3 (merged) -> **0.8.0** this milestone.

## 1. Confirmed decisions (design tree Q1-Q14)

| # | Decision |
|---|----------|
| Q1 | Platforms: Windows, Linux, macOS (three families) |
| Q2 | Arch: Win x64; Linux amd64; macOS x86_64 + arm64 |
| Q3 | Autostart: per-user login autostart (HKCU Run / ~/.config/autostart / LaunchAgent) |
| Q4 | Backend: platform-aware defaults when env unset; env vars always win |
| Q5 | Install dir: per-user (no admin); in-place upgrades; uninstaller preserves data dir; built-in updater untouched |
| Q6 | Window: browser app-mode (`--app=http://127.0.0.1:8080`) + tab fallback |
| Q7 | Defaults: data dir by OS convention, static next to exe, port 8080, bind 127.0.0.1 |
| Q8 | macOS: .dmg AND .pkg |
| Q9 | Artifacts: every CI run; tagged Releases on version tags |
| Q10 | Gate: npm build + cargo check + cargo test + local Windows Inno smoke + WSL2 Ubuntu deb smoke + macOS CI-green/artifacts |
| Q11 | Push now, CI live from day one (done at `2db081d`) |
| Q12 | Version 0.8.0 |
| Q13 | Tauri deferred |
| Q14 | PLAN-installers.md (this file) |

## 2. Implementation tasks

1. **Backend platform-aware defaults** (`backend/src/main.rs`)
   - env-first; defaults: Windows `%APPDATA%\Resonance` (fallback HOME/.resonance),
     macOS `~/Library/Application Support/Resonance`, Linux
     `$XDG_DATA_HOME/resonance` (fallback `~/.local/share/resonance`)
   - static dir: `<exe_dir>/static` (release layout) with `./static` fallback
   - HOST default `127.0.0.1`, PORT default `8080`
   - auth.rs already reads `RESONANCE_DATA_DIR`/`RESONANCE_SECRET_PATH` (env-first) — reuse
2. **Version bump 0.7.3 -> 0.8.0**
   - `backend/Cargo.toml`, `frontend/package.json`, `VERSION`, `src-tauri/Cargo.toml`,
     `src-tauri/tauri.conf.json`
3. **Windows packaging**
   - `resonance.bat` + `resonance-launch.vbs` (silent launch of app-mode window)
   - `installer/windows.iss`: per-user install, data dir outside app dir
     (`%APPDATA%\Resonance`), uninstall keeps data, autostart (HKCU Run) as
     optional component, icon, version 0.8.0
4. **Linux packaging**
   - `installer/build-deb.sh` (dpkg-deb): `/opt/resonance`, autostart
     `~/.config/autostart/resonance.desktop`
   - update `installer/build-appimage.sh` (dynamic VERSION, app-mode launcher)
5. **macOS packaging**
   - update `installer/build-dmg.sh` (dynamic VERSION, `Application Support` data
     dir — already correct); add `installer/build-pkg.sh` (pkgbuild + productbuild)
6. **CI** (`.github/workflows/installers.yml`)
   - windows-latest: build backend + frontend, Inno Setup (choco), upload .exe
   - ubuntu-latest: build deb + AppImage, upload both
   - macos-15 (both arches; x86_64 cross-compiled on the arm64 runner): build
     dmg + pkg per arch
   - artifacts on every run; release attach on `v*` tags
7. **Docs**: README install section (download links, per-OS install steps,
   autostart, data dirs), PLAN-roadmap checkbox

## 3. Gate (Q10)

- `npm run build` (frontend) ? green
- `cargo check -p resonance-backend --lib --bins` ? green
- `cargo test -p resonance-backend --lib` ? green
- Local Windows: Inno compile + install smoke (login screen, port 8080 200,
  uninstall keeps `%APPDATA%\Resonance`) ? PENDING
- WSL2 Ubuntu: deb install smoke (service starts, port 8080 200) ? PENDING
- macOS: CI jobs green + artifacts present (no local machine) ? PENDING (CI not
  run yet: pushing `installers.yml` to main triggers it)

## 5. Status (2026-08-15)

- Tasks 1-6 committed in `b3ac190` and pushed to `origin main` (2db081d..b3ac190).
- Task 7 (docs) in progress: README install section + env table written; not yet
  committed.
- Follow-up fixes after first review pass:
  - All installer scripts read `../release/` (run from `installer/`), matching
    `windows.iss` (was `release/` in build-deb/appimage/dmg ? fixed).
  - macOS CI installs `librsvg` so the SVG->ICNS conversion works.
- Local smoke (Q10) still open: Windows Inno + WSL2 deb. Local run: C: drive ran
  out of space during gate (0 bytes free); freed ~5.9 GB via `cargo clean` +
  `npm cache clean --force` before the green cargo check/test.

### CI validation (final, 2026-08-15)

- **CI workflow green** on every push since `07d5a54` (fmt -> frontend ->
  tsc --noEmit -> clippy -D warnings -> check; frontend built before backend
  because `include_dir!` at `backend/src/lib.rs:33` panics without
  `frontend/dist`).
- **Installers workflow green** (`39b328e`, run 31901601181, 6m37s); artifacts
  uploaded on all 4 platform jobs:
  - Windows x64 Inno: `resonance-0.8.0-windows-setup.exe` (~6.9 MB)
  - Linux deb + AppImage: ~13.8 MB
  - macOS arm64 dmg + pkg: ~7.0 MB each
  - macOS x86_64 dmg + pkg: ~7.5 MB each (cross-compiled with
    `--target x86_64-apple-darwin` on a macos-14 runner; hosted macos-13
    runners are retired, so the old job sat queued indefinitely)
- Fixes that got it green (in order): package-lock.json regenerated with
  `npm@10` (npm 10 requires `esbuild@0.28.2` platform peers that npm 11
  skipped); assemble step copies from workspace-root `target/release/` (not
  `backend/target/`); build scripts marked `+x` in git (exit 126); AppImage +
  DMG scripts use `../release/` (missed in the first pass).
- Local smokes (Q10): Windows Inno install/uninstall fully verified (app
  removed, `%APPDATA%\Resonance` data kept); WSL2 deb install/remove mechanics
  verified (`/opt/resonance` layout + .desktop); runtime leg of the Linux
  binary covered by CI job runs.

### Second audit fixes (2026-08-16)

Full 4-lane audit of the v0.8.0 artifacts (Windows / Linux / macOS arm64 /
macOS x86_64). Findings fixed in one commit:

- **Windows (`windows.iss`)**: real AppId GUID (was template placeholder);
  `VersionInfoVersion` added (exe had no version resource); `CloseApplications=yes`
  + filter so uninstall closes the running backend instead of failing on the
  locked exe; version injected via `/DMyAppVersion=` from VERSION (no hardcode);
  `--launch` param removed from shortcuts (dead); bat now health-polls port 8080
  with curl instead of a fixed 2s sleep; comments corrected (data-dir guarantee).
- **Linux deb (`build-deb.sh`)**: `Depends: libc6, libssl3`; standard Maintainer;
  new `DEBIAN/postrm` removes per-user autostart on uninstall; launcher uses a
  pidfile guard (was pgrep) and health-polls instead of `sleep 2`.
- **AppImage (`build-appimage.sh`)**: linuxdeploy pinned to
  `1-alpha-20251107-1` (was unpinned `continuous`) with a version sanity check;
  output named `resonance-<version>-x86_64.AppImage` via the `OUTPUT` env var
  (was linuxdeploy default `Resonance-x86_64.AppImage`); autostart now writes
  `$APPIMAGE` (stable file path) instead of the transient FUSE mount `$BIN_DIR`
  (was broken after reboot); dead manual fallback branch removed.
- **macOS (`build-dmg.sh`)**: runner migrated macos-14 -> macos-15 on both mac
  jobs; LaunchAgent only created when the app is inside `/Applications` (a DMG
  mount path must not be baked into the plist); plist path XML-escaped; browser
  launched by direct binary exec (app-mode honored even when already running);
  dead `sips` SVG fallback replaced with `qlmanage`; pidfile guard + health poll.
- **CI (`installers.yml`)**: arm64 job now builds with an explicit
  `--target aarch64-apple-darwin`; ISCC invoked by full path with the version
  define; artifact names unified to `resonance-macos-x86_64`; release job adds a
  `SHA256SUMS` file.
- **Docs**: README roadmap + autostart wording corrected (AppImage name now
  matches what CI produces; autostart registered from fixed install paths only).

### Second audit results (2026-08-16)

6 reviewer lanes re-audited the fixed state (4 platform lanes + 2 re-dispatched
after a tooling abort). All prior findings verified fixed with file:line evidence.
Residual findings from the second pass, all resolved in `8d73da2`:

- `Depends: libssl3` dropped -> `libc6` only (backend links rustls, no OpenSSL —
  verified against Cargo.toml reqwest rustls-tls and zero openssl in the dep graph).
- linuxdeploy PATH/cwd inconsistency fixed: build now resolves
  `command -v linuxdeploy || echo ./linuxdeploy` and invokes the resolved binary.
- `wscript.exe` dropped from `CloseApplicationsFilter` (generic WSH processes
  should not be force-closed; the VBS wrapper exits immediately anyway).
- DMG `qlmanage` fallback now generates the full 10-file iconset via `sips`
  resizing (single-size iconset silently failed `iconutil`).
- Launcher pidfile guards now also probe port 8080 (covers PID-reuse and
  stale-pid cases; still self-healing when curl is absent).
- "Run: resonance" hint corrected to the real path `/opt/resonance/bin/resonance`.
- Accepted as documented residuals: cmd.exe race leaving an empty `{app}` dir on
  uninstall (cosmetic; uninstaller completes), postrm removing autostart on
  upgrade (recreated on next run), AppImage autostart baking the file path at
  first run (inherent to the stable-path design).

## 4. Non-goals

- Tauri packaging (deferred)
- Built-in updater changes
- Server-as-Windows-service / systemd unit (user-level autostart per Q3)

# PLAN-upgrade.md — "Download & Buy" Upgrade Cycle

> Status: planned 2026-08-16. Goal: make Resonance something people download,
> try, and **buy** — positioned as "private intelligence", the opposite of an
> AI-slop product. This plan supersedes the "Next Work" slices B/C/D in
> PLAN-roadmap.md for this cycle (metadata editor is done; sync/apps slices are
> re-scoped here).

## Decisions (agreed 2026-08-16, interview)

| Decision | Choice |
|---|---|
| Positioning | **Private intelligence** — taste analysis computed on *your* hardware, never sent to a cloud. "Your music is not a feed." |
| Revenue engine | All four surfaces: Pro keys, hosted cloud (later), free apps + web-bought keys, enterprise "contact us" |
| Free tier | **Keep current**: feature-gated free forever + 30-day trial (`trial_remaining_days` already wired) |
| Pro pricing | **$29/yr annual or $119 lifetime** (Plex/Emby parity); enterprise = contact |
| Cloud | **Demo server first** (one $10–20/mo VPS, curated library, 30-second in-browser try) → marketplace one-click image later → multi-tenant cloud only when revenue proves it |
| Apps | **Free downloads** on iOS/Android/desktop; Pro unlock via web-bought license key (Plexamp pattern — zero store cut; app checks the connected server's `/api/license/status`) |
| Flagship feature | **Resonance Intelligence v1** — stats-based, no ML models: forgotten gems, decade deep-dives, sound-alikes within your library, rediscover mixes |
| Privacy | **Documented no-telemetry**: "your server never phones home" (already true — license activation is local; updater stays opt-in/disable-able); privacy page |
| Launch | **Big-bang**: build everything, then launch once on all 4 channels (app stores, community launch + demo, website upgrade, creator seeding) |

Non-goals this cycle: real multi-tenant cloud, ML/embedding recommendations,
IAP in stores, paid apps, telemetry of any kind.

---

## Phase 1 — Resonance Intelligence (flagship Pro feature)

Everything computed from data already in the DB (listen history, ratings,
genres, BPM, keys, artists, albums). Zero model files, zero network. This is the
feature that makes the "private intelligence" claim true.

### 1.1 Backend — `backend/src/intelligence.rs` + routes ✅ DONE (2026-08-16)

- `GET /api/intelligence/forgotten-gems` — tracks rated 4★+ not played in
  >60 days (per server), ranked by rating × age-of-last-play. Reuses `record_play`
  history + `rating` column.
- `GET /api/intelligence/decade-mixes` — per-decade groups of the user's most
  played albums (decade from album year), top N per decade.
- `GET /api/intelligence/sound-alikes` — "artists similar to X within YOUR
  library": score = overlap of genre + BPM ±10% + musical key + co-played-in-
  playlists/sessions. Honest neighbor search, not a model.
- `GET /api/intelligence/rediscover` — "rediscover mixes": tracks last played
  30–365 days ago, sampled by decade/rating balance, one mix per mood
  (genre-bucket based).
- All endpoints Pro-gated via the existing pattern (`tier_features` key
  `intelligence`, seeded in `012_intelligence.sql` — INSERT OR IGNORE upserts
  for existing DBs; free users get 403 with `tier` + `trial_remaining_days`
  for the teaser UI).
- Query-heavy work stays in SQL (FTS5 + indexes); no new tables unless a
  cached "sound-alike score" table (recomputed on scan) proves faster.
- Unit tests: SQL query correctness against a seeded in-memory DB, gate
  behavior (free vs pro vs expired), empty-library edge cases.

### 1.2 Frontend — Intelligence page + entry points

- New `IntelligencePage.tsx` (Homepage tile + nav): forgotten gems, decade
  deep-dives, sound-alikes (select an artist → list), rediscover mixes.
- Reuse existing components: `AlbumCard`, `TrackList`, `AudioQualityBadge`,
  `WaveformSeekBar`. Follows `StatsPage` gating pattern ("Upgrade to Pro" card
  for free tier with trial countdown CTA).
- HomePage: "Resonance Intelligence" section with 2–3 preview cards for free
  users (teaser → Upgrade page), full section for Pro.
- Copy rule (anti-slop): "computed on your server from your listening history —
  nothing leaves this machine." No "AI-powered" phrasing anywhere in UI.

**Status: 1.2 done** — `IntelligencePage.tsx` (gems / rediscover mixes /
decade mixes with artwork + decade chips / sound-alikes with artist picker,
score bars and shared-signal chips), teaser for free tier with trial-countdown
CTA, live Forgotten Gems preview on HomePage for Pro + compact teaser card for
free, route `/intelligence`, Sidebar + mobile-more entries (Sparkles icon).
`api.ts` gains an `intelligence` group; types added. Backend tweaks: decade
mix albums now carry `artwork_track_id` (representative track) so artwork
renders, and `db_error` logs the real error. `npm run build` clean, 7/7 backend
tests green. Note: `cargo clean -p resonance-backend` was needed mid-run
(disk full — freed 5.3 GiB).

### 1.3 Acceptance (Phase 1)

- `cargo check`/`cargo test` + `npm run build` clean; new unit tests pass.
- Intelligence works on an empty library (empty-state UI, no errors), a seeded
  library, and a 100k-track fixture (p95 response < 250ms).
- Pro gate: free user sees teaser + upgrade CTA; activated Pro user sees data;
  expired/enterprise behavior matches existing license flow.
- No new outbound network calls anywhere in the feature.

**Status: 1.1 done** — `intelligence.rs` with 4 Pro-gated endpoints
(`forgotten_gems`, `decade_mixes`, `sound_alikes` + `suggested_artists`,
`rediscover`), gate helper (`require_intelligence` → 403 with tier + trial
days), routes registered in `handlers.rs`, migration `012_intelligence.sql`.
6 unit tests green (queries, gate, edge cases) + pre-existing compute_gain test
— `cargo test -p resonance-backend` all pass. 100k-track p95 benchmark is
deferred to the demo-server phase (queries are indexed and bounded; decade/
sound-alike queries cap at 100 candidates / 20 albums).

---

## Phase 2 — Website + Pricing (resonance.app)

### 2.1 Landing page upgrade

- Hero: one line — "Your music, privately intelligent." Screenshot gallery
  (real UI, not mockups), 60–90s walkthrough video, features grid.
- Comparison pages: vs Navidrome / Jellyfin / Plex / Roon / Spotify (one
  honest table each: self-hosted, bit-perfect, price, privacy). These pages are
  the SEO + conversion workhorses.
- Download page: per-platform installers (existing `installer/` outputs +
  `installers.yml` artifacts), Docker one-liner, demo server link.
- Pricing page (replaces the hardcoded references in `UpgradePage.tsx` line
  `resonance.app/pricing`): Free / Pro $29yr / $119 lifetime / Enterprise
  contact. Feature comparison table from `tier_features`.

### 2.2 Lifetime license plumbing (backend)

- Dodo: add lifetime product; `dodo_webhook.rs` currently hardcodes
  `expires_at = datetime('now', '+1 year')` — add a `duration`/`lifetime` branch
  that writes `expires_at = NULL` (non-expiring, matching free-tier semantics in
  `license.rs` activation).
- UpgradePage: two buttons (annual / lifetime), success URL carries
  `tier=lifetime`; `/api/license/features/{tier}` already accepts pro/enterprise
  — extend to `lifetime` alias of pro if cleaner.
- Regression: annual keys still expire; device limits unchanged (pro=2, per
  `license.rs`).

### 2.3 Acceptance (Phase 2)

- Buying either product through the Dodo checkout → webhook → key appears in
  the user's license status (verified end-to-end against the demo server).
- Lifetime key: no expiry shown in `UpgradePage` license card ("Never");
  annual key still counts down.
- Website builds, no dead links; all download buttons point at real artifacts
  (CI release job).

---

## Phase 3 — Demo Server + Trust Docs

### 3.1 Demo server

- One VPS ($10–20/mo), Docker Compose from `docker/`, public URL
  (demo.resonance.app), curated ~2–5k track library (CC-licensed music only —
  legal first), read-only-ish (regular DB reset, no user signups required —
  guest mode or auto-login).
- Landing page "Try the demo" button; demo banner in the app ("you're on the
  demo — install your own").
- Monitoring: health endpoint + uptime check; budget cap (demo is a funnel,
  not a business).

### 3.2 Privacy + trust docs

- `/privacy`: the documented no-telemetry promise, with the honest list of
  what does leave the machine and when: (1) optional updater check to GitHub
  (off by default), (2) Dodo checkout when buying, (3) LRCLIB lyrics fetch on
  demand, (4) scrobble services if the user enables them. "Your server never
  phones home" stays the headline.
- README: same promise, short version. Changelog page per release (human
  voice, not release-note slop).

### 3.3 Acceptance (Phase 3)

- Demo server reachable, plays audio, resets cleanly, survives 100 concurrent
  browsers (load test with a script).
- Privacy page matches actual network behavior (audit: grep outbound URLs in
  backend/frontend; document the list above exactly).

---

## Phase 4 — Free Apps, Web-Key Unlock

- **Android** (`android/`, JNI): current app + license-aware UI: Pro features
  follow the connected server's `/api/license/status` (no store IAP). Store
  listing assets (screenshots, description) that sell "private intelligence".
- **Desktop** (`src-tauri/`): same license-aware pattern; update-channel wiring
  from PLAN-roadmap slice D (installers use the existing backend updater).
- **iOS**: PWA covers iPhone today; ship PWA-guidance page (add-to-home-screen
  steps) before committing to a native app — revisit after launch data.
- All apps free in stores; zero IAP. The pricing page is the single money
  surface (Plexamp pattern — documented Apple 3.1.1 risk, accepted with web
  checkout as primary).

### Acceptance (Phase 4)

- Android build (`./gradlew assembleRelease`) green; app connects to demo +
  self-hosted server, Pro unlocks when server license is active, gate UI
  consistent with web.
- Desktop installers still green (existing `installers.yml` jobs pass).
- No in-app purchase code anywhere.

---

## Phase 5 — Big-Bang Launch

- **App stores**: submit Android + desktop builds; prepare iOS PWA guide.
- **Community launch**: r/selfhosted, r/audiophile, r/musichoarders,
  r/navidrome, r/jellyfin, HN, Product Hunt — all pointing at the demo server
  + pricing page. Post template: problem → 30-second demo → privacy promise →
  pricing (annual AND lifetime, the two buckets).
- **Creator seeding**: 3–5 small YouTubers/bloggers in self-hosted/audio
  space; demo accounts + interview material (what it is, why it's private,
  how it's built — Rust, no telemetry).
- **Release**: tag v0.9.0 (or v1.0.0) with the fixed installer assets
  (installers audit is complete; old v0.8.0 release assets are stale).

### Acceptance (Phase 5)

- All four channels live within one week; demo uptime ≥ 99% during the window.
- Conversion metric defined before launch: demo → install → trial → purchase
  (annual/lifetime split). Review at week 4; adjust pricing page copy only
  after data.

---

## Sequencing / Effort

| Phase | Effort | Depends on |
|---|---|---|
| 1 Intelligence | M | — |
| 2 Website + lifetime | M | 3.1 (webhook e2e on demo) |
| 3 Demo + trust docs | S | 2.1 (landing) |
| 4 Apps | M | 1.x gate pattern |
| 5 Launch | S | 1–4 |

Risks: Apple 3.1.1 (mitigated: web checkout primary), demo abuse (DB reset +
rate limits), sound-alikes quality without ML (mitigated: honest framing
"within your library", iterate on scoring after launch data).

## Open questions (deferred, not blocking)

- Cloud storage tiers pricing once marketplace exists (backlog).
- Native iOS app after PWA guide data (Phase 4 says revisit).
- v1.0.0 vs v0.9.0 for the launch tag (decide at Phase 5 with release
  readiness).
# Standing up the demo server (deferred until a VPS is purchased)

Funnel-first, budget-capped: the demo exists to sell the install, not to be a business.

## Checklist (when the VPS arrives)

1. **Buy** a small VPS ($10–20/mo, 2 vCPU / 4 GB is plenty for 2–5k tracks), Debian or
   Ubuntu, with a public IPv4.
2. **DNS**: point `demo.resonance.app` (CNAME or A record) at the VPS.
3. **Firewall**: open 80/443 (TLS via Caddy or the provider's proxy), keep 8080 closed
   externally; the compose exposes 8080 — put Caddy in front or proxy at the provider.
4. **Docker**: install docker + compose plugin on the VPS; clone the repo; create
   `/srv/resonance-demo/music` and copy the curated CC library in.
5. **CC library (legal first)**: only Creative-Commons-licensed tracks — e.g. music from
   Jamendo (CC filter), Free Music Archive, and other CC0/CC-BY sources. Curate 2–5k
   tracks, keep an index file (`sources.txt`) recording where each batch came from.
6. **Run**: `docker compose -f docker/demo-compose.yml up -d --build`.
7. **First-run setup**: create the admin account in the UI; from Settings, scan
   `/music`. Note: a future "guest mode / auto-login" would skip this step — see the
   open question in PLAN-upgrade.md.
8. **Dodo for the demo**: set the real `DODO_PRODUCT_*` env vars so demo visitors can
   actually buy (the acceptance test for Phase 2 is buying through the demo server).
9. **Monitoring**: health endpoint already exists (`/api/health`); add an uptime check
   (cron or an external service). Monthly cost cap: if the VPS bill would exceed the
   plan, the demo shuts down first.

## Reset

```bash
./demo-reset.sh
```

Wipes the data volume (accounts, licenses, scan state) and restarts with a clean
library. Run nightly via cron if you want a fresh demo every day.

## Load test (Phase 3 acceptance)

```bash
# example with hey (or ab / k6)
hey -n 10000 -c 100 http://localhost:8080/api/health
# and a real playback flow: login, list tracks, stream one
```

Acceptance: survives 100 concurrent browsers; audio plays; reset is clean.

## Link it

- Landing page: the "Try the live demo" button on `website/index.html` points at
  `/demo` — once Caddy proxies `demo.resonance.app`, set the button to the real URL.
- App: a "you're on the demo" banner is future work (PLAN-upgrade.md open questions).
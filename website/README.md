# Resonance website

Static, zero-build marketing site for Resonance (the public face at resonance.app).
It also hosts the serverless **key shop** (`netlify/functions/`) — checkout and license-key
delivery with zero infrastructure cost.

## Pages

- `index.html` — hero, feature grid, screenshot gallery (placeholders until launch)
- `compare.html` — honest comparison vs Navidrome / Jellyfin / Plex / Roon / Spotify
- `download.html` — native installers + Docker one-liner + build-from-source
- `pricing.html` — Free / Pro $29/yr / Lifetime $119 / Enterprise + licensing FAQ + Founding 50
- `privacy.html`, `changelog.html`, `pwa.html`

## Key shop (serverless, $0)

Netlify Functions + Netlify Blobs + Resend. Sold at full price; the first 50 payments
("Founding 50") get founder perks, capped automatically.

| Function | Route | What it does |
| --- | --- | --- |
| `checkout.ts` | `POST /api/checkout` | Validates tier/name/email, checks the 50-cap, creates a Dodo payment, returns the payment link |
| `webhook.ts` | `POST /api/webhook/dodo` | Verifies the HMAC-SHA256 `Dodo-Signature`, mints the key (`RES-PRO-`/`RES-LIF-` + 16 hex), emails it via Resend, increments the counter, records founders |
| `status.ts` | `GET /api/status` | Returns `{open, total, sold, spots_left}` for the pricing page |

The minted key format matches `backend/src/license.rs` exactly, so keys activate on any
customer's self-hosted server (Settings → Upgrade → Activate License).

### Setup (before launch)

1. Create a **new** Netlify account (do not reuse the burgonomics project) and a **Resend** account.
2. In Resend: add a sender domain (or use `onramp@resend.dev` for testing), copy the API key.
3. In Dodo: create two products (Pro $29/yr, Lifetime $119 once), copy the API key,
   set the webhook URL to `https://<site>/.netlify/functions/webhook`, and copy the webhook secret.
4. Deploy this folder to Netlify (publish root `website/`). Point `resonance.app` DNS at Netlify.
5. Set site env vars:

   ```
   SHOP_ENABLED=false        # flip to true at launch
   DODO_API_KEY=...
   DODO_PRODUCT_PRO=pdt_...
   DODO_PRODUCT_LIFETIME=pdt_...
   DODO_WEBHOOK_SECRET=whsec_...
   RESEND_API_KEY=re_...
   EMAIL_FROM=Resonance <keys@resonance.app>
   SITE_URL=https://resonance.app
   ```

6. `npm install` once in `website/` (for `@netlify/blobs`), commit the lockfile.
7. At launch: flip `SHOP_ENABLED=true`, publish the site, and the pricing page buttons go live.
   When the counter hits 50 the perks stop automatically; checkout keeps running normally.

While `SHOP_ENABLED=false` (or while the site is still on GitHub Pages without functions)
the pricing buttons read **"Available at launch"** — no broken checkout.

## Run locally

```sh
python -m http.server 8000   # then open http://localhost:8000
```

or any static server — `npx serve`, `docker run -p 8080:80 -v $PWD:/usr/share/nginx/html nginx`, etc.

## Deploy (GitHub Pages)

The `CNAME` file pins the custom domain `resonance.app` (DNS CNAME must point
`resonance.app` → `<user>.github.io`). Publish the `website/` folder as the Pages root,
or add a Pages workflow that uploads `website/` as the artifact.

> At launch the site moves to Netlify so `/api/*` functions run on the same origin.
> GitHub Pages keeps working as a fallback until then (buttons show "Available at launch").

## Before launch checklist

- [ ] Real screenshots in `screenshots/` (see `screenshots/README.md` for filenames)
- [ ] Point demo links at the live demo server
- [ ] Verify GitHub release asset names match `download.html`
- [ ] Netlify + Resend accounts created, Dodo products + webhook configured (see Key shop)
- [ ] `SHOP_ENABLED=true` flipped, `sales@resonance.app` mailbox exists
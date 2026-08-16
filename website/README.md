# Resonance website

Static, zero-build marketing site for Resonance (the public face at resonance.app).

## Pages

- `index.html` — hero, feature grid, screenshot gallery (placeholders until launch)
- `compare.html` — honest comparison vs Navidrome / Jellyfin / Plex / Roon / Spotify
- `download.html` — native installers + Docker one-liner + build-from-source
- `pricing.html` — Free / Pro $29/yr / Lifetime $119 / Enterprise + licensing FAQ

## Run locally

```sh
python -m http.server 8000   # then open http://localhost:8000
```

or any static server — `npx serve`, `docker run -p 8080:80 -v $PWD:/usr/share/nginx/html nginx`, etc.

## Deploy (GitHub Pages)

The `CNAME` file pins the custom domain `resonance.app` (DNS CNAME must point
`resonance.app` → `<user>.github.io`). Publish the `website/` folder as the Pages root,
or add a Pages workflow that uploads `website/` as the artifact.

## Before launch checklist

- [ ] Real screenshots in `screenshots/` (see `screenshots/README.md` for filenames)
- [ ] Point demo links at the live demo server
- [ ] Verify GitHub release asset names match `download.html`
- [ ] Dodo checkout live, `Buy Pro` / `Buy Lifetime` buttons wired
- [ ] `sales@resonance.app` mailbox exists
# Deploying GREENLOOP — five minutes to a shareable install

Everything is static files. Any host that serves a directory works. The canonical
deployment is **Cloudflare Workers (static assets)** — free, unmetered static
requests, auto-deploy on push, and a custom domain is one click when you want one.

## Repository layout

The published site is the repository root, served as-is:

```
greenloop/
├── index.html       the docs page (site entry point)
├── install.sh       the installer — must stay at the site root (curl | sh)
├── SHA256SUMS       integrity manifest, verified by install.sh
├── wrangler.jsonc   Cloudflare Workers config (assets-only, no Worker script)
├── .assetsignore    files wrangler must never upload (private/local material)
├── workflow/        the workflow files agents read
│   ├── GREENLOOP.md
│   ├── GREENLOOP-APPENDICES.md
│   ├── GREENLOOP-PROFILE-DESIGN.md
│   └── greenloop.state.schema.json
├── cli/
│   └── greenloop-inject.ts   the injector CLI (single file, embeds the workflow)
└── docs/
    └── DEPLOY.md    this file
```

`install.sh` fetches from `workflow/` and `cli/` relative to its `BASE_URL`, so the
layout above is load-bearing — keep it when forking.

## Cloudflare Workers (canonical: greenloop.violhex.workers.dev)

Why Workers and not Pages: as of 2026 Cloudflare directs new projects to Workers
with static assets — Pages still runs but only receives maintenance updates. Static
asset requests on Workers are free and unmetered on the free plan, which is what
you want for a `curl | sh` endpoint.

**Dashboard path (auto-deploy on every push):**

1. [dash.cloudflare.com](https://dash.cloudflare.com) → sign up / log in (free plan).
2. First time only: set your account's `workers.dev` subdomain to `violhex`
   (Workers & Pages → overview → change subdomain). The baked-in install URL
   assumes `greenloop.violhex.workers.dev` — project name `greenloop`, subdomain
   `violhex`.
3. Workers & Pages → **Create** → **Workers** → **Import a repository** → connect
   GitHub → select `violhex/greenloop`.
4. Build settings: no build command. Wrangler reads `wrangler.jsonc` from the repo
   and serves the root as static assets. Deploy.
5. Done — every push to `main` redeploys automatically.

**CLI path (deploy from your machine, no dashboard):**

```sh
npx wrangler login
npx wrangler deploy   # reads wrangler.jsonc, uploads the repo as static assets
```

`.assetsignore` keeps private material (`internal/`, `post.txt`, legacy copies) out
of the upload — relevant for CLI deploys, where gitignored files exist on disk.

Verify after first deploy:

```sh
curl -fsSL https://greenloop.violhex.workers.dev/install.sh | sh -s -- --help
```

If you pick a different project name or subdomain, update the fallback URL:

```sh
sed -i 's|greenloop.violhex.workers.dev|<your-host>|g' install.sh index.html README.md
```

The docs page rewrites its displayed install command to whatever domain serves it,
so the *site* is correct on any host automatically — the sed matters for
`install.sh` itself (its fallback `BASE_URL`) and the README.

## Custom domain

Workers → your `greenloop` project → Settings → Domains & Routes → add your domain
(DNS must be on Cloudflare, which is free). The install line becomes
`curl -fsSL https://greenloop.yourdomain.dev/install.sh | sh`. Nothing else changes —
`install.sh` derives nothing from its own URL, only from `BASE_URL`, so update that
with the same sed.

## Other hosts

- **Cloudflare Pages / Netlify / Render:** connect the repo; framework preset
  "none", no build command, output directory `/`. Works identically — but note
  Pages is in maintenance mode, and Netlify/Render free tiers cap bandwidth
  (~100 GB/month).
- **GitHub Pages:** Settings → Pages → Source: main, / (root). Free and fine as a
  mirror; URL would be `violhex.github.io/greenloop`.
- **Your own box:** `python3 -m http.server` behind any reverse proxy serves it; the
  installer only needs the files reachable over HTTP(S).

Anyone can install from any mirror without edits via the override:
`GREENLOOP_BASE_URL=https://<mirror> sh install.sh`.

## Releasing a new version

1. Edit the files in `workflow/` (or regenerate via your pipeline), and mirror any
   workflow change into the embedded payloads in `cli/greenloop-inject.ts` — the
   injector ships its own copy and the two must stay byte-identical.
2. Bump the version string in `workflow/GREENLOOP.md`, `install.sh` (`VERSION=`), and
   `cli/greenloop-inject.ts` (`const VERSION`). Keep them in lockstep — the injector
   and installer use it for marker-block upgrades, so a stale version means re-runs
   silently no-op instead of upgrading.
3. Regenerate checksums — the installer verifies these when a sha tool is present:
   ```sh
   sha256sum workflow/GREENLOOP.md workflow/GREENLOOP-APPENDICES.md \
     workflow/greenloop.state.schema.json workflow/GREENLOOP-PROFILE-DESIGN.md \
     cli/greenloop-inject.ts > SHA256SUMS
   ```
4. Commit, tag (`git tag v2.x.y`), push. The site redeploys on push; existing
   installs upgrade on their next `greenloop` run or `curl | sh`.

## Community notes

- The repository ships with an MIT `LICENSE` (© violhex) — forks keep the notice.
- The whole point of the marker-block design is safe coexistence: encourage people to
  commit `GREENLOOP.md` to their repos and edit it. Their fork of the *workflow*
  doesn't require a fork of the *site*.
- Forks: replace the host and repo links in one pass —
  ```sh
  sed -i 's|greenloop.violhex.workers.dev|<your-host>|g; s|github.com/violhex|github.com/<you>|g' install.sh index.html README.md
  ```
- PRs that add agent targets go in one place: the `TARGETS` registry in
  `cli/greenloop-inject.ts` — a detect probe plus a plan function, ~15 lines each.

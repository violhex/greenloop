# Deploying GREENLOOP — five minutes to a shareable install

Everything is static files. Any host that serves a directory works; GitHub Pages is
the zero-cost default and gives you the repo, the docs site, and the install URL in
one place.

## Repository layout

The published site is the repository root, served as-is:

```
greenloop/
├── index.html       the docs page (GitHub Pages entry point)
├── install.sh       the installer — must stay at the site root (curl | sh)
├── SHA256SUMS       integrity manifest, verified by install.sh
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

## GitHub Pages (canonical: violhex/greenloop)

```sh
git init greenloop && cd greenloop
# drop the repository contents in, then:
git add -A && git commit -m "GREENLOOP v2.3.0"
git branch -M main && git remote add origin git@github.com:violhex/greenloop.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Source: main, / (root)**. Two minutes later:

```sh
curl -fsSL https://violhex.github.io/greenloop/install.sh | sh
```

The docs page rewrites its displayed install command to whatever domain serves it,
so a fork's site is correct automatically. A fork only needs to update the fallback
`BASE_URL` in `install.sh` and the source links in `index.html`:

```sh
sed -i 's|violhex.github.io/greenloop|<you>.github.io/greenloop|g; s|github.com/violhex|github.com/<you>|g' install.sh index.html
```

## Custom domain

Add a `CNAME` file containing your domain, set DNS per GitHub's docs, and the install
line becomes `curl -fsSL https://greenloop.yourdomain.dev/install.sh | sh`. Nothing
else changes — `install.sh` derives nothing from its own URL, only from `BASE_URL`,
so update that in the same sed.

## Other hosts

- **Cloudflare Pages / Netlify / Vercel:** drag the folder in or connect the repo;
  framework preset "none", no build command, output directory `/`. Done.
- **Your own box:** `python3 -m http.server` behind any reverse proxy serves it; the
  installer only needs the files reachable over HTTP(S).

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
4. Commit, tag (`git tag v2.x.y`), push. Existing installs upgrade on their next
   `greenloop` run or `curl | sh`.

## Community notes

- The repository ships with an MIT `LICENSE` (© violhex) — forks keep the notice.
- The whole point of the marker-block design is safe coexistence: encourage people to
  commit `GREENLOOP.md` to their repos and edit it. Their fork of the *workflow*
  doesn't require a fork of the *site*.
- PRs that add agent targets go in one place: the `TARGETS` registry in
  `cli/greenloop-inject.ts` — a detect probe plus a plan function, ~15 lines each.

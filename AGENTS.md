# AGENTS.md

## Cursor Cloud specific instructions

GREENLOOP is **not a server app**. It is a static docs site (`index.html`) + a POSIX
installer (`install.sh`, the `curl | sh` target) + a single-file TypeScript CLI
(`cli/greenloop-inject.ts`). There is **no `package.json`, no build step, no test
suite, and no linter** in this repo — the strings `tsc`/`eslint`/`pytest` etc. appear
only as illustrative text inside the embedded workflow markdown, not as project
scripts. Repo layout and the release process are documented in `README.md` and
`docs/DEPLOY.md`; don't duplicate them here.

### Runtimes
- **`bun`** is the canonical runtime (the shebang in `cli/greenloop-inject.ts` is
  `#!/usr/bin/env bun`). It is installed to `~/.bun/bin` and is on `PATH` for login
  shells (the env update script installs it if missing). Bun auto-installs
  `@opentui/core` the first time the TUI runs — it is a lazy `import("@opentui/core")`
  in `cli/greenloop-inject.ts` (Bun's install-on-import behavior, noted in that file's
  header), not something GREENLOOP installs itself.
- **Fallback:** the installed `greenloop` shim and the CLI also run under
  `npx -y tsx cli/greenloop-inject.ts ...`, which works with the pre-installed Node 22
  for headless commands when `bun` is unavailable.

### Running / testing the pieces
- **CLI (headless, safe):** `bun cli/greenloop-inject.ts --headless --list` (detect
  only), `--dry-run` (plan, write nothing), `--yes` (apply). Use `--dir=PATH` to target
  a repo other than the cwd — always test against a throwaway dir, never inject into
  `/workspace` itself.
- **Site (canonical dev):** `npx wrangler dev`. Gotcha: wrangler writes a `.wrangler/`
  dir into the repo root (the `./` assets directory it watches), which causes a
  continuous "Reloading local server" loop, and `.wrangler/` is **not** gitignored —
  never commit it. First run also shows an interactive prompt ("install Cloudflare
  skills?") — answer `n` in non-interactive contexts.
- **Site (simple/stable preview):** `python3 -m http.server 8000` from the repo root
  serves the site identically with no reload loop — prefer this for quick previews.
- **Installer end-to-end:** serve the repo root over HTTP, then point the installer at
  it with `GREENLOOP_BASE_URL`, e.g.
  `curl -fsSL http://localhost:8000/install.sh | GREENLOOP_BASE_URL=http://localhost:8000 sh -s -- --all`
  (modes: default = CLI only, `--repo`, `--all`, `--uninstall`). It verifies
  `SHA256SUMS` before installing.

### Release integrity
Two separate rules (see `docs/DEPLOY.md` for the exact commands):
- **VERSION string:** the same `VERSION` value must appear in `install.sh`,
  `workflow/GREENLOOP.md`, and `cli/greenloop-inject.ts` — these three stay in lockstep.
- **`SHA256SUMS`:** this is the generated checksums file, not a version file.
  Regenerate it (re-run the `sha256sum` command) after any change to `workflow/*` or
  `cli/greenloop-inject.ts`. `VERSION` is not part of `SHA256SUMS`; `SHA256SUMS` is a
  checksum artifact that must be refreshed after those edits.

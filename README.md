# GREENLOOP

**Done is an exit code.**

GREENLOOP is a state-machine execution workflow you hand to any AI coding agent —
Claude Code, Cursor, Windsurf, Aider, local models. It makes the agent persist its
state, converge before it edits, test its own assumptions, and refuse to call
anything finished until a verification harness says so.

```sh
curl -fsSL https://greenloop.violhex.workers.dev/install.sh | sh
```

Inject the current repo only (no CLI, pure shell): `… | sh -s -- --repo` ·
both: `--all` · remove: `--uninstall`

## The three disciplines

| | Law | Kills |
|---|---|---|
| **S** | **The State Law** — every decision, assumption, failure, and verification result is persisted to `.greenloop/`. If it exists only in context, it does not exist. | context loss, amnesia between sessions |
| **C** | **Convergence Machine** — ORBITING → CONTACT → LOCK_IN. No edit or irreversible action until the agent can write a falsifiable `DONE WHEN`. | orbiting, premature execution |
| **R** | **Reality Calibration** — assumptions live in a market with confidence, evidence, and a falsifier; the load-bearing one gets tested first; beliefs expire. | confidently wrong, goal corruption |

The full contract, the ten phases, and GREEN itself live in
[`workflow/GREENLOOP.md`](workflow/GREENLOOP.md).

## Repository layout

```
greenloop/
├── index.html       docs site (served at the site root)
├── install.sh       POSIX installer — curl | sh target, stays at site root
├── wrangler.jsonc   Cloudflare Workers config — serves the repo as the site
├── SHA256SUMS       integrity manifest verified by install.sh
├── AGENTS.md        Cursor Cloud / agent environment instructions
├── workflow/        the workflow files agents read
│   ├── GREENLOOP.md                  core workflow — contract, S/C/R, phases 0–10
│   ├── GREENLOOP-APPENDICES.md       orchestration · no-tools mode · role library
│   ├── GREENLOOP-PROFILE-DESIGN.md   domain profile — activates on visual tasks
│   └── greenloop.state.schema.json   copy-to-initialize state template
├── cli/
│   ├── greenloop-inject.ts           injector CLI — detection, bindings, TUI, gates
│   ├── greenloop-inject.test.ts      unit/integration tests for the injector
│   └── greenloop-mcp.ts              portable MCP server (verify / gate / state)
└── docs/
    └── DEPLOY.md    hosting, forking, and release process
```

`cli/greenloop-inject.ts` is deliberately single-file: it embeds the `workflow/`
payloads so one download binds everything. Any edit to `workflow/` must be mirrored
into the embedded constants (see [`docs/DEPLOY.md`](docs/DEPLOY.md)).

## Supported agents

Claude Code (CLAUDE.md + enforcement hooks), Cursor, Windsurf, Aider, Cline,
Roo Code, Continue, GitHub Copilot, OpenAI Codex CLI, Gemini CLI, OpenCode, Zed,
JetBrains Junie, OpenHands, local LLMs (system-prompt rendition) — and anything else
via the universal `AGENTS.md` convention. Sixteen targets in all; run
`greenloop --list` inside a repo to see what's detected.

## Safety, by construction

- **Proportional** — every task is triaged (TRIVIAL → HAZARDOUS) and the workflow
  compresses to match: a typo fix runs a 30-second self-check, destructive work
  requires explicit user confirmation. Effort is budgeted, not unbounded.
- **Idempotent** — re-running upgrades in place, never duplicates.
- **Non-destructive** — shared files get marker-delimited blocks; unrecognized files
  are backed up to `.bak` before replacement. Nothing is ever deleted.
- **Verifiable** — `install.sh` checks `SHA256SUMS` before installing anything; the
  files are plain markdown, JSON, and one TypeScript file. Read them first — that's
  the point.

## Contributing

PRs that add agent targets go in one place: the `TARGETS` registry in
`cli/greenloop-inject.ts` — a detect probe plus a plan function, ~15 lines each.
Release process is in [`docs/DEPLOY.md`](docs/DEPLOY.md).

## License

[MIT](LICENSE) © [violhex](https://github.com/violhex)

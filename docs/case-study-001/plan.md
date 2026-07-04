# Plan — Case Study 001: enforce the payload-mirror invariant

Target: DEPLOY.md L102-103 requires every `workflow/` edit to be mirrored into the
embedded payload constants in `cli/greenloop-inject.ts`. Nothing enforces this —
the suite checks version strings only. One character of drift would ship silently.

DONE WHEN: `node --experimental-strip-types --test cli/greenloop-inject.test.ts`
exits 0 with 89 tests passing (4 new parity tests), AND a deliberate 1-byte mutation
of `workflow/GREENLOOP.md` makes the suite fail, AND restoring the file returns it
to green with `git diff` clean on `workflow/`.

## Steps

- **S1** — Append section 11 to `cli/greenloop-inject.test.ts`:
  `extractPayload(source, name)` — terminates at an unescaped trailing backtick
  (the payload constants do NOT close with a lone-backtick line; the existing
  `extractConst` helper cannot extract them — confirmed by RCA in state.failures[0]),
  then unescapes `` \` `` → `` ` ``, `\${` → `${`, `\\` → `\`.
  Four tests, one per pair:
  | const | file |
  |---|---|
  | GREENLOOP_CORE | workflow/GREENLOOP.md |
  | GREENLOOP_APPENDICES | workflow/GREENLOOP-APPENDICES.md |
  | GREENLOOP_SCHEMA | workflow/greenloop.state.schema.json |
  | GREENLOOP_PROFILE_DESIGN | workflow/GREENLOOP-PROFILE-DESIGN.md |
  Comparison is `.trim()`-equal (payload opens after the backtick's newline; file has
  trailing newline). Failure message reports first differing line, not a 45KB dump.
  Verify: suite → 89 pass.

- **S2** — Mutation check (harness proves it can fail): append one byte to
  `workflow/GREENLOOP.md` → run suite → expect GREENLOOP_CORE parity FAIL →
  restore → expect 89 pass, `git diff` clean.

- **S3** — REPORT: write `docs/CASE-STUDY-001.md` (task, state, decisions,
  verification, outcome); link it from README.md and index.html (link only).

## Scope fence
Tests + docs + links only. No edits to `cli/greenloop-inject.ts`, `workflow/*`,
`install.sh`, `SHA256SUMS`. No deploy. Legacy `src/` untouched.

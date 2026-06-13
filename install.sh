#!/bin/sh
# ════════════════════════════════════════════════════════════════════════
# GREENLOOP installer — https://github.com/violhex/greenloop
# Author: violhex (https://github.com/violhex) · MIT
#
#   curl -fsSL https://greenloop.violhex.workers.dev/install.sh | sh
#
# Modes (pass after `sh -s --`):
#   (none)        install the `greenloop` CLI                  [default]
#   --repo        inject GREENLOOP into the current directory (no CLI,
#                 no runtime needed — pure shell)
#   --all         both of the above
#   --uninstall   remove the CLI and ~/.greenloop home
#
# Examples:
#   curl -fsSL .../install.sh | sh                      # CLI only
#   curl -fsSL .../install.sh | sh -s -- --repo         # this repo only
#   curl -fsSL .../install.sh | sh -s -- --all
#
# Environment overrides:
#   GREENLOOP_BASE_URL   where to fetch files     (default: this site)
#   GREENLOOP_HOME       install home             (default: ~/.greenloop)
#   GREENLOOP_BIN        shim directory           (default: ~/.local/bin)
#
# POSIX sh. No root. Idempotent — re-running upgrades in place.
# ════════════════════════════════════════════════════════════════════════
set -eu

VERSION="2.4.0"
BASE_URL="${GREENLOOP_BASE_URL:-https://greenloop.violhex.workers.dev}"
GL_HOME="${GREENLOOP_HOME:-$HOME/.greenloop}"
BIN_DIR="${GREENLOOP_BIN:-$HOME/.local/bin}"
# Repo layout: workflow files live under workflow/, the CLI under cli/.
FILES="GREENLOOP.md GREENLOOP-APPENDICES.md greenloop.state.schema.json GREENLOOP-PROFILE-DESIGN.md"
MARK_BEGIN="<!-- GREENLOOP:BEGIN agents v$VERSION -->"
MARK_END="<!-- GREENLOOP:END agents -->"

say()  { printf '%s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
note() { printf '  \033[2m·\033[0m %s\n' "$*"; }
die()  { printf 'greenloop: %s\n' "$*" >&2; exit 1; }

# ── fetch abstraction ────────────────────────────────────────────────────
if command -v curl >/dev/null 2>&1; then
  fetch() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  fetch() { wget -q "$1" -O "$2"; }
else
  die "need curl or wget"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM

download_all() {
  say "Fetching GREENLOOP v$VERSION from $BASE_URL"
  # Mirror the repo layout in TMP so SHA256SUMS paths resolve as published.
  mkdir -p "$TMP/workflow" "$TMP/cli"
  for f in $FILES; do
    fetch "$BASE_URL/workflow/$f" "$TMP/workflow/$f" || die "failed to download workflow/$f — check GREENLOOP_BASE_URL"
  done
  fetch "$BASE_URL/cli/greenloop-inject.ts" "$TMP/cli/greenloop-inject.ts" || die "failed to download cli/greenloop-inject.ts — check GREENLOOP_BASE_URL"
  fetch "$BASE_URL/cli/greenloop-mcp.ts" "$TMP/cli/greenloop-mcp.ts" || die "failed to download cli/greenloop-mcp.ts — check GREENLOOP_BASE_URL"
  # Best-effort integrity check: verify if SHA256SUMS is published and a
  # checksum tool exists; warn (don't fail) if neither is available.
  if fetch "$BASE_URL/SHA256SUMS" "$TMP/SHA256SUMS" 2>/dev/null; then
    if command -v sha256sum >/dev/null 2>&1; then
      (cd "$TMP" && sha256sum -c SHA256SUMS --quiet) || die "checksum mismatch — refusing to install"
      ok "checksums verified"
    elif command -v shasum >/dev/null 2>&1; then
      (cd "$TMP" && shasum -a 256 -c SHA256SUMS >/dev/null) || die "checksum mismatch — refusing to install"
      ok "checksums verified"
    else
      note "no sha256 tool found — skipping checksum verification"
    fi
  else
    note "no SHA256SUMS published — skipping checksum verification"
  fi
}

# Install only when content differs; report what happened.
place() { # place <src> <dst>
  if [ -f "$2" ] && cmp -s "$1" "$2"; then
    note "$(basename "$2") already current"
  else
    [ -f "$2" ] && ! grep -q "GREENLOOP" "$2" 2>/dev/null && cp "$2" "$2.bak" && note "backed up existing $(basename "$2") → .bak"
    mkdir -p "$(dirname "$2")"
    cp "$1" "$2"
    ok "$(basename "$2")"
  fi
}

# ── mode: CLI install ────────────────────────────────────────────────────
install_cli() {
  say ""
  say "Installing the greenloop CLI"
  mkdir -p "$GL_HOME/bin" "$BIN_DIR"
  place "$TMP/cli/greenloop-inject.ts" "$GL_HOME/bin/greenloop-inject.ts"
  place "$TMP/cli/greenloop-mcp.ts" "$GL_HOME/bin/greenloop-mcp.ts"

  cat > "$TMP/greenloop" <<SHIM
#!/bin/sh
# greenloop CLI shim — runs the injector with the best available runtime.
SCRIPT="\${GREENLOOP_HOME:-\$HOME/.greenloop}/bin/greenloop-inject.ts"
[ -f "\$SCRIPT" ] || { echo "greenloop: \$SCRIPT missing — re-run the installer" >&2; exit 1; }
if command -v bun >/dev/null 2>&1; then exec bun "\$SCRIPT" "\$@"; fi
if command -v npx >/dev/null 2>&1; then exec npx -y tsx "\$SCRIPT" "\$@"; fi
echo "greenloop: needs bun (recommended) or npm." >&2
echo "  install bun:  curl -fsSL https://bun.sh/install | bash" >&2
exit 1
SHIM
  place "$TMP/greenloop" "$BIN_DIR/greenloop"
  chmod +x "$BIN_DIR/greenloop"

  case ":$PATH:" in
    *":$BIN_DIR:"*) ok "greenloop on PATH — run it inside any repo" ;;
    *) note "add to PATH:  export PATH=\"$BIN_DIR:\$PATH\"" ;;
  esac
  if ! command -v bun >/dev/null 2>&1 && ! command -v npx >/dev/null 2>&1; then
    note "the TUI needs bun:  curl -fsSL https://bun.sh/install | bash"
  fi
}

# ── mode: pure-shell repo injection (zero runtime dependencies) ─────────
# Writes the workflow files + the universal AGENTS.md binding. For per-agent
# bindings (Cursor rules, Claude Code hooks, …) run `greenloop` afterwards.
inject_repo() {
  say ""
  say "Injecting GREENLOOP into $(pwd)"
  for f in $FILES; do place "$TMP/workflow/$f" "./$f"; done
  mkdir -p .greenloop
  ok ".greenloop/ state directory"

  if [ -f AGENTS.md ] && grep -q "GREENLOOP:BEGIN agents" AGENTS.md; then
    if grep -qF "$MARK_BEGIN" AGENTS.md; then
      note "AGENTS.md binding already current"
    else
      # upgrade: replace the old marker block in place
      awk -v b="$MARK_BEGIN" -v e="$MARK_END" '
        /<!-- GREENLOOP:BEGIN agents/ {skip=1; print b; while ((getline l < "'"$TMP"'/pointer.md") > 0) print l; print e; next}
        /<!-- GREENLOOP:END agents/   {skip=0; next}
        skip!=1 {print}' AGENTS.md > AGENTS.md.new && mv AGENTS.md.new AGENTS.md
      ok "AGENTS.md binding upgraded to v$VERSION"
    fi
  else
    { [ -f AGENTS.md ] && printf '\n'; printf '%s\n' "$MARK_BEGIN"; cat "$TMP/pointer.md"; printf '%s\n' "$MARK_END"; } >> AGENTS.md
    ok "AGENTS.md binding"
  fi
}

write_pointer() {
  cat > "$TMP/pointer.md" <<PTR
**GREENLOOP v$VERSION is active in this repository.**

Before any coding task: read \`GREENLOOP.md\` at the repository root and follow
it end to end. It defines your phases, your state files (\`.greenloop/\`), and
what GREEN means. Companion files: \`greenloop.state.schema.json\`,
\`GREENLOOP-APPENDICES.md\`.

Non-negotiables that apply even before you read it:
1. THE STATE LAW — every decision, assumption, plan, failure, and verification
   result is persisted to \`.greenloop/\`. If it exists only in context, it
   does not exist.
2. GREEN is an exit code, not a feeling — never claim completion you did not
   verify this session.
3. No execution from ORBITING — no edit or irreversible action until you can
   state a DONE WHEN for it.
4. After 3 failed fixes of the same error: stop, write a root-cause analysis
   naming the wrong assumption. After 5: revert and change approach.
5. Resume from state, not memory — read \`.greenloop/state.json\` first.
   Assumptions inherited from a prior session are suspect until
   re-validated — never build on them unverified.
PTR
}

uninstall() {
  say "Uninstalling greenloop"
  rm -f "$BIN_DIR/greenloop" && ok "removed $BIN_DIR/greenloop" || true
  rm -rf "$GL_HOME" && ok "removed $GL_HOME" || true
  note "per-repo files (GREENLOOP.md, .greenloop/, AGENTS.md blocks) are left alone — delete those per repo if you want them gone"
  exit 0
}

# ── entry ────────────────────────────────────────────────────────────────
MODE="cli"
for arg in "$@"; do
  case "$arg" in
    --repo) MODE="repo" ;;
    --all) MODE="all" ;;
    --uninstall) uninstall ;;
    --help|-h) sed -n '2,26p' "$0" 2>/dev/null || say "see header of install.sh"; exit 0 ;;
    *) die "unknown flag: $arg (try --repo, --all, --uninstall)" ;;
  esac
done

say "GREENLOOP v$VERSION installer"
download_all
write_pointer
case "$MODE" in
  cli)  install_cli ;;
  repo) inject_repo ;;
  all)  install_cli; inject_repo ;;
esac

say ""
say "Done."
case "$MODE" in
  cli) say "Next: cd into a repo and run \`greenloop\` — it detects your agents and binds the workflow to each." ;;
  repo) say "For per-agent bindings (Cursor rules, Claude Code hooks, …): re-run with --all or just run \`greenloop\`." ;;
esac
exit 0

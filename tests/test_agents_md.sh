#!/bin/sh
# tests/test_agents_md.sh
#
# Verifies the factual claims documented in AGENTS.md.
#
# Usage (from repo root):
#   sh tests/test_agents_md.sh
#
# Exit code: 0 = all tests passed, 1 = one or more failures.
# No external dependencies — POSIX sh only.

set -eu

# ── helpers ──────────────────────────────────────────────────────────────────
PASS=0
FAIL=0
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

pass() { PASS=$((PASS+1)); printf '  ok  %s\n' "$1"; }
fail() { FAIL=$((FAIL+1)); printf 'FAIL  %s\n' "$1"; }

assert_file_exists() {
    if [ -f "$REPO_ROOT/$1" ]; then
        pass "file exists: $1"
    else
        fail "expected file to exist: $1"
    fi
}

assert_file_absent() {
    if [ ! -f "$REPO_ROOT/$1" ]; then
        pass "file correctly absent: $1"
    else
        fail "expected file to be absent: $1"
    fi
}

assert_dir_absent() {
    if [ ! -d "$REPO_ROOT/$1" ]; then
        pass "directory correctly absent: $1"
    else
        fail "expected directory to be absent: $1"
    fi
}

assert_contains() {
    # assert_contains FILE PATTERN DESCRIPTION
    # Use -e to handle patterns that start with - or -- without being parsed as flags.
    if grep -qF -e "$2" "$REPO_ROOT/$1" 2>/dev/null; then
        pass "$3"
    else
        fail "$3"
    fi
}

assert_not_contains() {
    # assert_not_contains FILE PATTERN DESCRIPTION
    if ! grep -qF -e "$2" "$REPO_ROOT/$1" 2>/dev/null; then
        pass "$3"
    else
        fail "$3"
    fi
}

# ── test suite ────────────────────────────────────────────────────────────────

printf 'Running AGENTS.md conformance tests (repo: %s)\n\n' "$REPO_ROOT"

# ── 1. Core repo files documented in AGENTS.md must exist ────────────────────
printf '# Section 1: repo file presence\n'
assert_file_exists "index.html"
assert_file_exists "install.sh"
assert_file_exists "cli/greenloop-inject.ts"
assert_file_exists "README.md"
assert_file_exists "docs/DEPLOY.md"
assert_file_exists "workflow/GREENLOOP.md"
assert_file_exists "SHA256SUMS"
assert_file_exists "AGENTS.md"

# ── 2. No package.json — AGENTS.md explicitly states the repo has none ────────
printf '\n# Section 2: absent files / no-build guarantee\n'
assert_file_absent "package.json"
assert_file_absent "tsconfig.json"
assert_file_absent "Makefile"

# ── 3. cli/greenloop-inject.ts shebang must be #!/usr/bin/env bun ─────────────
printf '\n# Section 3: bun shebang\n'
FIRST_LINE="$(head -1 "$REPO_ROOT/cli/greenloop-inject.ts")"
if [ "$FIRST_LINE" = '#!/usr/bin/env bun' ]; then
    pass "cli/greenloop-inject.ts shebang is #!/usr/bin/env bun"
else
    fail "cli/greenloop-inject.ts shebang: expected '#!/usr/bin/env bun', got '$FIRST_LINE'"
fi

# ── 4. VERSION lockstep across install.sh, cli/greenloop-inject.ts, workflow/GREENLOOP.md
#       AGENTS.md: "The VERSION string must stay in lockstep" ─────────────────
printf '\n# Section 4: version lockstep\n'

VERSION_INSTALL="$(grep '^VERSION=' "$REPO_ROOT/install.sh" | head -1 | sed 's/VERSION="//;s/"//')"
VERSION_CLI="$(grep '^const VERSION' "$REPO_ROOT/cli/greenloop-inject.ts" | head -1 | sed 's/const VERSION = "//;s/"//')"
VERSION_WORKFLOW="$(grep '^# GREENLOOP' "$REPO_ROOT/workflow/GREENLOOP.md" | head -1 | sed 's/.*v//')"

if [ -n "$VERSION_INSTALL" ]; then
    pass "install.sh VERSION is set: $VERSION_INSTALL"
else
    fail "install.sh VERSION string not found"
fi

if [ -n "$VERSION_CLI" ]; then
    pass "cli/greenloop-inject.ts VERSION is set: $VERSION_CLI"
else
    fail "cli/greenloop-inject.ts VERSION string not found"
fi

if [ -n "$VERSION_WORKFLOW" ]; then
    pass "workflow/GREENLOOP.md version header found: $VERSION_WORKFLOW"
else
    fail "workflow/GREENLOOP.md version header not found"
fi

if [ "$VERSION_INSTALL" = "$VERSION_CLI" ]; then
    pass "install.sh and cli/greenloop-inject.ts VERSION match ($VERSION_INSTALL)"
else
    fail "VERSION mismatch: install.sh='$VERSION_INSTALL' vs cli/greenloop-inject.ts='$VERSION_CLI'"
fi

if [ "$VERSION_INSTALL" = "$VERSION_WORKFLOW" ]; then
    pass "install.sh and workflow/GREENLOOP.md VERSION match ($VERSION_INSTALL)"
else
    fail "VERSION mismatch: install.sh='$VERSION_INSTALL' vs workflow/GREENLOOP.md='$VERSION_WORKFLOW'"
fi

# ── 5. SHA256SUMS covers the files AGENTS.md says must be hashed ─────────────
printf '\n# Section 5: SHA256SUMS coverage\n'
assert_contains "SHA256SUMS" "workflow/GREENLOOP.md"         "SHA256SUMS covers workflow/GREENLOOP.md"
assert_contains "SHA256SUMS" "workflow/GREENLOOP-APPENDICES.md" "SHA256SUMS covers workflow/GREENLOOP-APPENDICES.md"
assert_contains "SHA256SUMS" "workflow/greenloop.state.schema.json" "SHA256SUMS covers workflow/greenloop.state.schema.json"
assert_contains "SHA256SUMS" "cli/greenloop-inject.ts"       "SHA256SUMS covers cli/greenloop-inject.ts"

# SHA256SUMS hashes must be 64-character hex strings (sha256 = 256 bits = 64 hex chars)
HASH_COUNT="$(grep -cE '^[0-9a-f]{64}  ' "$REPO_ROOT/SHA256SUMS" 2>/dev/null || true)"
if [ "$HASH_COUNT" -ge 4 ]; then
    pass "SHA256SUMS contains at least 4 valid sha256 hash entries ($HASH_COUNT found)"
else
    fail "SHA256SUMS should contain >= 4 valid sha256 hash entries, found $HASH_COUNT"
fi

# ── 6. SHA256SUMS actual integrity check ─────────────────────────────────────
printf '\n# Section 6: SHA256SUMS actual checksum verification\n'
if command -v sha256sum >/dev/null 2>&1; then
    if (cd "$REPO_ROOT" && sha256sum -c SHA256SUMS --quiet 2>/dev/null); then
        pass "sha256sum -c SHA256SUMS passes for all listed files"
    else
        fail "sha256sum -c SHA256SUMS detected a mismatch — SHA256SUMS is stale"
    fi
elif command -v shasum >/dev/null 2>&1; then
    if (cd "$REPO_ROOT" && shasum -a 256 -c SHA256SUMS >/dev/null 2>&1); then
        pass "shasum -a 256 -c SHA256SUMS passes for all listed files"
    else
        fail "shasum -a 256 -c SHA256SUMS detected a mismatch — SHA256SUMS is stale"
    fi
else
    pass "no sha256 tool available — skipping integrity check (mirrors installer behavior)"
fi

# ── 7. install.sh documented installer flags/modes ───────────────────────────
printf '\n# Section 7: install.sh documented modes\n'
assert_contains "install.sh" "--repo"       "install.sh documents --repo mode"
assert_contains "install.sh" "--all"        "install.sh documents --all mode"
assert_contains "install.sh" "--uninstall"  "install.sh documents --uninstall mode"
assert_contains "install.sh" "GREENLOOP_BASE_URL" "install.sh supports GREENLOOP_BASE_URL env var"
assert_contains "install.sh" "GREENLOOP_HOME"     "install.sh supports GREENLOOP_HOME env var"
assert_contains "install.sh" "GREENLOOP_BIN"      "install.sh supports GREENLOOP_BIN env var"

# ── 8. install.sh SHA256SUMS verification logic ──────────────────────────────
printf '\n# Section 8: install.sh SHA256SUMS verification logic\n'
assert_contains "install.sh" "SHA256SUMS"            "install.sh references SHA256SUMS"
assert_contains "install.sh" "sha256sum"             "install.sh uses sha256sum for verification"
assert_contains "install.sh" "checksum mismatch"     "install.sh fails on checksum mismatch"

# ── 9. CLI flags documented in AGENTS.md ─────────────────────────────────────
printf '\n# Section 9: CLI flags documented in cli/greenloop-inject.ts\n'
assert_contains "cli/greenloop-inject.ts" "--headless" "CLI supports --headless flag"
assert_contains "cli/greenloop-inject.ts" "--list"     "CLI supports --list flag"
assert_contains "cli/greenloop-inject.ts" "--dry-run"  "CLI supports --dry-run flag"
assert_contains "cli/greenloop-inject.ts" "--yes"      "CLI supports --yes flag"
assert_contains "cli/greenloop-inject.ts" "--dir="     "CLI supports --dir=PATH flag"
assert_contains "cli/greenloop-inject.ts" "--agents="  "CLI supports --agents= flag"
assert_contains "cli/greenloop-inject.ts" "--hooks"    "CLI supports --hooks/--no-hooks flags"

# ── 10. .wrangler/ is NOT gitignored — the gotcha documented in AGENTS.md ────
printf '\n# Section 10: .wrangler/ gitignore absence (documented gotcha)\n'
assert_not_contains ".gitignore" ".wrangler" ".wrangler/ is NOT in .gitignore (documented gotcha — do not commit it manually)"

# ── 11. install.sh is POSIX sh (not bash) ────────────────────────────────────
printf '\n# Section 11: install.sh is POSIX sh\n'
INSTALL_SHEBANG="$(head -1 "$REPO_ROOT/install.sh")"
if [ "$INSTALL_SHEBANG" = '#!/bin/sh' ]; then
    pass "install.sh shebang is #!/bin/sh (POSIX)"
else
    fail "install.sh shebang: expected '#!/bin/sh', got '$INSTALL_SHEBANG'"
fi

# ── 12. workflow/GREENLOOP.md contains the version header ────────────────────
printf '\n# Section 12: workflow/GREENLOOP.md version header\n'
assert_contains "workflow/GREENLOOP.md" "v$VERSION_INSTALL" "workflow/GREENLOOP.md header contains v$VERSION_INSTALL"

# ── 13. Regression: docs/DEPLOY.md documents sha256sum command ───────────────
printf '\n# Section 13: docs/DEPLOY.md sha256sum command (regression)\n'
assert_contains "docs/DEPLOY.md" "sha256sum" "docs/DEPLOY.md documents the sha256sum regeneration command"
assert_contains "docs/DEPLOY.md" "SHA256SUMS" "docs/DEPLOY.md references SHA256SUMS"

# ── 14. Negative/boundary: no stray tsc/eslint/pytest project scripts ─────────
# AGENTS.md: "the strings tsc/eslint/pytest etc. appear only as illustrative text
# inside the embedded workflow markdown, not as project scripts"
printf '\n# Section 14: no build-tool project scripts at repo root\n'
assert_file_absent "package.json"   # already checked above; kept as explicit label
assert_file_absent ".eslintrc.js"
assert_file_absent ".eslintrc.json"
assert_file_absent "pytest.ini"
assert_file_absent "setup.py"
assert_file_absent "pyproject.toml"

# ── summary ──────────────────────────────────────────────────────────────────
printf '\n──────────────────────────────────────────────────\n'
printf 'Results: %d passed, %d failed\n' "$PASS" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
exit 0

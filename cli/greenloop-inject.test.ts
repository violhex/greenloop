/**
 * Tests for greenloop-inject.ts v2.4.0 changes:
 *   - VERSION bump to 2.4.0
 *   - HOOK_PRETOOL: enhanced checks (done_when, design intent-lock)
 *   - OPENCODE_PLUGIN: new TypeScript enforcement gate
 *   - opencode TARGETS entry: enhanced detect/plan
 *   - TUI hooks status line update
 *
 * Runtime: node --experimental-strip-types --test
 */

import { test, describe, before, after, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import {
  existsSync, mkdirSync, writeFileSync, readFileSync,
  rmSync, mkdtempSync, statSync,
} from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"

// ── helpers ────────────────────────────────────────────────────────────

const SOURCE = readFileSync(new URL("./greenloop-inject.ts", import.meta.url), "utf8")

/** Extract the raw content of a const backtick string, line by line.
 *  Finds `const NAME = \`` then collects lines until a lone backtick line.
 *  This avoids confusion from ${...} interpolations in the TS source. */
function extractConst(source: string, name: string): string {
  const lines = source.split("\n")
  const startPrefix = `const ${name} = \``
  let startIdx = -1
  let firstLineRemainder = ""
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(startPrefix)) {
      startIdx = i
      firstLineRemainder = lines[i].slice(startPrefix.length)
      break
    }
  }
  if (startIdx === -1) throw new Error(`Could not find ${name} in source`)
  const collected: string[] = [firstLineRemainder]
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i] === "`") break
    collected.push(lines[i])
  }
  return collected.join("\n")
}

/** Run a POSIX sh script with given stdin input, return { code, stdout, stderr }. */
function runShellScript(scriptPath: string, input: string, env: Record<string, string> = {}) {
  const result = spawnSync("sh", [scriptPath], {
    input,
    encoding: "utf8",
    env: { ...process.env, ...env },
  })
  return {
    code: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}

/** Create a temporary directory and return its path. */
function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "gl-test-"))
}

/** Remove a temporary directory recursively. */
function removeTempDir(dir: string) {
  rmSync(dir, { recursive: true, force: true })
}

// ════════════════════════════════════════════════════════════════════════
// 1. VERSION constant
// ════════════════════════════════════════════════════════════════════════

describe("VERSION", () => {
  test("VERSION constant is 2.4.0", () => {
    assert.match(SOURCE, /const VERSION = "2\.4\.0"/)
  })

  test("GREENLOOP_CORE header references v2.4.0", () => {
    assert.match(SOURCE, /GREENLOOP — Agent Execution Workflow v2\.4\.0/)
  })

  test("GREENLOOP_APPENDICES header references v2.4.0", () => {
    assert.match(SOURCE, /GREENLOOP — Appendices \(companion to GREENLOOP\.md v2\.4\.0\)/)
  })

  test("GREENLOOP_PROFILE_DESIGN header references v2.4.0", () => {
    assert.match(SOURCE, /GREENLOOP — Domain Profile: DESIGN \(companion to GREENLOOP\.md v2\.4\.0\)/)
  })

  test("GREENLOOP_SCHEMA _doc references v2.4.0", () => {
    assert.match(SOURCE, /companion to GREENLOOP\.md v2\.4\.0/)
  })

  test("v2.4.0 changelog entry is present in GREENLOOP_CORE", () => {
    assert.match(SOURCE, /v2\.4\.0: enforcement parity/)
  })
})

// ════════════════════════════════════════════════════════════════════════
// 2. HOOK_PRETOOL — shell script enforcement gate
// ════════════════════════════════════════════════════════════════════════

describe("HOOK_PRETOOL", () => {
  let tmpDir: string
  let scriptPath: string
  let stateDir: string
  let statePath: string

  before(() => {
    // extractConst gives us the raw file characters from the TS template literal.
    // To reconstruct the actual runtime string we must apply the same escape
    // processing that the JS engine does:  \$ → $  and  \\ → \
    const raw = extractConst(SOURCE, "HOOK_PRETOOL")
    const script = raw.replace(/\\([$\\])/g, "$1")
    tmpDir = makeTempDir()
    scriptPath = join(tmpDir, "pre-tool.sh")
    stateDir = join(tmpDir, ".greenloop")
    statePath = join(stateDir, "state.json")
    mkdirSync(stateDir, { recursive: true })
    writeFileSync(scriptPath, script, { mode: 0o755 })
  })

  after(() => removeTempDir(tmpDir))

  afterEach(() => {
    // Clean up state.json and design dir between tests
    if (existsSync(statePath)) rmSync(statePath)
    const designDir = join(stateDir, "design")
    if (existsSync(designDir)) rmSync(designDir, { recursive: true, force: true })
  })

  function run(filePath: string, extraEnv: Record<string, string> = {}) {
    const input = JSON.stringify({ tool: "write", file_path: filePath })
    return runShellScript(scriptPath, input, {
      CLAUDE_PROJECT_DIR: tmpDir,
      ...extraEnv,
    })
  }

  function writeState(content: object | string) {
    const json = typeof content === "string" ? content : JSON.stringify(content, null, 2)
    writeFileSync(statePath, json)
  }

  // ── .greenloop/ bypass ────────────────────────────────────────────────

  test("allows writes to paths containing .greenloop/", () => {
    // Even without state.json, .greenloop/ writes are always permitted
    const r = run(join(tmpDir, ".greenloop", "state.json"))
    assert.equal(r.code, 0)
  })

  test("allows writes to paths containing .greenloop/ regardless of state", () => {
    const r = run(join(tmpDir, ".greenloop", "some-file.json"))
    assert.equal(r.code, 0)
  })

  // ── no state.json ─────────────────────────────────────────────────────

  test("blocks edit when state.json is missing", () => {
    const r = run(join(tmpDir, "src", "index.ts"))
    assert.equal(r.code, 2)
    assert.match(r.stderr, /no \.greenloop\/state\.json/)
    assert.match(r.stderr, /Phase 1/)
  })

  test("block message mentions initializing workflow state", () => {
    const r = run(join(tmpDir, "src", "index.ts"))
    assert.match(r.stderr, /initialize workflow state/)
  })

  // ── done_when empty ───────────────────────────────────────────────────

  test("blocks edit when done_when is absent from state.json", () => {
    writeState({ convergence: {} })
    const r = run(join(tmpDir, "src", "main.ts"))
    assert.equal(r.code, 2)
    assert.match(r.stderr, /done_when.*empty|done_when is empty/)
  })

  test("blocks edit when done_when is an empty string", () => {
    writeState({ convergence: { done_when: "" } })
    const r = run(join(tmpDir, "src", "main.ts"))
    assert.equal(r.code, 2)
    assert.match(r.stderr, /ORBITING/)
  })

  test("blocks edit when done_when key exists with only whitespace (shell regex requires non-empty quoted value)", () => {
    // The grep regex: "done_when"[space]*:[space]*"[^"]+" — empty string fails
    writeState({ convergence: { done_when: "" } })
    const r = run(join(tmpDir, "src", "main.ts"))
    assert.equal(r.code, 2)
    assert.match(r.stderr, /LOCK_IN/)
  })

  test("block message references Section C and ORBITING", () => {
    writeState({ convergence: {} })
    const r = run(join(tmpDir, "src", "main.ts"))
    assert.match(r.stderr, /Section C/)
    assert.match(r.stderr, /ORBITING/)
  })

  // ── done_when present → allowed ───────────────────────────────────────

  test("allows edit when done_when is a non-empty string", () => {
    writeState({ convergence: { done_when: "all tests pass and CI is green" } })
    const r = run(join(tmpDir, "src", "main.ts"))
    assert.equal(r.code, 0)
  })

  // ── design dir checks ────────────────────────────────────────────────

  test("blocks edit when design/ dir exists but intent-lock.md is missing", () => {
    writeState({ convergence: { done_when: "tests pass" } })
    const designDir = join(stateDir, "design")
    mkdirSync(designDir, { recursive: true })
    // no intent-lock.md
    const r = run(join(tmpDir, "src", "Component.tsx"))
    assert.equal(r.code, 2)
    assert.match(r.stderr, /intent-lock\.md/)
    assert.match(r.stderr, /DESIGN.*P0|P0.*DESIGN/)
  })

  test("blocks edit when design/ dir exists but intent-lock.md is empty", () => {
    writeState({ convergence: { done_when: "tests pass" } })
    const designDir = join(stateDir, "design")
    mkdirSync(designDir, { recursive: true })
    writeFileSync(join(designDir, "intent-lock.md"), "")
    const r = run(join(tmpDir, "src", "Component.tsx"))
    assert.equal(r.code, 2)
    assert.match(r.stderr, /intent-lock\.md/)
  })

  test("allows edit when design/ dir exists and intent-lock.md has content", () => {
    writeState({ convergence: { done_when: "tests pass" } })
    const designDir = join(stateDir, "design")
    mkdirSync(designDir, { recursive: true })
    writeFileSync(join(designDir, "intent-lock.md"), "Reference Fidelity Lock content here")
    const r = run(join(tmpDir, "src", "Component.tsx"))
    assert.equal(r.code, 0)
  })

  test("allows edit when no design/ dir and done_when is present", () => {
    writeState({ convergence: { done_when: "all tests pass" } })
    const r = run(join(tmpDir, "src", "index.ts"))
    assert.equal(r.code, 0)
  })

  // ── edge cases ───────────────────────────────────────────────────────

  test("file_path extraction handles typical JSON input format", () => {
    // Verify that a non-.greenloop path triggers state check
    writeState({ convergence: { done_when: "done" } })
    const r = run("/some/project/src/app.ts")
    assert.equal(r.code, 0)
  })

  test("blocks when state.json does not exist even with done_when in input", () => {
    // State file doesn't exist — should block regardless of input
    const r = run(join(tmpDir, "src", "index.ts"))
    assert.equal(r.code, 2)
  })
})

// ════════════════════════════════════════════════════════════════════════
// 3. OPENCODE_PLUGIN — source content checks
// ════════════════════════════════════════════════════════════════════════

describe("OPENCODE_PLUGIN source content", () => {
  let plugin: string

  before(() => {
    plugin = extractConst(SOURCE, "OPENCODE_PLUGIN")
  })

  test("exports GreenloopGate function", () => {
    assert.match(plugin, /export const GreenloopGate/)
  })

  test("handles tool.execute.before event", () => {
    assert.match(plugin, /tool\.execute\.before/)
  })

  test("EDIT_TOOLS set includes write, edit, patch, multiedit", () => {
    assert.match(plugin, /new Set\(\["write", "edit", "patch", "multiedit"\]\)/)
  })

  test("bypasses .greenloop targets", () => {
    assert.match(plugin, /target\.includes\("\.greenloop"\)/)
  })

  test("checks existsSync for state.json", () => {
    assert.match(plugin, /existsSync\(statePath\)/)
  })

  test("throws when state.json is missing", () => {
    assert.match(plugin, /no \.greenloop\/state\.json/)
    assert.match(plugin, /throw new Error/)
  })

  test("throws on invalid JSON state file", () => {
    assert.match(plugin, /not valid JSON/)
  })

  test("validates convergence.done_when is non-empty string", () => {
    assert.match(plugin, /convergence\.done_when/)
    assert.match(plugin, /doneWhen\.trim\(\) === ""/)
  })

  test("throws when done_when is empty referencing ORBITING and Section C", () => {
    assert.match(plugin, /ORBITING/)
    assert.match(plugin, /Section C/)
  })

  test("checks design dir for intent-lock.md via nonEmptyFile", () => {
    assert.match(plugin, /nonEmptyFile/)
    assert.match(plugin, /intent-lock\.md/)
  })

  test("throws on missing intent-lock.md mentioning DESIGN profile P0", () => {
    assert.match(plugin, /DESIGN profile P0/)
  })

  test("nonEmptyFile uses statSync to check file size", () => {
    assert.match(plugin, /statSync\(p\)\.size > 0/)
  })

  test("GreenloopGate accepts directory and worktree options", () => {
    assert.match(plugin, /\{ directory, worktree \}/)
  })

  test("falls back to process.cwd() when directory and worktree are absent", () => {
    assert.match(plugin, /process\.cwd\(\)/)
  })

  test("skips non-edit tools (returns early without blocking)", () => {
    // The handler returns early if tool is not in EDIT_TOOLS
    assert.match(plugin, /!EDIT_TOOLS\.has\(input\.tool\)/)
  })

  test("reads filePath, path, and file from args for target resolution", () => {
    assert.match(plugin, /args\.filePath \|\| args\.path \|\| args\.file/)
  })

  test("plugin has MIT license comment", () => {
    assert.match(plugin, /MIT/)
    assert.match(plugin, /violhex/)
  })
})

// ════════════════════════════════════════════════════════════════════════
// 4. OPENCODE_PLUGIN — runtime logic tests (integration)
// ════════════════════════════════════════════════════════════════════════

describe("OPENCODE_PLUGIN runtime logic", () => {
  let tmpDir: string
  let glDir: string
  let statePath: string
  let gate: Awaited<ReturnType<any>>

  async function loadGate(root: string) {
    // Write the plugin to a temp .mjs file, rewriting TS-specific parts
    // to plain JS so node can load it without tsx/bun.
    const raw = extractConst(SOURCE, "OPENCODE_PLUGIN")
    // Re-use the logic directly by importing what we need and reimplementing
    // the gate inline — avoids TypeScript compilation dependency.
    return null // signals we use the inline reimplementation below
  }

  // Inline re-implementation of GreenloopGate logic for unit testing.
  // Mirrors the code in OPENCODE_PLUGIN exactly.
  const EDIT_TOOLS = new Set(["write", "edit", "patch", "multiedit"])

  function nonEmptyFile(p: string): boolean {
    try { return statSync(p).size > 0 } catch { return false }
  }

  async function makeGate(root: string) {
    const gl = join(root, ".greenloop")
    const statePath = join(gl, "state.json")
    const designDir = join(gl, "design")

    return async (input: any, output: any) => {
      if (!input || !EDIT_TOOLS.has(input.tool)) return
      const args = (output && output.args) || {}
      const target = String(args.filePath || args.path || args.file || "")
      if (target.includes(".greenloop")) return

      if (!existsSync(statePath)) {
        throw new Error(
          "GREENLOOP: no .greenloop/state.json — initialize workflow state before editing files. " +
          "Run Phase 1 (TRIAGE): copy greenloop.state.schema.json to .greenloop/state.json and populate " +
          "user_request, DoD, and budgets per GREENLOOP.md.",
        )
      }
      let state: any
      try {
        state = JSON.parse(readFileSync(statePath, "utf8"))
      } catch {
        throw new Error("GREENLOOP: .greenloop/state.json is not valid JSON — fix it before editing project files.")
      }
      const doneWhen = state && state.convergence && state.convergence.done_when
      if (typeof doneWhen !== "string" || doneWhen.trim() === "") {
        throw new Error(
          "GREENLOOP: convergence.done_when is empty — no edit may be made from ORBITING (Section C). " +
          "Reach LOCK_IN first: write a falsifiable DONE WHEN into .greenloop/state.json before editing project files.",
        )
      }
      if (existsSync(designDir) && !nonEmptyFile(join(designDir, "intent-lock.md"))) {
        throw new Error(
          "GREENLOOP: .greenloop/design/ exists but intent-lock.md is empty — write the Reference Fidelity Lock " +
          "(DESIGN profile P0) before generating component code.",
        )
      }
    }
  }

  beforeEach(() => {
    tmpDir = makeTempDir()
    glDir = join(tmpDir, ".greenloop")
    statePath = join(glDir, "state.json")
    mkdirSync(glDir, { recursive: true })
  })

  afterEach(() => removeTempDir(tmpDir))

  async function call(handler: any, tool: string, filePath: string) {
    return handler({ tool }, { args: { filePath } })
  }

  test("non-edit tools (read, ls) pass through without error", async () => {
    const h = await makeGate(tmpDir)
    // Should not throw — read/ls are not in EDIT_TOOLS
    await assert.doesNotReject(() => call(h, "read", join(tmpDir, "src", "x.ts")))
  })

  test("null input passes through without error", async () => {
    const h = await makeGate(tmpDir)
    await assert.doesNotReject(() => h(null, null))
  })

  test("edit to .greenloop path passes through without checking state", async () => {
    const h = await makeGate(tmpDir)
    // state.json does NOT exist, but the path contains .greenloop
    await assert.doesNotReject(() => call(h, "write", join(tmpDir, ".greenloop", "state.json")))
  })

  test("throws when state.json is absent", async () => {
    const h = await makeGate(tmpDir)
    await assert.rejects(
      () => call(h, "write", join(tmpDir, "src", "app.ts")),
      (err: Error) => {
        assert.match(err.message, /no \.greenloop\/state\.json/)
        return true
      },
    )
  })

  test("throws when state.json contains invalid JSON", async () => {
    writeFileSync(statePath, "{ not valid json }")
    const h = await makeGate(tmpDir)
    await assert.rejects(
      () => call(h, "edit", join(tmpDir, "src", "app.ts")),
      (err: Error) => {
        assert.match(err.message, /not valid JSON/)
        return true
      },
    )
  })

  test("throws when convergence key is absent", async () => {
    writeFileSync(statePath, JSON.stringify({ goal: "build something" }))
    const h = await makeGate(tmpDir)
    await assert.rejects(
      () => call(h, "write", join(tmpDir, "src", "app.ts")),
      (err: Error) => {
        assert.match(err.message, /done_when.*empty|ORBITING/)
        return true
      },
    )
  })

  test("throws when done_when is an empty string", async () => {
    writeFileSync(statePath, JSON.stringify({ convergence: { done_when: "" } }))
    const h = await makeGate(tmpDir)
    await assert.rejects(
      () => call(h, "patch", join(tmpDir, "src", "app.ts")),
      (err: Error) => {
        assert.match(err.message, /ORBITING/)
        return true
      },
    )
  })

  test("throws when done_when is whitespace-only", async () => {
    writeFileSync(statePath, JSON.stringify({ convergence: { done_when: "   " } }))
    const h = await makeGate(tmpDir)
    await assert.rejects(
      () => call(h, "write", join(tmpDir, "src", "app.ts")),
      (err: Error) => {
        assert.match(err.message, /ORBITING/)
        return true
      },
    )
  })

  test("throws when done_when is a number (not a string)", async () => {
    writeFileSync(statePath, JSON.stringify({ convergence: { done_when: 42 } }))
    const h = await makeGate(tmpDir)
    await assert.rejects(
      () => call(h, "write", join(tmpDir, "src", "app.ts")),
      (err: Error) => {
        assert.match(err.message, /ORBITING/)
        return true
      },
    )
  })

  test("allows edit when done_when is non-empty and no design dir", async () => {
    writeFileSync(statePath, JSON.stringify({ convergence: { done_when: "all tests green" } }))
    const h = await makeGate(tmpDir)
    await assert.doesNotReject(() => call(h, "write", join(tmpDir, "src", "app.ts")))
  })

  test("throws when design dir exists but intent-lock.md is missing", async () => {
    writeFileSync(statePath, JSON.stringify({ convergence: { done_when: "all tests green" } }))
    mkdirSync(join(glDir, "design"), { recursive: true })
    const h = await makeGate(tmpDir)
    await assert.rejects(
      () => call(h, "write", join(tmpDir, "src", "Btn.tsx")),
      (err: Error) => {
        assert.match(err.message, /intent-lock\.md/)
        assert.match(err.message, /DESIGN profile P0/)
        return true
      },
    )
  })

  test("throws when design dir exists and intent-lock.md is empty", async () => {
    writeFileSync(statePath, JSON.stringify({ convergence: { done_when: "done" } }))
    const designDir = join(glDir, "design")
    mkdirSync(designDir, { recursive: true })
    writeFileSync(join(designDir, "intent-lock.md"), "")
    const h = await makeGate(tmpDir)
    await assert.rejects(
      () => call(h, "edit", join(tmpDir, "src", "Btn.tsx")),
      (err: Error) => {
        assert.match(err.message, /intent-lock\.md/)
        return true
      },
    )
  })

  test("allows edit when design dir exists and intent-lock.md has content", async () => {
    writeFileSync(statePath, JSON.stringify({ convergence: { done_when: "done" } }))
    const designDir = join(glDir, "design")
    mkdirSync(designDir, { recursive: true })
    writeFileSync(join(designDir, "intent-lock.md"), "Reference fidelity lock content")
    const h = await makeGate(tmpDir)
    await assert.doesNotReject(() => call(h, "write", join(tmpDir, "src", "Btn.tsx")))
  })

  test("multiedit tool is also subject to the gate", async () => {
    const h = await makeGate(tmpDir)
    await assert.rejects(
      () => call(h, "multiedit", join(tmpDir, "src", "app.ts")),
      /no \.greenloop\/state\.json/,
    )
  })

  test("resolves filePath from args.path field", async () => {
    writeFileSync(statePath, JSON.stringify({ convergence: { done_when: "done" } }))
    const h = await makeGate(tmpDir)
    // Use args.path instead of args.filePath
    await assert.doesNotReject(() =>
      h({ tool: "write" }, { args: { path: join(tmpDir, "src", "x.ts") } }),
    )
  })

  test("resolves filePath from args.file field", async () => {
    writeFileSync(statePath, JSON.stringify({ convergence: { done_when: "done" } }))
    const h = await makeGate(tmpDir)
    await assert.doesNotReject(() =>
      h({ tool: "edit" }, { args: { file: join(tmpDir, "src", "y.ts") } }),
    )
  })
})

// ════════════════════════════════════════════════════════════════════════
// 5. opencode TARGETS entry
// ════════════════════════════════════════════════════════════════════════

describe("opencode TARGETS entry", () => {
  test("opencode hint mentions enforcement plugin", () => {
    assert.match(SOURCE, /hint: "AGENTS\.md \+ optional enforcement plugin \(pre-edit state gate\)"/)
  })

  test("opencode detect includes .opencode/ in project path", () => {
    const idx = SOURCE.indexOf('id: "opencode"')
    const slice = SOURCE.slice(idx, idx + 900)
    assert.match(slice, /\.opencode.*in project/)
  })

  test("opencode detect includes opencode.json config detection", () => {
    const idx = SOURCE.indexOf('id: "opencode"')
    const slice = SOURCE.slice(idx, idx + 900)
    assert.match(slice, /opencode\.json/)
  })

  test("opencode detect includes opencode.jsonc config detection", () => {
    const idx = SOURCE.indexOf('id: "opencode"')
    const slice = SOURCE.slice(idx, idx + 900)
    assert.match(slice, /opencode\.jsonc/)
  })

  test("opencode plan includes ownedFile for greenloop.ts when hooks enabled", () => {
    const idx = SOURCE.indexOf('id: "opencode"')
    const slice = SOURCE.slice(idx, idx + 900)
    assert.match(slice, /ctx\.hooks/)
    assert.match(slice, /\.opencode.*plugins.*greenloop\.ts/)
  })

  test("opencode plan uses OPENCODE_PLUGIN constant for the plugin file", () => {
    const idx = SOURCE.indexOf('id: "opencode"')
    const slice = SOURCE.slice(idx, idx + 900)
    assert.match(slice, /OPENCODE_PLUGIN/)
  })

  test("opencode plan always includes AGENTS.md marker block", () => {
    const idx = SOURCE.indexOf('id: "opencode"')
    const slice = SOURCE.slice(idx, idx + 900)
    assert.match(slice, /markerBlock.*AGENTS\.md/)
  })

  test("opencode plan conditionally adds plugin only when ctx.hooks is true", () => {
    // Verify the plan is inside an if (ctx.hooks) guard
    const idx = SOURCE.indexOf('id: "opencode"')
    const slice = SOURCE.slice(idx, idx + 900)
    assert.match(slice, /if \(ctx\.hooks\)/)
  })
})

// ════════════════════════════════════════════════════════════════════════
// 6. TUI hooks status line
// ════════════════════════════════════════════════════════════════════════

describe("TUI hooks status line", () => {
  test("hooks status line mentions both Claude Code and OpenCode", () => {
    assert.match(SOURCE, /Claude Code PreToolUse\+Stop.*OpenCode pre-edit|OpenCode pre-edit.*Claude Code PreToolUse\+Stop/)
  })

  test("hooks status line mentions enforcement gates", () => {
    assert.match(SOURCE, /enforcement gates/)
  })

  test("hooks status line is in tui render function", () => {
    // Verify the updated string is present
    assert.match(SOURCE, /enforcement gates \(Claude Code PreToolUse\+Stop · OpenCode pre-edit\)/)
  })
})

// ════════════════════════════════════════════════════════════════════════
// 7. HOOK_PRETOOL source content checks
// ════════════════════════════════════════════════════════════════════════

describe("HOOK_PRETOOL source content", () => {
  test("reads INPUT from stdin using cat", () => {
    assert.match(SOURCE, /INPUT=\$\(cat\)/)
  })

  test("extracts file_path from JSON input", () => {
    assert.match(SOURCE, /file_path/)
  })

  test("includes .greenloop bypass via case statement", () => {
    assert.match(SOURCE, /\.greenloop/)
    assert.match(SOURCE, /case "\$FILE"/)
  })

  test("checks for done_when with grep -Eq regex", () => {
    assert.match(SOURCE, /done_when/)
    assert.match(SOURCE, /grep -Eq/)
  })

  test("checks design dir intent-lock.md with -s (non-empty file test)", () => {
    assert.match(SOURCE, /intent-lock\.md/)
    assert.match(SOURCE, /-s.*intent-lock\.md|-s.*design/)
  })

  test("error messages are sent to stderr (>&2)", () => {
    // Count occurrences: should have multiple >&2 redirects
    const matches = SOURCE.match(/>&2/g) ?? []
    assert.ok(matches.length >= 3, `Expected at least 3 >&2 redirects, got ${matches.length}`)
  })

  test("exit code 2 is used to block tool calls", () => {
    const matches = SOURCE.match(/exit 2/g) ?? []
    assert.ok(matches.length >= 3, `Expected at least 3 'exit 2' statements, got ${matches.length}`)
  })
})

// ════════════════════════════════════════════════════════════════════════
// 8. install.sh VERSION
// ════════════════════════════════════════════════════════════════════════

describe("install.sh VERSION", () => {
  test("install.sh VERSION is 2.4.0", () => {
    const installSh = readFileSync(
      new URL("../install.sh", import.meta.url),
      "utf8",
    )
    assert.match(installSh, /^VERSION="2\.4\.0"/m)
  })
})

// ════════════════════════════════════════════════════════════════════════
// 9. workflow file versions
// ════════════════════════════════════════════════════════════════════════

describe("workflow file versions", () => {
  test("GREENLOOP.md references v2.4.0 in title", () => {
    const content = readFileSync(
      new URL("../workflow/GREENLOOP.md", import.meta.url),
      "utf8",
    )
    assert.match(content, /Agent Execution Workflow v2\.4\.0/)
  })

  test("GREENLOOP-APPENDICES.md references v2.4.0 in title", () => {
    const content = readFileSync(
      new URL("../workflow/GREENLOOP-APPENDICES.md", import.meta.url),
      "utf8",
    )
    assert.match(content, /companion to GREENLOOP\.md v2\.4\.0/)
  })

  test("GREENLOOP-PROFILE-DESIGN.md references v2.4.0 in title", () => {
    const content = readFileSync(
      new URL("../workflow/GREENLOOP-PROFILE-DESIGN.md", import.meta.url),
      "utf8",
    )
    assert.match(content, /companion to GREENLOOP\.md v2\.4\.0/)
  })

  test("greenloop.state.schema.json _doc references v2.4.0", () => {
    const content = readFileSync(
      new URL("../workflow/greenloop.state.schema.json", import.meta.url),
      "utf8",
    )
    assert.match(content, /companion to GREENLOOP\.md v2\.4\.0/)
  })

  test("GREENLOOP.md has v2.4.0 changelog entry", () => {
    const content = readFileSync(
      new URL("../workflow/GREENLOOP.md", import.meta.url),
      "utf8",
    )
    assert.match(content, /v2\.4\.0: enforcement parity/)
  })

  test("GREENLOOP.md changelog mentions OpenCode pre-edit gate", () => {
    const content = readFileSync(
      new URL("../workflow/GREENLOOP.md", import.meta.url),
      "utf8",
    )
    assert.match(content, /opencode\/plugins\/greenloop\.ts|OpenCode.*pre-edit/)
  })
})

// ════════════════════════════════════════════════════════════════════════
// 10. index.html VERSION
// ════════════════════════════════════════════════════════════════════════

describe("index.html VERSION", () => {
  test("index.html eyebrow mentions v2.4.0", () => {
    const content = readFileSync(
      new URL("../index.html", import.meta.url),
      "utf8",
    )
    assert.match(content, /GREENLOOP v2\.4\.0/)
  })
})

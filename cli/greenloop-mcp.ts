#!/usr/bin/env bun
/**
 * greenloop-mcp.ts — GREENLOOP enforcement as a portable MCP server.
 * ──────────────────────────────────────────────────────────────────
 * Author: violhex (https://github.com/violhex) · MIT
 * Source: https://github.com/violhex/greenloop
 *
 * One artifact, every MCP-capable client (Cline, Continue, Zed, Cursor, custom
 * harnesses): exposes the GREENLOOP convergence model and its state-aware
 * checks as tools, so an agent can ask "may I edit this?" and "am I GREEN?"
 * and get a deterministic answer instead of a vibe. Zero dependencies —
 * hand-rolled JSON-RPC 2.0 over newline-delimited stdio (the MCP stdio
 * transport). Reads .greenloop/state.json; never writes.
 *
 * RUN:  bun greenloop-mcp.ts            (or: npx -y tsx greenloop-mcp.ts)
 *
 * Register it with your client, e.g. Claude Code .mcp.json:
 *   { "mcpServers": { "greenloop": { "command": "bun",
 *       "args": ["~/.greenloop/bin/greenloop-mcp.ts"] } } }
 * or opencode.json:
 *   { "mcp": { "greenloop": { "type": "local",
 *       "command": ["bun", "~/.greenloop/bin/greenloop-mcp.ts"] } } }
 *
 * TOOLS:
 *   greenloop_verify  — state-aware GREEN check (DoD, failures, False-GREEN guard)
 *   greenloop_gate    — may an edit to <file_path> proceed? (Section C gate)
 *   greenloop_state   — convergence snapshot (phase, state, done_when, drift)
 */

import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

const VERSION = "2.4.0"

/* ── state access (read-only; mirrors `greenloop verify`) ─────────────────── */

function readState(dir: string): any | null | "INVALID" {
  const p = join(dir, ".greenloop", "state.json")
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, "utf8")) } catch { return "INVALID" }
}

function verifyResult(dir: string): { green: boolean; reasons: string[]; dod: number } {
  const state = readState(dir)
  if (state === null) return { green: false, reasons: ["no .greenloop/state.json — run Phase 1 (TRIAGE) first"], dod: 0 }
  if (state === "INVALID") return { green: false, reasons: [".greenloop/state.json is not valid JSON"], dod: 0 }
  const reasons: string[] = []
  const dod: any[] = Array.isArray(state.dod) ? state.dod : []
  if (dod.length === 0) reasons.push("no DoD defined (Phase 2) — GREEN is not falsifiable")
  for (const d of dod) {
    if (!d || d.status !== "pass") reasons.push(`DoD ${d?.id ?? "?"} not pass (status=${d?.status ?? "?"})`)
    else if (!d.evidence) reasons.push(`DoD ${d.id ?? "?"} marked pass without evidence`)
  }
  const failures: any[] = Array.isArray(state.failures) ? state.failures : []
  for (const f of failures) if (f && f.error && !f.resolution) reasons.push(`unresolved failure at ${f.step ?? "?"}`)
  const v = state.verification ?? {}
  if (Number(v.green_claims ?? 0) >= 2 && !v.last_independent_check)
    reasons.push(`disputed GREEN (green_claims=${v.green_claims}) without an independent verification — get a fresh-eyes verdict and record verification.last_independent_check`)
  const harness = ["scripts/verify.sh", ".greenloop/verify.sh"].map(r => join(dir, r)).find(p => existsSync(p))
  if (harness) {
    const r = spawnSync(harness, [], { cwd: dir, encoding: "utf8" })
    if (r.status !== 0) reasons.push(`project harness failed (${harness}, exit ${r.status ?? "?"})`)
  }
  return { green: reasons.length === 0, reasons, dod: dod.length }
}

function gateResult(dir: string, filePath: string): { allow: boolean; reason: string } {
  if (filePath && filePath.includes(".greenloop")) return { allow: true, reason: "state-layer edit — always allowed" }
  const state = readState(dir)
  if (state === null) return { allow: false, reason: "no .greenloop/state.json — initialize workflow state (Phase 1) before editing project files" }
  if (state === "INVALID") return { allow: false, reason: ".greenloop/state.json is not valid JSON" }
  const doneWhen = state?.convergence?.done_when
  if (typeof doneWhen !== "string" || doneWhen.trim() === "")
    return { allow: false, reason: "convergence.done_when is empty — no edit from ORBITING (Section C). Reach LOCK_IN: write a falsifiable DONE WHEN first" }
  if (state.goal_confirmed !== true)
    return { allow: false, reason: "goal is not ratified — confirm the goal + DONE WHEN by an authority before editing. Interactive: 'greenloop confirm'. Autonomous/agent-led: 'greenloop confirm --delegated <id>'" }
  const designDir = join(dir, ".greenloop", "design")
  if (existsSync(designDir)) {
    const lock = join(designDir, "intent-lock.md")
    if (!existsSync(lock) || readFileSync(lock, "utf8").trim() === "")
      return { allow: false, reason: ".greenloop/design/ exists but intent-lock.md is empty — write the Reference Fidelity Lock (DESIGN P0) first" }
  }
  return { allow: true, reason: "LOCK_IN reached (done_when set) — edit allowed" }
}

function stateSummary(dir: string): string {
  const state = readState(dir)
  if (state === null) return "No .greenloop/state.json yet — no active GREENLOOP task."
  if (state === "INVALID") return ".greenloop/state.json is not valid JSON."
  const c = state.convergence ?? {}
  const v = state.verification ?? {}
  const dod: any[] = Array.isArray(state.dod) ? state.dod : []
  const passed = dod.filter(d => d && d.status === "pass").length
  const failures: any[] = Array.isArray(state.failures) ? state.failures : []
  const maxAtt = failures.reduce((m, f) => Math.max(m, Number(f?.attempts ?? 0)), 0)
  const openF = failures.filter(f => f && f.error && !f.resolution).length
  const claims = Number(v.green_claims ?? 0)
  let slip = 0
  if (claims >= 1) slip += claims * 2
  if (claims >= 2 && !v.last_independent_check) slip += 3
  if (maxAtt >= 3) slip += maxAtt
  slip += openF
  return [
    `phase:            ${state.phase ?? "?"}`,
    `convergence:      ${c.state ?? "?"}`,
    `goal_confirmed:   ${state.goal_confirmed === true ? "yes (by " + (state.goal_confirmed_by || "unknown") + ")" : "NO — gate closed until 'greenloop confirm' (or '--delegated <id>')"}`,
    `done_when:        ${c.done_when ? JSON.stringify(c.done_when) : "(empty)"}`,
    `DoD progress:     ${passed}/${dod.length} pass`,
    `green_claims:     ${v.green_claims ?? 0}  (reopened GREEN claims — drift signal)`,
    `independent_check: ${v.last_independent_check || "(none)"}`,
    `slip score:       ${slip} ${slip >= 4 ? "(SLIPPING — run 'greenloop check' for the one intervention)" : "(ok)"}`,
  ].join("\n")
}

/* ── MCP tools ────────────────────────────────────────────────────────────── */

const TOOLS = [
  {
    name: "greenloop_verify",
    description: "State-aware GREEN check for a GREENLOOP repo: every DoD item passes with evidence, no unresolved failures, a disputed GREEN has an independent verdict, and any project verify.sh passes. Returns GREEN or RED with reasons.",
    inputSchema: { type: "object", properties: { dir: { type: "string", description: "Project root (default: cwd)" } } },
  },
  {
    name: "greenloop_gate",
    description: "Ask whether an edit to a project file may proceed under the GREENLOOP convergence gate (Section C: no execution from ORBITING). Allowed only once state.json exists and convergence.done_when is set (and, on design tasks, intent-lock.md). Edits under .greenloop/ are always allowed.",
    inputSchema: { type: "object", properties: { dir: { type: "string", description: "Project root (default: cwd)" }, file_path: { type: "string", description: "Path of the file about to be edited" } }, required: ["file_path"] },
  },
  {
    name: "greenloop_state",
    description: "Convergence snapshot from .greenloop/state.json: current phase, convergence state (ORBITING/CONTACT/LOCK_IN), the active DONE WHEN, DoD progress, and the green_claims drift signal.",
    inputSchema: { type: "object", properties: { dir: { type: "string", description: "Project root (default: cwd)" } } },
  },
]

/* ── JSON-RPC 2.0 over newline-delimited stdio ────────────────────────────── */

function send(msg: any) { process.stdout.write(JSON.stringify(msg) + "\n") }
function reply(id: any, result: any) { send({ jsonrpc: "2.0", id, result }) }
function replyErr(id: any, code: number, message: string) { send({ jsonrpc: "2.0", id, error: { code, message } }) }
function textResult(id: any, text: string, isError = false) { reply(id, { content: [{ type: "text", text }], isError }) }

function handle(msg: any) {
  const { id, method, params } = msg ?? {}
  switch (method) {
    case "initialize":
      reply(id, {
        protocolVersion: params?.protocolVersion ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "greenloop", version: VERSION },
      })
      return
    case "notifications/initialized":
    case "notifications/cancelled":
      return // notifications: no response
    case "ping":
      reply(id, {})
      return
    case "tools/list":
      reply(id, { tools: TOOLS })
      return
    case "tools/call": {
      const name = params?.name
      const args = params?.arguments ?? {}
      const dir = resolve(args.dir ?? process.cwd())
      if (name === "greenloop_verify") {
        const r = verifyResult(dir)
        const text = r.green
          ? `GREEN ✓  ${r.dod} DoD item(s) pass.`
          : "RED — not GREEN:\n" + r.reasons.map(x => "  • " + x).join("\n")
        return textResult(id, text, !r.green)
      }
      if (name === "greenloop_gate") {
        if (!args.file_path) return replyErr(id, -32602, "greenloop_gate requires file_path")
        const r = gateResult(dir, String(args.file_path))
        return textResult(id, `${r.allow ? "ALLOW" : "DENY"}: ${r.reason}`, !r.allow)
      }
      if (name === "greenloop_state") return textResult(id, stateSummary(dir))
      return replyErr(id, -32602, "unknown tool: " + name)
    }
    default:
      if (id !== undefined && id !== null) replyErr(id, -32601, "method not found: " + method)
  }
}

let buf = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk: string) => {
  buf += chunk
  let nl: number
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim()
    buf = buf.slice(nl + 1)
    if (!line) continue
    let msg: any
    try { msg = JSON.parse(line) } catch { continue }
    try { handle(msg) } catch (e: any) {
      if (msg && msg.id !== undefined) replyErr(msg.id, -32603, "internal error: " + (e?.message ?? e))
    }
  }
})
process.stdin.on("end", () => process.exit(0))

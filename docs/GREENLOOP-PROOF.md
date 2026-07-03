# GREENLOOP Proof

## One-Line Position

Spec tools plan. GREENLOOP proves done.

## Problem

AI coding agents can produce convincing completion while reality disagrees:

- the original request drifted;
- the agent optimized the plan instead of the outcome;
- the verification command was missing, weak, or contradicted runtime state;
- the session ended with a summary instead of evidence;
- the next session lost the decisions that mattered.

The trust gap is not only whether an agent can write code. It is whether the work
can be reduced back into a verifiable state.

## GREENLOOP Wedge

GREENLOOP turns "done" into a stateful verification problem:

- the original request is persisted;
- the agent must write a falsifiable `DONE WHEN`;
- assumptions get evidence and falsifiers;
- edits are gated until the work has a real target;
- completion requires a verification harness;
- results are recorded in state and worklog artifacts.

The product claim is deliberately narrow:

> GREENLOOP is a verification layer for AI-assisted development.

## What Exists Today

### Product Surface

- Public site and installer: `https://greenloop.violhex.workers.dev/`
- POSIX installer with checksum verification.
- Universal repo injection through `AGENTS.md`.
- Native bindings for Claude Code, Cursor, Windsurf, Aider, Cline, Roo Code,
  Continue, GitHub Copilot, OpenAI Codex CLI, Gemini CLI, OpenCode, Zed,
  JetBrains Junie, OpenHands, local LLMs, and generic agents.
- Claude Code hooks for pre-edit state gating and stop-time verification.
- Portable MCP server exposing state, gate, and verify surfaces.

### Evidence Surface

The local research battery in `greenloop-research-v2` tested GREENLOOP against
synthetic investigation cases covering drift, proxy verification, misleading
evidence, and combined stress.

The honest read:

- strongest signal: construct-specific advantage on drift-under-noise;
- mixed signal: proxy/runtime mismatch did not show a clean advantage;
- ceiling effects: some stress/misleading-evidence cases were too easy to
  separate methods cleanly;
- limitation: single runs and single blind-grader setup are not production-grade
  proof.

This does not prove GREENLOOP is universally better than every structured
workflow. It proves the verification wedge is real enough to deserve sharper
product focus and real-world case studies.

### Installed-State Surface

The `test-with-greenloop` repo shows the workflow installed into a real local
project with:

- `.greenloop/state.json`;
- `.greenloop/memory.md`;
- `.greenloop/plan.md`;
- `.greenloop/worklog.md`;
- pretool and stop hooks;
- a reconstruction/analysis artifact of the workflow itself.

## What This Proves

GREENLOOP is not only a prompt or philosophy. It already has:

- a distributable installer;
- agent-specific bindings;
- state artifacts;
- enforcement hooks;
- a verification vocabulary;
- early comparative evidence;
- enough surface to be tested against real work.

## What It Does Not Prove Yet

GREENLOOP does not yet have:

- a polished public case study with a real user-visible failure;
- independent users or maintainers;
- statistically strong comparative evidence;
- a clean, trust-building domain beyond `workers.dev`;
- a simple proof page that a new reader can understand in 90 seconds.

## Next Proof Artifact

The next proof should be a real-world case study:

```text
Case Study: When "Done" Was Not Done
```

It should show:

1. original request;
2. agent's claimed completion;
3. verification harness or runtime mismatch;
4. what GREENLOOP recorded;
5. what failed;
6. what changed;
7. final GREEN/RED result.

## Public Claim To Use Now

GREENLOOP reduces AI-agent expansion into verified completion.

Spec tools plan. GREENLOOP proves done.

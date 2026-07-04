# Case Study 001 — The Drift That Wasn't

One small real task, run through GREENLOOP end to end, in this repo, on
2026-07-04. Everything below is reproducible from the artifacts in
[`case-study-001/`](case-study-001/) — the actual `.greenloop/` state files
from the run, copied verbatim.

**TL;DR:** GREENLOOP's assumption market stopped the agent from "fixing" 26 KB
of drift that did not exist — the drift-detector itself was the bug — and then
converted the invariant it had been probing from prose into a test that now
fails the suite on one byte of real drift.

## The task

[`DEPLOY.md`](DEPLOY.md) states an invariant: any edit to `workflow/` must be
mirrored into the payload constants embedded in `cli/greenloop-inject.ts`
(the injector is deliberately single-file). Nothing enforced this. The test
suite checked version *strings*, never payload *content*. One character of
unmirrored drift would ship silently to every agent that installs GREENLOOP.

Task: make the invariant executable. Four parity tests, one per embedded
payload, byte-comparing it against its `workflow/` source.

## What the workflow did — as it happened

**1. Baseline before choosing (Phase 1).** Ran the harness before touching
anything: 85/85 tests green in ~360 ms. Two candidate tasks were probed and
*falsified before adoption*: `SHA256SUMS` staleness (`sha256sum -c` → all OK)
and legacy `src/` cleanup (untracked, already documented as legacy). Both are
in `parked_branches` with reasons — parked, not evaporated.

**2. The load-bearing assumption failed its falsifier (Section R).** A recon
script compared the embedded payloads to `workflow/`. It reported **drift in
all four payloads** — ~26 KB of it. An ordinary agent loop acts here:
"fix the drift" by rewriting the embedded constants.

The assumption market blocked that. The claim "payloads have drifted" was
priced at confidence 0.6 with `impact_if_false: destroys_plan`, which forces
its falsifier to run *first*. The falsifier — re-extract with correct
template-literal handling — proved the payloads were **byte-identical**. The
drift was an artifact of the checker: it assumed the closing backtick sits on
its own line, ran past the constant boundary, and "diffed" against unrelated
source code. The tell (every reported diff line ended in a stray backtick),
the RCA, and the falsification are recorded in
[`state.json`](case-study-001/state.json) → `assumptions[1]`, `failures[0]`.

The checker bug also produced knowledge the fix needed: the existing test
helper `extractConst` has the same termination assumption, so the new tests
required their own extractor (`assumptions[2]`, `decisions[1]`).

**3. No edit until LOCK_IN (Section C).** Before the first file edit, a
finite done-when existed in `convergence.done_when`:

> Suite exits 0 with 89 tests passing (4 new parity tests), AND a deliberate
> 1-byte mutation of `workflow/GREENLOOP.md` makes the suite fail, AND
> restoring the file returns it to green with `git diff` clean.

Plus a scope fence: tests and docs only — no edits to the injector source,
`workflow/`, `install.sh`, or `SHA256SUMS`.

**4. Execute, then prove the harness can fail (Phases 8–9).** Section 11 was
appended to [`cli/greenloop-inject.test.ts`](../cli/greenloop-inject.test.ts):
an `extractPayload` helper (correct termination + unescaping) and four parity
tests. Suite: **89/89 green**. Then the mutation check — a test that cannot
fail proves nothing:

```
printf 'X' >> workflow/GREENLOOP.md   →  88 pass, 1 FAIL:
  GREENLOOP_CORE has drifted from workflow/GREENLOOP.md
  (embedded 45503 chars, on disk 45505 chars).
  First difference at line 808:  on disk: "X"
restore                               →  89 pass, 0 fail; workflow/ diff clean
```

One byte of real drift is now a red suite with a message naming the file, the
invariant, and the first differing line.

## Outcome

| | before | after |
|---|---|---|
| Mirror invariant | prose in DEPLOY.md | 4 executable parity tests |
| Test suite | 85 pass | 89 pass |
| Cost of 1 byte of drift | ships silently | suite fails, names the line |
| Files changed | — | `cli/greenloop-inject.test.ts` (+76 lines), docs |

## What ordinary agent work would not have done

1. **It would have "fixed" the phantom drift.** The naive checker's output
   looked exactly like actionable work: four files, concrete character counts.
   Without a falsifier gating a `destroys_plan` assumption, the plausible next
   step was rewriting four correct embedded payloads against a broken diff —
   corrupting the very files the task existed to protect.
2. **It would have claimed done at "tests pass".** The done-when required the
   new tests to be *shown falsifiable*. The mutation check is in the worklog
   with its failing output — green that has been proven able to be red.
3. **You would be taking its word for it.** Instead the run left evidence:
   [`state.json`](case-study-001/state.json) (goal, scope fence, assumption
   market with confidences and falsifiers, decisions with rejected
   alternatives, DoD with per-item evidence),
   [`plan.md`](case-study-001/plan.md), and the append-only
   [`worklog.md`](case-study-001/worklog.md) timeline.

## Reproduce it

```sh
node --experimental-strip-types --test cli/greenloop-inject.test.ts   # 89 pass
printf 'X' >> workflow/GREENLOOP.md                                   # inject drift
node --experimental-strip-types --test cli/greenloop-inject.test.ts   # 1 fail
git checkout -- workflow/GREENLOOP.md                                 # restore
```

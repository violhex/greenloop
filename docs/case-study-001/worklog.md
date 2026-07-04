# Worklog — Case Study 001 (append-only)

[2026-07-04T00:33Z] ACTION: ran baseline verification harness
WHY: Phase 1 environment audit — establish GREEN reference before choosing a task
RESULT: node --experimental-strip-types --test cli/greenloop-inject.test.ts → 85/85 pass, 362ms
EVIDENCE: "ℹ tests 85 / ℹ pass 85 / ℹ fail 0"

[2026-07-04T00:34Z] ACTION: verified SHA256SUMS integrity (candidate task probe)
WHY: recently-edited README/index.html suggested the manifest might be stale
RESULT: sha256sum -c SHA256SUMS → all 6 files OK. Candidate falsified, parked.
EVIDENCE: "workflow/GREENLOOP.md: OK ... cli/greenloop-mcp.ts: OK"

[2026-07-04T00:36Z] ACTION: checked src/ vs workflow/ divergence (candidate task probe)
WHY: diff -rq showed all 4 files differ
RESULT: src/ is untracked (git ls-files empty) and .assetsignore labels it "legacy
root-level copies". Housekeeping, not proof material. Parked.
EVIDENCE: .assetsignore lines "# legacy root-level copies ... /src"

[2026-07-04T00:38Z] ACTION: audited test coverage of the DEPLOY.md mirror invariant
WHY: DEPLOY.md L102-103 requires mirroring workflow/ edits into embedded payloads
RESULT: suite sections 9–10 only regex-match version strings; NO content parity check
exists. Target named: unenforced mirror invariant. → CONTACT
EVIDENCE: grep 'workflow/' cli/greenloop-inject.test.ts → readFileSync + assert.match(version) only

[2026-07-04T00:40Z] ACTION: ran naive drift check (/tmp/drift-check.mjs, extractor copied
from test-file extractConst)
WHY: R1 — assumption "payloads have drifted" needs evidence before it drives the plan
RESULT: reported DRIFT on all 4 constants (GREENLOOP_CORE embedded 72099 vs disk 45503)
EVIDENCE: every reported first-diff line ended in a stray backtick — checker-bug signal

[2026-07-04T00:42Z] ACTION: ran the falsifier on the drift assumption — fixed extractor
(terminate at unescaped trailing backtick, unescape \` \${ \\), re-ran
WHY: cheapest test that could prove the drift reading wrong (impact_if_false: destroys_plan)
RESULT: OK on all 4 pairs — NO drift. Assumption falsified; the bug was in the checker.
RCA in state.failures[0]. Without this gate, next step would have been "fixing" ~26KB
of phantom drift by rewriting the embedded constants.
EVIDENCE: "OK GREENLOOP_CORE == workflow/GREENLOOP.md (45503 chars)" ×4

[2026-07-04T00:48Z] ACTION: LOCK_IN — wrote done_when, initialized .greenloop/ state
WHY: C-machine — no edit permitted from ORBITING; done_when is now falsifiable
RESULT: task = parity tests; scope fence recorded; S1–S3 planned
EVIDENCE: state.json convergence.done_when

[2026-07-04T00:51Z] ACTION: edited cli/greenloop-inject.test.ts — appended section 11 (S1)
WHY: implement extractPayload + 4 parity tests per plan S1
RESULT: suite → 89 tests, 89 pass, 0 fail (baseline 85)
EVIDENCE: "▶ embedded payload parity with workflow/ ... ✔ ×4 ... ℹ pass 89"

[2026-07-04T00:51Z] ACTION: mutation check — printf 'X' >> workflow/GREENLOOP.md (S2)
WHY: a verification harness that cannot fail proves nothing; done_when requires the
test to catch a 1-byte drift
RESULT: 88 pass, 1 FAIL — exactly the GREENLOOP_CORE parity test
EVIDENCE: "GREENLOOP_CORE has drifted from workflow/GREENLOOP.md (embedded 45503
chars, on disk 45505 chars) ... First difference at line 808: on disk \"X\""

[2026-07-04T00:52Z] ACTION: restored workflow/GREENLOOP.md from backup (S2)
WHY: mutation was diagnostic only; scope fence forbids workflow/ changes
RESULT: git diff/status on workflow/ empty; suite → 89 pass, 0 fail. GREEN.
EVIDENCE: "ℹ tests 89 / ℹ pass 89 / ℹ fail 0" at 2026-07-04T00:52Z

[2026-07-04T00:58Z] ACTION: REPORT — wrote docs/CASE-STUDY-001.md, snapshotted
.greenloop/{state.json,plan.md,worklog.md} → docs/case-study-001/, linked from
README.md (intro + layout tree) and index.html (Get the files section) (S3)
WHY: .greenloop/ is gitignored by design; the public proof needs the artifacts
in-tree. Links limited to references per scope fence.
RESULT: D1–D4 all pass; final suite re-run green after doc/site edits
EVIDENCE: state.json dod[]; verification block

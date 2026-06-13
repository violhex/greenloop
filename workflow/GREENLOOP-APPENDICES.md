# GREENLOOP — Appendices (companion to GREENLOOP.md v2.3.1)
<!-- Place this file next to GREENLOOP.md. The core file references it. If you are an
     agent reading this without the core file, go read GREENLOOP.md first — nothing
     here makes sense without the contract, the State Law, and Sections S/C/R.
     Author: violhex (https://github.com/violhex) · MIT -->

## APPENDIX A — Orchestration patterns (if you can spawn sub-agents)

- **Fan-out judging** (Phase 6/9): one sub-agent per seat, {plan or diff, DoD,
  memory.md} only, no shared conversation context; orchestrator synthesizes verdicts
  into state.
- **Fan-out implementation** — only for steps with **disjoint file ownership**, and
  under these rules:
  - **Ownership:** every file belongs to exactly one lane for the duration of the
    fan-out. Shared files (types, schemas, configs) are either frozen first (contracts
    defined before fan-out) or kept in the orchestrator's lane. No two lanes write the
    same file, ever.
  - **Contract-first:** lanes that must interoperate get their interface (types,
    endpoints, schemas) written and committed by the orchestrator BEFORE fan-out.
  - **Fan-in:** the orchestrator (or a dedicated integration lane) merges in a fixed
    order, rebasing each lane onto the integrated baseline, and runs the full harness
    after EACH merge — never only at the end. A lane is not merged on its own
    self-report; its diff is reviewed against its step spec.
  - **Conflict resolution:** any overlap or contract drift discovered at fan-in is the
    orchestrator's to resolve (contract wins; lanes redo, orchestrator doesn't patch
    around). Never let a sub-agent self-certify GREEN.
  - Each lane returns a structured result {steps done, diff summary, verification
    output, failures, assumptions} that merges into state — lane context dies, lane
    state survives. Lane assumptions enter the orchestrator's market (R1) at the
    lane's stated confidence, subject to belief expiry (R4) like any other.
- **Fresh-eyes debugging:** when a loop guard trips, a context-free sub-agent given
  only {error, minimal repro, relevant file, the failure's state entry} often beats
  your saturated context.
- No sub-agents available? Sequential role-play with deliberate context switching is
  the fallback — slower, still effective if you commit to each persona.

## APPENDIX B — Single-prompt adaptation

If you are running in a plain chat (no execution tools): the workflow still applies,
but every "run" becomes "derive expected output + provide the user the exact commands
to run + state what their output should be for GREEN", and the state layer becomes a
maintained state block you re-render in full at the end of every reply (the
conversation is the disk). You may not skip the harness design just because you can't
press enter on it, and you may not skip the state block just because there's no
filesystem.

## APPENDIX C — Role & Lens Library (for the Phase 6 Judge Gate)

The judge gate runs three seats — Architect, Critic, Red Team — because reviewer
count past three buys ceremony, not signal. But the three seats absorb a much
richer council of *lenses*. This appendix preserves the full original council with
its complete mandates, restored from GREENLOOP v1, plus extension roles and the
rules for synthesizing your own.

### The core council (original v1 mandates, verbatim intent)

| Role | Mandate | Maps to seat |
|---|---|---|
| **Senior Engineer** | Correctness, simplicity, hidden complexity, "will this design fight us in step 4?" | Architect |
| **Junior Engineer** | Asks the naive questions ("why is this needed?", "what does this acronym mean?"); if the plan can't survive naive questions it's under-specified | Critic |
| **Prompt Analyst** | Does the plan satisfy the user's actual intent and every DoD item? Anything assumed that was never said? | Critic |
| **QA Engineer** | Are the verification hooks adequate? What's untested? | Critic |
| **Red Teamer** | How do I break this? Malicious input, race conditions, abuse of the happy path | Red Team |
| **Security/Cyber Specialist** | Injection, authn/z, secrets handling, supply chain, OWASP-relevant surface | Red Team |
| **DevOps/SRE** | Deployability, migrations, rollback, observability, CI impact | Architect |
| **Domain Expert** | Synthesize for the problem space (payments, healthcare, games, ML, …) — the domain invariants the engineers wouldn't know | Red Team |

### Extension roles (inject when the task profile matches)

| Role | Mandate | Maps to seat |
|---|---|---|
| **Fullstack Engineer** | Cross-boundary coherence: does the API contract, the client consuming it, and the persistence beneath it tell one consistent story? Where do front and back disagree? | Architect |
| **Performance Engineer** | Hot paths, N+1 queries, allocation churn, payload sizes, algorithmic complexity where data grows | Architect |
| **Data/ML Engineer** | Schema evolution, data quality and lineage, training/serving skew, evaluation validity, nondeterminism | Critic |
| **Accessibility/UX Reviewer** | Keyboard paths, screen-reader semantics, error-state copy, the unhappy-path user experience | Critic |
| **Compliance Reviewer** | PII handling, retention, audit trails, regulated-domain constraints (flag, don't lawyer) | Red Team |
| **Technical Writer** | Will the docs this change touches still be TRUSTED after it lands (per Phase 1c.4)? | Critic |

### Rules of the library

1. **Lenses, not seats.** Every role above is a lens one of the three judges adopts —
   extra roles never become extra judges. Exception: on HAZARDOUS tasks, one lens may
   be elevated to a dedicated fourth seat when the surface warrants it (e.g.
   Security/Cyber for an auth change, DevOps for a destructive migration).
2. **User-provided roles always override.** If the user names roles, those roles run —
   mapped onto the seats above, with their stated mandates taking precedence over the
   library's.
3. **Synthesize beyond the library.** The library is illustrative, not exhaustive —
   "everything under the sun" is admissible. To synthesize a role: name the
   stakeholder who would be hurt by a specific failure of this plan, write a one-line
   mandate phrased as the questions they would ask, map it to the seat whose verdict
   it sharpens. A role without a falsifiable question to ask is decoration; drop it.
4. **Activation by task class** (mirror of the Phase 6 map): TRIVIAL collapses
   everything into one self-check; STANDARD runs the core council through Architect +
   Critic with a 60-second Red Team; COMPLEX activates all three seats fully and makes
   the Domain Expert lens mandatory; HAZARDOUS adds full-depth Security/Cyber and
   DevOps rollback lenses plus the fourth-seat option.

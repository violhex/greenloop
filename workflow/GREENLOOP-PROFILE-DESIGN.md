# GREENLOOP — Domain Profile: DESIGN (companion to GREENLOOP.md v2.3.0)
<!-- A domain profile maps the generic GREENLOOP phases onto a specific kind of
     work — it adds domain organs to the same skeleton. The core file always wins
     on conflict. This profile activates when the task is visual: building or
     restyling a site/app UI, recreating the feel of a reference (Framer-class
     sites, brand systems), motion work, design systems. Field-proven in a bare
     chat with no tools: paste GREENLOOP.md + this file + your idea.
     Author: violhex (https://github.com/violhex) · MIT -->

## P0. THE PROFILE'S ONE RULE (the Vision Lock)

A rendered website is the lowest-resolution representation of a chain:

```
Vision → Aesthetic Principles → Design Language → Motion Language
       → Component Rules → Implementation → Rendered Pixels
```

Most agents start at the bottom — they copy pixels. This profile forbids it:

> **No component code may be generated until you can explicitly describe the
> visual, motion, interaction, and emotional systems that code is intended to
> express.** This is "no execution from ORBITING" (Section C) in its design form:
> the Design Constitution (P3) is the DONE WHEN for starting implementation.

You are not recreating a website. You are recovering the **set of constraints
that caused the website to emerge**, then generating from those constraints —
which is why style changes that "equally match" become possible: you change a
constraint, and everything downstream re-derives.

## P1. Phase 1c remapped — artifacts of design intent

Documentation habitats for design work: reference sites/URLs, brand guides,
Figma/design files, screenshots at multiple breakpoints, screen recordings,
existing CSS custom properties, marketing copy. Trust labels still apply:

- A **reference site** is delivered reality — TRUSTED for *what the system does*.
- A **brand guide** is intent — may be INTENT-ONLY (describing a system never built).
- Existing CSS variables are the closest thing to the original tokens — read them
  before inferring your own.

## P2. Phase 3 remapped — the Five-Level Extraction

Retrieval for design is not file search; it is system inference from artifacts,
in five narrowing levels. Each level is sanctioned orbiting with a budget;
each ends in a LOCK_IN artifact.

**L1 — Visual extraction (tokens, not pixels).** From screenshots at desktop,
tablet, and mobile, infer the *scales*: typography scale, spacing scale, radius
scale, shadow scale, color system. Never record raw values as findings —
`24px, 42px, 83px` is noise; `base unit 8px, scale 8/16/24/32/48/64/96` is a
token system. If measurements don't reduce to a scale, that itself is a finding
(the reference may not have a system — say so).

**L2 — Component extraction (consistency is evidence).** Collect every component
class: buttons, cards, navs, heroes, forms, pricing, footers. Ask: *what rules
are shared?* "All buttons: 12px radius, medium weight, icon right, 200ms hover"
is a rule. Shared rules are evidence of a design system; one-offs are evidence
of its boundaries.

**L3 — Motion extraction (record it, slow it down).** Capture hover, scroll
reveal, page transition, loading, cursor behavior — devtools, screen recording,
frame-stepping. Extract what *repeats*: durations, easings, directions, stagger
intervals. The output is a motion language, stated as rules with numbers:

```
Hover:   scale 1.00 → 1.03 · 180ms · spring(damping 18)
Reveal:  y 24px → 0 · opacity 0 → 1 · 600ms · stagger 80ms
Page:    700ms · cubic-bezier(…)
```

`transition: all 0.2s ease` is not a motion language; it is the absence of one.

**L4 — Emotional extraction (what the system serves).** Name the feeling in 3–5
words (precision/focus/speed; calm/elegance/clarity; fluidity/momentum). Every
ambiguous decision later resolves against these words — they are the profile's
`user_request`-adjacent intent layer.

**L5 — Contradiction extraction (the hidden layer).** Ask: **what choices were
NOT made?** No bright colors. No sharp corners. Nothing rotates. Nothing bounces.
No dense layouts. Absences are constraints, and constraints carry more of the
original vision than anything visible. Record them as prohibitions — they are
what the Red Team will enforce.

## P3. Phase 4 remapped — the Design Constitution

The domain model of a design task is a **constitution**: the working-set
artifacts every later phase consumes (the design form of `memory.md`):

```
.greenloop/
  design/
    tokens.json        # L1 output — scales, palette, radii, shadows, surfaces
    motion-spec.md     # L3 output — hover/reveal/scroll/page/micro, with numbers
    component-spec.md  # L2 output — per-class rules referencing tokens
    brand-spec.md      # L4 + L5 — emotional words + the prohibition list
```

Constitution discipline:

- Every component spec references tokens by name, never by raw value.
- Every motion references the motion spec, never inline ad-hoc timing.
- The prohibition list (L5) is part of the constitution — violating an absence
  is as RED as violating a rule.
- Restyle requests are handled at this layer: change the constitution, re-derive
  components. Never patch pixels against the constitution's grain.

## P4. Phases 5–6 remapped — planning and judging under the constitution

**Plan:** each step names the components it builds and the constitution sections
it expresses; its verification hook is "validates against constitution" made
concrete (which tokens, which motion rules, which prohibitions).

**Judge lenses gained (Appendix C library applies):**

- **Architect** + *Layout System lens*: grid, breakpoints, container widths,
  alignment rules — does the structure encode the same system as the tokens?
- **Critic** + *Brand Fidelity lens*: does each component evoke the L4 words?
  The naive question becomes "why does this move?" — motion without a reason in
  the motion spec fails review.
- **Red Team** + *Motion Language auditor*: hunt `transition: all`, off-scale
  values, off-palette hexes, easing curves that appear nowhere in the spec —
  generic motion is a violation, not a default. Plus *accessibility hostility*:
  keyboard paths, contrast ≥ 4.5:1 body / 3:1 large, `prefers-reduced-motion`
  honored, focus visible. An inaccessible site cannot be GREEN.

## P5. Phases 7–9 remapped — what GREEN means for design

The harness, in order of value (degrade gracefully to what your environment has):

1. **Token linter** — grep/scan generated code for raw px values off-scale and
   raw hexes off-palette; zero findings is a DoD item.
2. **Motion conformance** — every transition/animation traces to a motion-spec
   rule (a comment reference or a shared constant; ad-hoc timings fail).
3. **Breakpoint render** — the page renders at the constitution's breakpoints
   without overflow or collapse (screenshot or manual walk).
4. **Accessibility checks** — contrast, keyboard, reduced-motion (axe/Lighthouse
   where available; the checklist where not).
5. **Constitution walk** — with no tools at all, the minimum harness is walking
   every component against component-spec.md and the prohibition list, recording
   each check in the worklog. The State Law does not care that the artifact is
   visual.

**Design DoD examples (Phase 2, falsifiable):**

```
[ ] D1: tokens.json exists; all spacing/type/color in components reference it
[ ] D2: zero `transition: all` and zero off-spec timings (token linter clean)
[ ] D3: renders at 360/768/1280 without horizontal overflow
[ ] D4: contrast ≥ 4.5:1 body, 3:1 large; reduced-motion media query present
[ ] D5: zero violations of the L5 prohibition list
```

**Phase 9 adversarial addition:** re-run L5 against your own output — *did the
implementation introduce anything the constitution forbids?* The most common
design regression is a contradiction violation, because nothing visible breaks.

## P6. Single-prompt mode (the field test)

This profile needs no tools. In a bare chat (ChatGPT, Claude.ai, anywhere):
paste GREENLOOP.md, paste this profile, paste/describe your reference and idea.
The agent must still produce the extraction levels, the constitution, and the
plan *as text* before any code — and the constitution it writes becomes the
spec you carry to whichever agent builds it. The chain it returns —

```
Artifact → Structure → Rules → Constraints → Intent
```

— is the deliverable. Code is just the last and least of it.

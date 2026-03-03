# SlipUp Observatory - Agent Context V5

This file is the operational source of truth for any new agent.
Use it before proposing or editing code.

## Project Identity

- SlipUp Observatory is not an error tracker.
- It is a human atmospheric instrument.
- It models emergent phenomena from individual moments.
- The system observes; it does not correct people.

## Ontology (Core Meaning)

- **Moment**: minimum unit (not "error").
- **Degree**: structural condensation level in active window (48h).
- **Pattern**: emergent structural repetition, never an alert.
- **Horizon**: personal decantation layer (directional, not a dashboard).

## Non-Negotiables

- No new dependencies.
- Do not touch `schema_v2.sql` unless explicitly requested.
- Keep sacred strings exact:
  - `type`: `avoidable | fertile | observed`
  - `mood`: `calm | focus | stressed | curious | tired`
- `note` max length: 19.
- Preserve contribute loop:
  - `contribute.html -> index.html?contributed=1 -> micro-shift -> settling`

## Current Architecture

- Hero stays sky-only (above fold):
  - `SlipUp Observatory`
  - `Atmosphere - Current`
  - degree
  - primary condition line
  - secondary pattern line (only when pattern exists)
  - CTA `Contribute a moment`
- Below fold:
  - `A shared sky` preview (10)
  - bottom sheet (up to 50)
  - `Horizon`

## Physics Contract

- `computeDegree` behavior must remain deterministic for same dataset and same reference time.
- Strict separation:
  - `computedDegree` = model truth
  - `displayDegree` = visual animation only
- `?contributed=1` can animate only; it must not mutate model data.
- Clamp stays 0..100.
- Warm-up is required for low sample sizes.

## Structural Pattern Contract

Pattern detection exists and is subtle:

- `pattern_a`: avoidable + stressed >= 2
- `pattern_b`: avoidable with same mood >= 3
- `pattern_c`: cluster >= 3 in 3h with avoidable dominance

Pattern effects are intentionally small:

- small degree nudge (capped)
- slight settling extension
- secondary line visible
- subtle sky density increase

Never make pattern dominant, red, alarming, or dashboard-like.

## Language and Tone

Allowed tone:

- observational
- probabilistic
- calm
- non-moral

Avoid:

- alert/warning framing
- prescriptive language (`you should`, `improve`, `optimize`, `reduce`)
- clinical labels

## Accessibility and UX

- Bottom sheet keeps:
  - `role="dialog"`
  - `aria-modal`
  - focus trap
  - Escape/backdrop close
  - focus restore
- Respect `prefers-reduced-motion` across CSS and JS transitions.
- No infinite feed behavior.

## Critical Failure Modes (Must Avoid)

1. Treating degree as personal score.
2. Turning pattern into an alert UI.
3. Mixing computed and display degrees.
4. Moralizing sacred variables.
5. Over-expanding metaphor into complexity that hurts clarity.

## A1 Scale Contract (Millions Without Losing Essence)

- Keep physics module pure and versioned.
- Increase model version on physics changes.
- Never silently recalculate historical meaning.
- Prefer append-only event model and bucketed aggregation when backend scales.
- Keep social evidence constrained (preview + sheet, no ranking/trending/reactions).
- Add guardrail tests when touching physics/copy/pattern:
  - determinism
  - no-drift reload
  - computed/display separation
  - copy blacklist
  - pattern subtlety caps

## A2 AI Telescope Contract (Optional, Post-Physics)

- AI layer is read-only and post-physics.
- Pipeline:
  1) filter 48h dataset
  2) compute deterministic physics
  3) render base UI
  4) optionally generate observational AI text
- AI output is ephemeral, never writes into physical model keys.
- AI must not change degree, tags, or sacred fields.
- AI must remain neutral and brief.

Rule:

- Physics leads.
- AI observes.
- UI reveals.

## Delivery Checklist (Every Change)

- [ ] hero still sky-only
- [ ] sacred strings unchanged
- [ ] note max 19 preserved
- [ ] contribute loop intact
- [ ] pattern remains subtle
- [ ] computed/display separation preserved
- [ ] deterministic behavior preserved
- [ ] reduced-motion respected
- [ ] no new dependencies
- [ ] `schema_v2.sql` untouched

# Strata at scale — design law

**Strata should become quieter as the system becomes richer.**

When SlipUp has **thousands of moments**, Strata must be **slower, fewer, and heavier**. Not richer in UI, not more analytic, not more social.

---

## Three phases by moment count (30-day window)

### 1. Before 100 moments — tentative ("young soil")

Strata is still listening. Language is tentative:

- *A pattern may be forming.*
- *Observed calm appears after stress.*
- *Some tension gathers late.*

The system is "listening", not yet stating recurrence.

### 2. 100–299 moments — recurrence

Recurrence appears. Language becomes more confident:

- *Observed calm often follows stress.*
- *Avoidable tension returns late.*
- *Fertile moments appear after fatigue.*

Shift: from *may appear* to *often follows*. The earth starts to compact.

### 3. 300+ moments — structural (personal geology)

Strata becomes structural. It no longer speaks of episodes but of **repeating shapes of behaviour**:

- *Observed calm returns after stress.*
- *Avoidable tension gathers late in the day.*
- *Fertile openings follow fatigue.*

No longer "perhaps". This is **sedimented recurrence**. Horizon = meteorology; Strata = geology.

---

## 1. Less reactive

- With few moments, Strata can feel tentative.
- With thousands, it should feel like **sediment**: changes rarely, does not respond to daily noise, reflects only what persists.
- Strata should **not** update every session. Ideal: **slow cadence** (daily, every few days, or only when a structural threshold is crossed).
- That slowness is what makes it feel like earth.

---

## 2. Fewer lines, not more

- At scale, show **2 lines**, sometimes **3**, rarely **4**. Never a long list or report.
- **The more data underneath, the less shown on top.**

---

## 3. More structural, less descriptive

- Low volume: tentative reading (*"A pattern is beginning to settle."*, *"Observed calm appears after stress."*).
- At scale: **settled recurrence** (*"Observed calm returns after stress."*, *"Avoidable tension repeats in late hours."*, *"Fertile openings often follow fatigue."*).
- Use: **returns, repeats, follows, gathers, appears, settles**. Avoid: increasing, score, improving, trend, analysis.

---

## 4. No visible metrics

- No percentages, scores, density, trend arrows, counts, or "high / medium / low" in the visible Strata layer.
- Those belong only in internal tooling, debug, or the hidden instrument panel.
- Strata must remain **geological, not analytical**.

---

## 5. Longer window, slower memory

- Atmosphere = 48h. Strata = **longer window** (e.g. 30, 45, 60 days).
- Built from **persisting structure across time**, not raw recent events alone.
- Strata answers: **What keeps returning?** — not *What happened recently?*

---

## Visual evolution at scale

- Quieter, more spacious, less widget-like, almost text-only.
- Bigger vertical breathing room, fewer separators, lower contrast.
- No metric chips, no explanatory helper text. **Almost like inscriptions.**
- When descending into Strata, background can become **slightly darker or warmer** to feel like going underground.

---

## What Strata must never become

- A report, trends dashboard, timeline, history feed, or "insights center."
- Strata is not there to summarize usage. It is there to reveal **slow structure**.

---

## Mental model

- **Atmosphere** = air now  
- **Nearby** = local human field  
- **Horizon** = what begins to form  
- **Strata** = what has settled  

Strata is the first place where the system no longer feels reactive. It feels **old enough to remember**.

---

## Scroll and layers

- Each Strata line is a **sedimented layer**, not an event.
- Transition from Horizon to Strata should feel like leaving air and entering **earth**: less contrast, more vertical space, calmer type.
- Strata should not animate (or only a very slow fade). It should feel **heavy**.

---

## Implementation notes

- **Thresholds:** tentative &lt; 100, recurrence 100–299, structural 300+ (30-day window).
- **STRATA_MAX_LINES:** 3 for all phases. At scale the panel shows fewer lines by virtue of stricter triggers, not by increasing the cap.
- **Update cadence:** prefer caching strata output by day (or every N days) so it does not recompute every session.
- **Separators:** optional very subtle horizontal rules or spacing between lines to suggest layers.
- **Never show:** percentages, counters, scores, stats, comparisons — even with thousands of moments. The user never sees the calculation, only the sediment.

**Golden rule:** More data → less UI, more weight, more silence. Strata becomes **simpler the more it learns**.

See also: `OBSERVATORY_FLOW_AND_LAYERS.md`, `SLIPUP_MASTER_CONTEXT.md`.

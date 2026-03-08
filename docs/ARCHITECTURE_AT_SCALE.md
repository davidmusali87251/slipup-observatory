# SlipUp at scale: architecture target

**Principle:** Event log below, atmosphere above.  
**Rule:** Writes cheap, reads aggregated, climate deterministic, UI silent.

---

## 1. Layered view

```
Client (web app)
  ↓
Edge API / Functions
  ↓
Append-only moments store
  ↓
Aggregation layer (5m today → hourly path ready)
  ↓
Climate service (computeClimate)
  ↓
Read APIs (climate / shared-preview / shared-sheet / nearby / horizon / strata)
  ↓
Cache layer (HTTP Cache-Control)
  ↓
Client render
```

---

## 2. Read API mapping (current)

| Logical read        | Current implementation                    | Cache (s) |
|--------------------|--------------------------------------------|-----------|
| `GET /climate`     | `GET /functions/v1/climate`                | 30        |
| `GET /shared-preview` | `GET /moments?scope=shared&limit=10&windowHours=48` | 20   |
| `GET /shared-sheet`   | `GET /moments?scope=shared&limit=50&windowHours=48` | 20   |
| `GET /nearby`      | Same shared list + `GET /climate?scope=local&geo=...` for field climate | by geo |
| `GET /horizon`     | **Read model** — derived client-side from local moments; no dedicated endpoint yet | — |
| `GET /strata`      | **Read model** — future batch output; no endpoint yet (seed only) | — |

Future: optional path aliases (e.g. `/shared-preview`) that proxy to the same `moments` handler with fixed params.

---

## 3. Climate: single source of truth

- **Server** computes `computedDegree` via `computeClimate()` (or from buckets). Same aggregated input + same `referenceTime` + same `modelVersion` ⇒ same output.
- **Client** never treats local `calculateClimate()` as global truth when remote is available. On remote failure only, client uses local fallback.
- **Client** only animates `displayDegree` toward server `computedDegree`; it does not mix or recompute truth.

---

## 4. Ingest: append-only moments

- Table: `moments` (or project-specific). No deletes; moderation via `hidden=true`.
- Write path: `POST /moments` → validation → `consume_climate_bucket` (and optional geo bucket).
- Sacred contract: `type` ∈ { avoidable | fertile | observed }, `mood` ∈ { calm | focus | stressed | curious | tired }, `note` max length 19.

---

## 5. Aggregation: buckets

- **Today:** `climate_5m_bucket` + `combo_5m_bucket` / `marker_5m_bucket`. Climate function can read from 5m buckets when `CLIMATE_USE_BUCKETS=true`.
- **Hourly path (ready):** `climate_buckets_hourly` — same shape as 5m but `bucket_start` truncated to hour. For 48h window, climate reads **48 rows** instead of 576. Job contract: aggregate from 5m (or raw) into hourly; see migration and comments in `supabase/migrations/`.

---

## 6. Nearby: coarse field only

- Uses **geo_bucket** (e.g. timezone-derived `tz.america.argentina.buenos-aires`). Coarse candidates for fallback (e.g. drop city → country).
- No exact pin, no invasive geolocation. Future-safe: `region_bucket` can alias same concept if needed.

---

## 7. Horizon and Strata: read models

- **Horizon:** Derived reading from local/user events over a window. Not a feed; output: state, drift, dominant, pulse. Today implemented client-side; future: optional server-derived endpoint.
- **Strata:** Slow sediment (batch over 30d/60d/90d). Precomputed, cached long. No live heavy query. Seed/placeholder only until batch job exists.

---

## 8. Telescope AI (future)

- Consumes **snapshot** (computedDegree, repetition, dominant, drift, strata, aggregates).
- Does **not** compute degree, change physical state, or prescribe.
- **Physics leads. AI observes. UI reveals.**

---

## 9. Caching

- `/climate`: `Cache-Control: public, max-age=30`.
- `/moments` (shared-preview / shared-sheet): `Cache-Control: public, max-age=20`.
- Client-side GET cache TTL 45s to reduce duplicate requests; remote failure still triggers local fallback.

---

## 10. Security and abuse

- Rate limit by IP + fingerprint hash.
- Validate enums and `note` server-side.
- No direct client DB writes; all via Edge.
- `hidden=true` for moderation; no raw IP persistence for product data.

---

## 11. Deployment phases

| Phase | Focus |
|-------|--------|
| 1     | Static front, edge moments, remote climate, shared preview |
| 2     | Buckets (5m → hourly), cache, nearby by coarse geo |
| 3     | Horizon derived server-side (optional), Strata batch |
| 4     | Telescope AI read-only layer |

---

## 12. Design reminder

At scale, the system should feel: heavier, calmer, less reactive, more physical.  
The user looks at **weather made from moments**, not analytics.

---

## 13. Phase implementation summary (Architecture Phase)

### Files changed / added

| File | Change |
|------|--------|
| `docs/ARCHITECTURE_AT_SCALE.md` | New: layered architecture, endpoint mapping, read models, caching, phases. |
| `supabase/migrations/20260307000000_climate_buckets_hourly.sql` | New: hourly aggregation table + job contract comment. |
| `supabase/functions/climate/index.ts` | Mass inertia in `computeFromBuckets`; `MASS_INERTIA_REF` import; cache comment. |
| `app.js` | Comment: server is canonical truth for `computedDegree` when remote available. |

### What was added/refined

- **Climate truth:** Server remains single source; client comment makes canonical-truth rule explicit.
- **Aggregation:** Hourly table and contract for job to fill from 5m (or raw); climate can later read 48 rows for 48h.
- **Mass inertia:** Applied in bucket path as well as raw-moments path so scale behavior is consistent.
- **Caching:** Documented; climate 30s, moments 20s; comment for scale rationale.
- **Read models:** Horizon, Strata, Nearby, Telescope AI documented as read/observational layers.

### What remains fallback-compatible

- Remote failure still uses local `calculateClimate()` and local moments; no change to fallback flow.
- `schema_v2.sql` untouched.
- Sacred strings, note length, contribute loop, and hero UX unchanged.

### What is now ready for future scale

- Hourly aggregation path: run job to fill `climate_buckets_hourly`; add `CLIMATE_USE_HOURLY` and read path when ready.
- Cache and rate limits already in place; doc clarifies roles.
- Nearby (geo_bucket), Horizon, Strata, Telescope AI have clear place in the doc for next phases.

### Checklist

- [x] Hero still sky-only
- [x] No dashboard/feed behavior introduced
- [x] Sacred strings untouched
- [x] Note max length still 19
- [x] Contribute loop intact
- [x] computedDegree remains separate from displayDegree
- [x] Server is truth source for climate
- [x] Remote failure still falls back safely
- [x] No direct client DB writes
- [x] No new dependencies
- [x] schema_v2.sql untouched

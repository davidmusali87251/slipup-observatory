# SlipUp Observatory V2

Clean rebuild aligned with the Observatory model.

## Included in this baseline

- `Observatory` landing as primary atmospheric view.
- `Contribute a moment` on a separate page.
- Layered reading model:
  - `Horizon Line` (shared/global transition)
  - `Nearby Field` (regional reading with fallback)
  - `Deep Record` (long-window sediment)
- Climate response loop with:
  - immediate micro-shift (<1 second)
  - inertial settling (3-8 seconds)
- Offline-first local persistence for moments (`localStorage`).
- Supabase-backed shared flow (`moments` + `climate` edge functions).

## Local run

Open `index.html` in a browser.

## Product loop

`Observatory -> Contribute -> micro shift -> settling -> observe -> Horizon Line`

## Notes

- This baseline intentionally avoids V1 carryover.
- No ranking, gamification, alerts, or moral language.

## Edge Setup (Supabase)

This repo includes a production-early backend path that keeps privacy risk low and blocks spam early.

- SQL schema base: `schema_v2.sql`
- SQL local bucket patch: `supabase/sql/phase2_local_geo_bucket.sql`
- Edge Functions:
  - `supabase/functions/moments/index.ts`
  - `supabase/functions/climate/index.ts`

### Function secrets (recommended)

Set these in Supabase Functions secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS` (example: `https://slipup.io,https://www.slipup.io`)
- `RATE_LIMIT_SALT`
- `MOMENTS_WINDOW_SECONDS` (default `60`)
- `MOMENTS_POST_MAX` (default `20`)
- `MOMENTS_GET_MAX` (default `240`)
- `CLIMATE_GET_WINDOW_SECONDS` (default `60`)
- `CLIMATE_GET_MAX` (default `180`)
- `LOCAL_MIN_MASS` (default `30`)

### Frontend activation

In `remote.js`:

- set `USE_REMOTE_SHARED = true`
- set `REMOTE_MOMENTS_URL` to `https://<project-ref>.supabase.co/functions/v1/moments`
- set `REMOTE_CLIMATE_URL` to `https://<project-ref>.supabase.co/functions/v1/climate`
- set `REMOTE_ANON_KEY` to your public anon key

Frontend keeps local fallback enabled by default:

- `201` -> `Moment stored.`
- `422` -> `Saved locally. Shared sync couldn't accept this moment.`
- `429` -> `Saved locally. Shared channel is temporarily busy.`
- timeout / `5xx` -> `Saved locally. Shared sync is unavailable.`

## Metaphor guardrails

- Treat climate as a shared reading of moments, not literal weather.
- Keep language non-judgmental (`condense / clear / stabilize`).
- Avoid ranking, gamification, alerts, and moral framing.

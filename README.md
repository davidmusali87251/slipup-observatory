# SlipUp Observatory V2

Clean rebuild aligned with the Observatory model.

## Agent Handoff Context

Before editing code, read:

- `AGENT_CONTEXT_V5.md`

This is the active continuity contract for architecture, physics, tone, and safety checks.

## Included in this baseline

- `Observatory` landing as primary atmospheric view.
- `Contribute a moment` on a separate page.
- `Horizon` as personal depth layer with 3 states.
- Climate response loop with:
  - immediate micro-shift (<1 second)
  - inertial settling (3-8 seconds)
- Offline-first local persistence for moments (`localStorage`).
- New SQL schema proposal for Supabase (`schema_v2.sql`).

## Local run

Open `index.html` in a browser.

## Product loop

`Observatory -> Contribute -> micro shift -> settling -> observe -> Horizon optional`

## Notes

- This baseline intentionally avoids V1 carryover.
- No ranking, gamification, alerts, or moral language.

## Phase 1 Edge Setup (Supabase)

This repo includes a production-early backend path that keeps privacy risk low and blocks spam early.

- SQL hardening pack: `supabase/sql/phase1_edge_hardening.sql`
- Edge Function: `supabase/functions/moments/index.ts`

### Function secrets

Set these in Supabase Functions secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS` (example: `https://slipup.io,https://www.slipup.io`)
- `RATE_WINDOW_SECONDS` (default `60`)
- `POST_PER_WINDOW` (default `10`)
- `GET_PER_WINDOW` (default `120`)

### Frontend activation

In `remote.js`:

- set `USE_REMOTE_SHARED = true`
- set `REMOTE_MOMENTS_URL` to `https://<project-ref>.supabase.co/functions/v1/moments`
- set `REMOTE_ANON_KEY` to your public anon key

Frontend keeps local fallback enabled by default:

- `201` -> `Moment stored.`
- `422` -> `Saved locally. Shared sync couldn't accept this moment.`
- `429` -> `Saved locally. Shared channel is temporarily busy.`
- timeout / `5xx` -> `Saved locally. Shared sync is unavailable.`

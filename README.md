# SlipUp Observatory V2

Clean rebuild aligned with the Observatory model.

## Included in this baseline

- `Observatory` landing as primary atmospheric view.
- `A Moment` (Contribute) on a separate page.
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

## Deployments

**Condición:** no incluir `PLAN_MASTER.md` en lo que se despliega. El archivo está en `.gitignore`. Si ya fue commiteado antes, ejecutar una vez: `git rm --cached PLAN_MASTER.md` y hacer commit para quitarlo del árbol desplegado; el archivo seguirá en disco para uso interno.

## Archivos que conviene dejar solo para nosotros (no en repo público)

- **`supabase/.temp/`** — Generados por la CLI de Supabase (project-ref, versiones, etc.). Ya están en `.gitignore`. Si alguna vez se commitearon, quitar del repo con: `git rm -r --cached supabase/.temp/` y commit (los archivos siguen en disco pero dejan de estar en el árbol).
- **`remote.js`** — En el repo va con **placeholders** para que el sitio desplegado (p. ej. GitHub Pages) cargue la app. En local, para usar el backend real: `node scripts/generate-remote.js` (usa `remote.local.js` o env).
- **`remote.local.js`** — Contiene tus URLs y anon key. En `.gitignore`; no se sube. Se usa solo para generar `remote.js` en tu máquina.

## Product loop

`Observatory -> Contribute -> micro shift -> settling -> observe -> Horizon Line`

## Notes

- This baseline intentionally avoids V1 carryover.
- No ranking, gamification, alerts, or moral language.

## Edge Setup (Supabase)

This repo includes a production-early backend path that keeps privacy risk low and blocks spam early.

- SQL schema base: `schema_v2.sql`
- SQL local bucket patch: `supabase/sql/phase2_local_geo_bucket.sql`
- SQL scale buckets patch: `supabase/sql/phase3_scale_buckets.sql`
- SQL marker/combo patch: `supabase/sql/phase4_marker_tables.sql`
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

### Frontend activation (config remota)

El repo incluye `remote.js` con **placeholders** (no incluir valores reales en el commit). Para usar el backend:

1. Copia **`remote.local.js.example`** a **`remote.local.js`**.
2. En `remote.local.js` rellena `REMOTE_MOMENTS_URL`, `REMOTE_CLIMATE_URL`, `REMOTE_ANON_KEY` y pon `USE_REMOTE_SHARED: true`.
3. Desde la raíz del repo ejecuta: **`node scripts/generate-remote.js`**. Eso reescribe la cabecera de `remote.js` con los valores de `remote.local.js` (o, si no existe, con variables de entorno `REMOTE_MOMENTS_URL`, `REMOTE_CLIMATE_URL`, `REMOTE_ANON_KEY`, `USE_REMOTE_SHARED`).
4. Abre `index.html` o despliega; la app usará ese `remote.js` generado.

Para **producción con backend real** (que slipup.io muestre datos de Supabase): en el paso de build del CI (p. ej. GitHub Actions) ejecuta `node scripts/generate-remote.js` con las variables de entorno / secrets; así el `remote.js` desplegado tiene los valores correctos sin guardarlos en el repo. Si no usas CI, el sitio desplegado tendrá `remote.js` con placeholders: la app cargará pero no mostrará datos remotos (solo fallback local).

Tras clonar o hacer pull: en local puedes seguir usando `remote.js` del repo (placeholders) o ejecutar `node scripts/generate-remote.js` para sobrescribir con tus `remote.local.js` o env y tener backend real.

Frontend keeps local fallback enabled by default:

- `201` -> `Moment stored.`
- `422` -> `Saved locally. Shared sync couldn't accept this moment.`
- `429` -> `Saved locally. Shared channel is temporarily busy.`
- timeout / `5xx` -> `Saved locally. Shared sync is unavailable.`

### Consent and legal baseline

- Keep app access open (do not hard-block homepage behind consent).
- Require explicit consent (checkbox) before saving a moment.
- Publish `privacy.html` and `terms.html` and link them from `index.html` and `contribute.html`.
- Use coarse regional buckets (timezone-derived), never exact GPS coordinates.

## Metaphor guardrails

- Treat climate as a shared reading of moments, not literal weather.
- Keep language non-judgmental (`condense / clear / stabilize`).
- Avoid ranking, gamification, alerts, and moral framing.

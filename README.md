# SlipUp™ Observatory V2

**SlipUp™ Observatory**

Clean rebuild aligned with the Observatory model.

## Included in this baseline

- `Observatory` landing as primary atmospheric view.
- `A moment` (Contribute) on a separate page.
- Layered reading model:
  - `Horizon Line` (shared/global transition)
  - `Nearby Field` (regional reading with fallback)
  - `Deep Record` (long-window sediment)
- Climate response loop with:
  - immediate micro-shift (<1 second)
  - inertial settling (3-8 seconds)
- Offline-first local persistence for moments (`localStorage`).
- Supabase-backed shared flow (`moments` + `climate` edge functions).
- **Tema atmosférico** (violeta royal, fondo oscuro): activar con `class="theme-atmosphere"` en `<html>`. Páginas donde aplica: `index.html`, `contribute.html`, `privacy.html`, `terms.html`, `ai.html`. El glow se intensifica al contribuir un momento (`atmosphere.bump()`). Variantes del logo en `assets/icons/` (512, 256, 96 px; trazo grueso; invertido).

## Local run

Open `index.html` in a browser.

## Deployments

**Condición:** no incluir `PLAN_MASTER.md` en lo que se despliega. El archivo está en `.gitignore`. Si ya fue commiteado antes, ejecutar una vez: `git rm --cached PLAN_MASTER.md` y hacer commit para quitarlo del árbol desplegado; el archivo seguirá en disco para uso interno.

### GitHub Pages con backend real (Opción A)

El workflow **`.github/workflows/deploy-pages.yml`** despliega a GitHub Pages y genera `remote.js` en el build con los secrets, para que el sitio use Supabase en producción.

1. **Origen del despliegue:** en el repo, **Settings → Pages → Build and deployment**: Source = **GitHub Actions** (no "Deploy from a branch").
2. **Secrets:** **Settings → Secrets and variables → Actions → New repository secret**. Crear:
   - `REMOTE_MOMENTS_URL` — URL de la Edge Function `moments` (p. ej. `https://TU_PROJECT_REF.supabase.co/functions/v1/moments`).
   - `REMOTE_CLIMATE_URL` — URL de la Edge Function `climate`.
   - `REMOTE_ANON_KEY` — Anon key del proyecto Supabase.
   - `USE_REMOTE_SHARED` — `true` para activar el backend remoto en producción.
3. Cada **push a `main`** (o ejecución manual del workflow) hace el build, genera `remote.js` con esos valores y despliega. El sitio desplegado mostrará datos de Supabase.

### Redirección canónica (SEO)

Para consolidar SEO y evitar dividir backlinks, conviene que **solo** `www.slipup.io` sea la URL canónica. Configura un **redirect 301** de `slipup.io` → `www.slipup.io` en tu proveedor de dominio o CDN. Ejemplo (Cloudflare): regla de redirección `slipup.io/*` → `https://www.slipup.io/$1` (301). Así Google y las redes sociales usan una sola versión del sitio. El repo incluye **sitemap.xml** (raíz); puedes enviarlo en Google Search Console para mejorar la indexación.

## Archivos que conviene dejar solo para nosotros (no en repo público)

- **`supabase/.temp/`** — Generados por la CLI de Supabase (project-ref, versiones, etc.). Ya están en `.gitignore`. Si alguna vez se commitearon, quitar del repo con: `git rm -r --cached supabase/.temp/` y commit (los archivos siguen en disco pero dejan de estar en el árbol).
- **`remote.js`** — En el repo va con **placeholders** para que el sitio desplegado (p. ej. GitHub Pages) cargue la app. En local, para usar el backend real: `node scripts/generate-remote.js` (usa `remote.local.js` o env).
- **`remote.local.js`** — Contiene tus URLs y anon key. En `.gitignore`; no se sube. Se usa solo para generar `remote.js` en tu máquina.

## Product loop

`Observatory -> Contribute -> micro shift -> settling -> observe -> Horizon Line`

## Notes

- This baseline intentionally avoids V1 carryover.
- No ranking, gamification, alerts, or moral language.
- **Backlog / mejoras:** si trabajás en local, podés mantener un `BACKLOG.md` en la raíz (está en `.gitignore`; no va al repo público). Ahí conviene anotar mejoras identificadas (modularización, tests, reversión Remove, BUILD_ID, etc.).

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

**Supabase Pro:** Con el plan Pro tienes backups diarios, sin pausa del proyecto y pooler dedicado. Para conexiones directas a Postgres (fuera de las Edge Functions), usa el **Dedicated Pooler** desde el Dashboard (Connect → Connection strings → Pooler). Las Edge Functions usan `SUPABASE_URL` + service role (API); con Pro puedes subir opcionalmente los límites (p. ej. `MOMENTS_GET_MAX`, `CLIMATE_GET_MAX`) vía secrets si necesitas más capacidad.

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

## Soft Resonance — Integrity Rules

The observatory uses a **Soft Resonance** layer after contribution: reorder and phrase bias remain probabilistic, decaying, and non-deterministic. To preserve this as emergent behaviour (not logic), do not break these rules:

- **Never** explicitly identify a user's moment (no highlight, no "this is yours").
- **Never** guarantee matching or visibility (no "we'll show your moment").
- **Never** inject synthetic moments (only reorder real data; never add fake items).
- **Always** keep resonance probabilistic (e.g. apply reorder only with probability &lt; 1), decaying (intensity decreases over the window), and non-deterministic (noise, variable window).
- Resonance must feel like **emergence**, not like a feature the user can "game".

**Influence limit:** resonance must not dominate the system. In practice, keep resonance influence at or below 30–40% of the final result (e.g. reorder probability, seed nudge magnitude). If reorder becomes too obvious or the climate always "reflects" the moment, the effect breaks.

Do not add visible metrics, explicit feedback, or "clarity" here; the system works because it stays at the edge of what is perceptible.

## License

See [LICENSE](LICENSE).

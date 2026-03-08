# Guía paso a paso: contador global "Not alone"

Para que el botón **"Not alone"** / **"No estás solo"** muestre cuántas personas han marcado cada momento (y no solo localmente), hay que tener desplegada la tabla y la Edge Function en Supabase. Sigue estos pasos en orden.

---

## Requisitos previos

- Proyecto Supabase creado y enlazado a este repo (o a tu deploy).
- **Supabase CLI:** en este proyecto ya está como dependencia. En la raíz del repo usa siempre **`npx supabase`** en lugar de `supabase` (sobre todo en Windows, donde el comando global a veces no funciona).
- Tener ya desplegadas las Edge Functions `moments` y `climate` (como en el README).

---

## Paso 1: ¿Qué es "enlazar el proyecto"? (y cuándo hace falta)

**"Enlazar"** significa conectar esta carpeta del proyecto (en tu ordenador) con tu **proyecto de Supabase en la nube**. Así la terminal sabe a qué proyecto enviar las migraciones y las funciones cuando ejecutas `supabase db push` o `supabase functions deploy`.

**¿Cuándo lo necesitas?**

- **Sí lo necesitas** si quieres usar la terminal para aplicar la tabla (Paso 2) y desplegar las funciones (Pasos 3 y 4) con comandos como `supabase db push` y `supabase functions deploy relate`.
- **No lo necesitas** si prefieres hacer todo desde el panel web de Supabase: crear la tabla con el SQL Editor (Paso 2, Opción B) y desplegar las funciones desde el dashboard o con otro método que ya uses.

**Si quieres enlazar (para usar la terminal):**

1. Abre una terminal en la raíz del repo (donde está `index.html`). En Windows usa **PowerShell** o **Terminal**, no hace falta `bash`.
2. Ejecuta (usa **`npx supabase`** para que funcione en Windows):
   ```bash
   npx supabase login
   ```
   Se abrirá el navegador para que inicies sesión en Supabase. Hazlo y vuelve a la terminal.
3. Entra en [app.supabase.com](https://app.supabase.com), elige tu proyecto (el de SlipUp Observatory).
4. Ve a **Project Settings** (icono de engranaje) → **General**. Ahí verás **Reference ID**: es una cadena corta, por ejemplo `abcdefghijklmnop`.
5. En la terminal, ejecuta **sustituyendo** `TU_REFERENCE_ID` por el valor que copiaste (ejemplo: si es `xyzabcdeqwertyuiop`, el comando es `npx supabase link --project-ref xyzabcdeqwertyuiop`):
   ```bash
   npx supabase link --project-ref TU_REFERENCE_ID
   ```
   No escribas literalmente "TU_REFERENCE_ID": usa el ID real del paso 4.
6. Si te pide la contraseña de la base de datos, usa la que ves en **Project Settings → Database → Database password**.

Después de esto, esta carpeta queda "enlazada" a ese proyecto. En el resto de la guía, donde ponga `supabase`, usa **`npx supabase`** (por ejemplo: `npx supabase db push`, `npx supabase functions deploy relate`).

---

## Paso 2: Crear la tabla `moment_relates`

Esta tabla guarda quién ha pulsado "Not alone" en cada momento (un registro por visitante y momento).

**Opción A – Con Supabase CLI (recomendado):**

```bash
npx supabase db push
```

Eso aplica todas las migraciones que aún no estén aplicadas, incluida `supabase/migrations/20260306000000_moment_relates.sql`.

**Opción B – A mano en el SQL Editor del dashboard:**

1. Entra en tu proyecto en [app.supabase.com](https://app.supabase.com).
2. **SQL Editor** → **New query**.
3. Pega y ejecuta este SQL:

```sql
create table if not exists public.moment_relates (
  moment_id uuid not null references public.moments(id) on delete cascade,
  visitor_fp text not null,
  created_at timestamptz not null default now(),
  constraint moment_relates_pk primary key (moment_id, visitor_fp)
);

create index if not exists moment_relates_moment_id_idx
  on public.moment_relates (moment_id);

comment on table public.moment_relates is 'Count of "Not alone" / resonate clicks per moment; one per visitor (fingerprint).';
```

4. **Run**.

---

## Paso 3: Desplegar la Edge Function `relate`

Esta función recibe el clic en "Not alone", guarda el registro en `moment_relates` y devuelve el contador actual.

En la raíz del repo:

```bash
npx supabase functions deploy relate
```

Si te pide variables de entorno, asegúrate de tener configurados al menos:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS` (p. ej. `https://www.slipup.io,https://slipup.io`) — así CORS acepta tanto si el usuario entra por `slipup.io` como por `www.slipup.io`.

**Cómo configurarlo:**  
**Dashboard:** Edge Functions → **Secrets** → añadir o editar `ALLOWED_ORIGINS` con valor `https://www.slipup.io,https://slipup.io`.  
**CLI:** `npx supabase secrets set ALLOWED_ORIGINS="https://www.slipup.io,https://slipup.io"` (en PowerShell puede ir entre comillas simples por fuera).

---

## Paso 4: Tener desplegada la Edge Function `moments` (con `relate_count`)

El GET de `moments` debe ser la versión que devuelve `relate_count` por momento (la que está en el repo). Si ya desplegas `moments` desde este repo, solo hay que volver a desplegar:

```bash
npx supabase functions deploy moments
```

Así el listado de momentos incluirá el campo `relate_count` y la web podrá mostrar el número global.

---

## Paso 5: Comprobar que la URL de `relate` está en producción

En **GitHub Actions** (o tu CI), el script `node scripts/generate-remote.js` genera `remote.js` y deriva la URL de relate a partir de `REMOTE_MOMENTS_URL`:

- Si `REMOTE_MOMENTS_URL` = `https://TU_REF.supabase.co/functions/v1/moments`
- Entonces la URL de relate será = `https://TU_REF.supabase.co/functions.co/functions/v1/relate`

No hace falta un secret aparte para relate: se obtiene de `REMOTE_MOMENTS_URL`. Solo asegúrate de que en los **Secrets del repo** tengas:

- `REMOTE_MOMENTS_URL`
- `REMOTE_CLIMATE_URL`
- `REMOTE_ANON_KEY`
- `USE_REMOTE_SHARED` = `true`

y que el workflow ejecute `node scripts/generate-remote.js` antes de desplegar (como en el README).

---

## Paso 6: Probar en la web

1. Abre el sitio desplegado (p. ej. https://www.slipup.io).
2. Entra en un momento que tenga el botón **"Not alone"**.
3. Pulsa **"Not alone"**.
4. Deberías ver:
   - El texto pasa a algo como **"Not alone · 1 · you"** (o un número mayor si ya había clics).
   - Al recargar la página, el número se mantiene (viene del servidor).
5. Si en vez de eso solo ves **"Not alone · 1 · you"** y al pasar el ratón un tooltip tipo *"Global count will appear when the service is available"*, entonces:
   - La tabla `moment_relates` no existe, o
   - La función `relate` no está desplegada o da error, o
   - La URL de relate no se está generando bien en `remote.js`.

---

## Resumen rápido

| Paso | Qué hacer |
|------|-----------|
| 1 | `npx supabase link` (si no está enlazado). |
| 2 | Crear tabla: `npx supabase db push` o ejecutar el SQL de la migración a mano. |
| 3 | `npx supabase functions deploy relate` |
| 4 | `npx supabase functions deploy moments` (versión actual del repo). |
| 5 | Confirmar que en CI se genera `remote.js` con `REMOTE_MOMENTS_URL` (y por tanto la URL de relate). |
| 6 | Probar en la web: clic en "Not alone" y ver que el número global se actualiza. |

Si en algún paso ves un error concreto (por ejemplo al hacer `db push` o `functions deploy`), copia el mensaje y se puede revisar el siguiente paso concreto.

---

## Si "Not alone" no muestra el número global (solo local)

El backend (tabla + funciones) ya está en Supabase; si el botón no actualiza el número global, el fallo suele estar en **qué carga el sitio en producción**.

### 1. Comprobar secrets en GitHub

En el repo: **Settings → Secrets and variables → Actions**. Deben existir y tener valor:

| Secret | Valor de ejemplo (sustituye por tu proyecto) |
|--------|---------------------------------------------|
| `REMOTE_MOMENTS_URL` | `https://ksyfcddiuzrabujflvpb.supabase.co/functions/v1/moments` |
| `REMOTE_CLIMATE_URL` | `https://ksyfcddiuzrabujflvpb.supabase.co/functions/v1/climate` |
| `REMOTE_ANON_KEY` | La anon key del proyecto (Project Settings → API) |
| `USE_REMOTE_SHARED` | `true` (texto exacto) |

Si falta alguno o `USE_REMOTE_SHARED` no es `true`, el sitio desplegado no llamará al backend y el contador solo será local.

### 2. Volver a desplegar la web

Después de tocar los secrets, hay que generar de nuevo el `remote.js` y desplegar:

- Haz un **push a `main`** (aunque sea un commit vacío: `git commit --allow-empty -m "Trigger deploy" && git push`), o
- **Actions** → workflow "Deploy to GitHub Pages" → **Run workflow**.

Así el workflow ejecuta `node scripts/generate-remote.js` con los secrets y el sitio queda con las URLs correctas (incluida la de `relate`).

### 3. Comprobar en el navegador

En tu sitio (p. ej. www.slipup.io):

1. Abre **Herramientas de desarrollador** (F12) → pestaña **Red / Network**.
2. Pulsa **"Not alone"** en un momento.
3. Debería aparecer una petición a `.../functions/v1/relate` (método POST). Si no aparece ninguna petición, el sitio sigue usando `USE_REMOTE_SHARED = false` o URLs placeholder (revisa paso 1 y 2). Si la petición sale en rojo (CORS o 404), revisa que la función `relate` esté desplegada y que en Supabase → Edge Functions → relate no haya errores.

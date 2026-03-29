# Guía: deploy de la Edge `text-resonance` (principiantes)

## Los 5 pasos (orden)

| # | Qué hacés | Dónde |
|---|-----------|--------|
| **1** | `npx supabase login` y `npx supabase link --project-ref TU_PROJECT_REF` | Terminal (una vez por PC/proyecto) |
| **2** | El cableado vive en **`supabase/functions/text-resonance/index.ts`** (en el repo). Si en tu máquina no existe, copiá desde `scripts/text-resonance.edge.example.ts` | — |
| **3** | `npx supabase functions deploy text-resonance` | Terminal (cada vez que cambies la función) |
| **4** | En `remote.local.js`: `USE_REMOTE_TEXT_RESONANCE: true` → `node scripts/generate-remote.js` | Editor + terminal |
| **5** | Probar en el navegador (Red + Consola) y, si aplica, secret en GitHub | Ver sección **Paso 5** abajo |

---

## Qué ya está hecho en el código (no hace falta que lo programes)

- Cliente: `fetchTextResonanceRemote` en `remote.js`, flag `USE_REMOTE_TEXT_RESONANCE`, merge con α=0.
- Ejemplo listo para copiar: `scripts/text-resonance.edge.example.ts` (stub + CORS).
- Generador: `node scripts/generate-remote.js` escribe la cabecera de `remote.js` (URLs, flag, anon key desde `remote.local.js` o env).

## Qué tenés que hacer vos (Supabase + tu máquina)

### A. Una sola vez: herramientas

1. Crear cuenta en [Supabase](https://supabase.com) si no tenés.
2. **Supabase CLI en Windows (elegí una opción):**
   - **Recomendado:** [Node.js](https://nodejs.org) + **`npx supabase …`** (no hace falta comando global `supabase`):
     - `npx supabase login`
     - `npx supabase link --project-ref TU_PROJECT_REF`
     - `npx supabase functions deploy text-resonance`
   - **No uses** `npm install -g supabase`: el paquete npm indica que **la instalación global no está soportada**; fallará con error explícito.
   - **CLI global por otro medio:** [winget](https://github.com/supabase/cli#windows-package-managers), [Scoop](https://scoop.sh), o binario desde [releases](https://github.com/supabase/cli/releases) — así `supabase` queda en el PATH.
3. **`npx supabase start` y Docker:** solo sirve para **Supabase local** (base de datos en tu PC). Para **desplegar funciones en la nube** (lo que hace SlipUp) **no hace falta** Docker ni `supabase start`. Si ves “Docker is not running” al hacer **deploy**, suele ser advertencia; si el deploy termina en “Deployed Functions”, está bien.
4. Comando de login: **`npx supabase login`** (o `supabase login` si instalaste la CLI por winget/Scoop). **Sin** caracteres extra al final (no `login#`). Abrís el navegador y autorizás.

### B. Enlazar tu proyecto

Desde la raíz del repo SlipUp (o donde tengas el proyecto):

```bash
cd ruta/al/repo/SlipUP-Observatory
supabase link --project-ref TU_PROJECT_REF
```

(Si no tenés `supabase` en el PATH: `npx supabase link --project-ref TU_PROJECT_REF`.)

`TU_PROJECT_REF` está en Supabase → **Project Settings → General → Reference ID** (no es secreto; es un id público del proyecto).

### C. Crear la función y copiar el código

1. En el repo ya está **`supabase/functions/text-resonance/index.ts`** (stub + CORS). Si clonás y no ves la carpeta, hacé pull; si solo tenés el ejemplo, copiá **`scripts/text-resonance.edge.example.ts`** a esa ruta.
2. No hace falta tocar la lógica para el primer deploy: el stub devuelve `scores: null` y CORS correcto.

### D. Desplegar

```bash
supabase functions deploy text-resonance
```

(O con npx: `npx supabase functions deploy text-resonance`.)

Si pide confirmación o versión, seguí las indicaciones de la CLI. Al terminar, la URL será:

`https://TU_PROJECT_REF.supabase.co/functions/v1/text-resonance`

(igual que la que ya deriva `remote.js` desde `moments`.)

### E. Activar el flag en local

1. En **`remote.local.js`** (copia desde `remote.local.js.example` si no lo tenés), añadí o dejá:

   ```js
   USE_REMOTE_TEXT_RESONANCE: true,
   ```

   Mientras la función no esté estable, podés dejar `false` y no habrá fetch (solo stub).

2. Regenerar:

   ```bash
   node scripts/generate-remote.js
   ```

3. Abrí el sitio con un **servidor HTTP local** (no abras `index.html` como `file://` si los módulos ES fallan). Por ejemplo:

   ```bash
   npx --yes serve -p 8080
   ```

   y entrá a `http://localhost:8080`.

### F. Producción (GitHub Pages)

1. Cuando la Edge funcione y no veas errores CORS en consola, en el repo → **Settings → Secrets and variables → Actions** añadí (opcional):

   - Nombre: `USE_REMOTE_TEXT_RESONANCE`
   - Valor: `true`

2. El workflow ya pasa ese valor a `generate-remote.js` en el deploy. Hacé push a `main` y esperá el deploy.

---

## Paso 5 · Probar y verificar (detalle)

**Objetivo:** comprobar que Orbital sigue bien y que, si activaste el flag, la llamada a `text-resonance` no rompe nada (sin errores CORS).

### 5.1 Servidor local (no abras `file://`)

1. En la raíz del repo:

   ```bash
   npx --yes serve -p 8080
   ```

2. En el navegador: `http://localhost:8080` (no el archivo `index.html` directo desde el disco).

### 5.2 Herramientas de desarrollador (F12)

1. Pestaña **Red** (Network): recargá la página con Orbital visible (scroll hasta esa sección si hace falta).
2. **Si `USE_REMOTE_TEXT_RESONANCE` es `false` en el `remote.js` generado:** no debería aparecer ninguna petición cuyo nombre sea `text-resonance`. Eso es correcto (solo stub, sin fetch).
3. **Si es `true` y ya desplegaste el paso 3:** debería haber un **POST** a `…/functions/v1/text-resonance` con estado **200**. Si ves **(failed)** o error CORS en rojo en **Consola**, la función o CORS aún no están bien; el sitio puede seguir viéndose bien porque el cliente vuelve al stub.

### 5.3 Qué esperar en la UI

- **Glow y tooltips de vecinos en Orbital:** deben verse **normales** (igual que antes).
- Con **α = 0** en la app, los números que pintan glow/tooltip siguen saliendo del **stub** aunque la Edge responda `scores: null`. No esperes un cambio visual hasta PR3c (α > 0).

### 5.4 Producción (`www.slipup.io`)

1. Añadí el secret `USE_REMOTE_TEXT_RESONANCE` = `true` solo cuando el paso 5 en local ya esté limpio (sin CORS).
2. Esperá el deploy de GitHub Actions y repetí la comprobación de **Red + Consola** en el dominio público.

---

## Cómo saber si salió bien (resumen)

- Con flag `false`: no debe aparecer ningún request a `text-resonance` en **Red**.
- Con flag `true` y función desplegada: POST con **200** y **Consola** sin errores de CORS.
- Orbital (glow + tooltips) **normal**; con α=0 la UI sigue basada en **stub** aunque la Edge responda.

## Costo

- Esta función **stub** no llama a OpenAI ni a APIs de pago: el costo extra suele ser **cero o marginal** dentro del plan gratuito de Supabase, salvo tráfico muy alto.
- **AI real** (embeddings, LLM) se suma después y ahí sí hay costo por proveedor y uso.

## Si algo falla

- **CORS / preflight**: revisá que el deploy sea el último `index.ts` (OPTIONS 204 + headers).
- **404 en la URL**: nombre de función o `project-ref` mal al linkear.
- **No subas** `remote.js` con anon key real al repo público: regenerá con placeholders antes de `git add`.

---

## Checklist principiantes (comandos exactos)

Usá **PowerShell** en la carpeta del repo, por ejemplo:

`cd "C:\Users\...\SlipUP Observatory"`

| # | Comando | Qué mirar |
|---|---------|-----------|
| 1 | `npx supabase login` | Navegador: inicio de sesión; al final: “You are now logged in”. |
| 2 | `npx supabase link --project-ref TU_PROJECT_REF` | Poné tu **Reference ID** (Dashboard → Project Settings → General). Debe decir `Finished supabase link.` |
| 3 | `npx supabase functions deploy text-resonance` | `Deployed Functions … text-resonance`. El aviso “Docker is not running” **se puede ignorar** para este deploy. |
| 4 | En `remote.local.js`: `USE_REMOTE_TEXT_RESONANCE: true` | Guardar archivo. |
| 5 | `node scripts/generate-remote.js` | `remote.js updated from remote.local.js`. |
| 6 | `npx --yes serve -p 8080` y abrir `http://localhost:8080` | F12 → **Red**: POST a `…/text-resonance` con **200** si el flag es `true`; **Consola** sin errores CORS. |
| 7 | (Opcional) GitHub → Secrets → `USE_REMOTE_TEXT_RESONANCE` = `true` | Solo para el sitio en Pages; después de probar local. |

**Archivo de la función:** en el repo ya está **`supabase/functions/text-resonance/index.ts`** (no hace falta copiar `text-resonance.edge.example.ts` salvo que falte en tu disco).

**No uses** `npm install -g supabase` (no está soportado). **No necesitás** `npx supabase start` ni Docker para desplegar la función en la nube.

### Resumen costo / AI

- **Stub + Edge sin LLM:** costo ~**gratis** en plan Supabase habitual para pruebas.
- **AI real (APIs de terceros):** costo por **tokens / llamadas**; viene después (PR3b+).
- Con **α = 0**, glow y tooltip siguen igual **stub** aunque la Edge responda `scores: null`.

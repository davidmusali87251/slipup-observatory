# Guía: deploy de la Edge `text-resonance` (principiantes)

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

1. Crear carpetas: `supabase/functions/text-resonance/` (si no existen).
2. Copiar el contenido de **`scripts/text-resonance.edge.example.ts`** a:
   - **`supabase/functions/text-resonance/index.ts`**
3. No hace falta tocar la lógica para el primer deploy: el stub devuelve `scores: null` y CORS correcto.

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

## Cómo saber si salió bien

- Con flag `false`: no debe aparecer ningún request a `text-resonance` en la pestaña **Red** de las herramientas de desarrollador.
- Con flag `true` y función desplegada: POST a `.../text-resonance` con **200**; sin errores rojos de CORS en **Consola**.
- Orbital (glow + tooltips) debe verse **normal**; con α=0 la UI sigue basada en **stub** aunque la Edge responda.

## Costo

- Esta función **stub** no llama a OpenAI ni a APIs de pago: el costo extra suele ser **cero o marginal** dentro del plan gratuito de Supabase, salvo tráfico muy alto.
- **AI real** (embeddings, LLM) se suma después y ahí sí hay costo por proveedor y uso.

## Si algo falla

- **CORS / preflight**: revisá que el deploy sea el último `index.ts` (OPTIONS 204 + headers).
- **404 en la URL**: nombre de función o `project-ref` mal al linkear.
- **No subas** `remote.js` con anon key real al repo público: regenerá con placeholders antes de `git add`.

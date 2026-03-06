# Recomendaciones técnicas de funcionamiento

Documento para el técnico de funcionamiento del producto: mejoras de fiabilidad, observabilidad y resiliencia.

---

## Resumen de implementación

Lo siguiente **ya está implementado** en el repo:

| Área | Implementado | Dónde |
|------|--------------|--------|
| **Reintento GET** | 1 reintento con backoff 600 ms en fallo de red o 5xx (no en 4xx). POST sin reintento. | `remote.js`: `GET_RETRY_BACKOFF_MS`, `withGetRetry()`, usado en moments, climate y geo. |
| **Logging con flag** | Con `?debug=1` en la URL, `console.warn` al usar fallback local por error en momentos o clima. | `app.js`: en `loadSharedMoments` y `loadClimateTruth` (catch). |
| **Mensaje cuando todo remoto falla** | Si remoto está activo y tanto momentos como clima caen a local, se muestra "Reading from this device only." / "Leyendo solo desde este dispositivo." en la condition line. | `app.js`: `conditionOffline` en UI_COPY; en `boot()` tras `Promise.all`. |
| **Nearby en segundo plano** | Carga de clima del campo sin bloquear el hero; si falla, `.catch()` y `console.warn` discreto. | `app.js`: promesa `loadFieldClimateTruth(...).then(...).catch(...)`. |
| **Error no controlado en boot** | `boot().catch(...)`: quita `aria-busy` e `is-pending`, muestra mensaje genérico (conditionError) y `console.error`. | `app.js`: al final del script. UI_COPY: `conditionError` en/en, es/es. |
| **Comprobación de placeholders en deploy** | Si `REMOTE_MOMENTS_URL` está definido y `_site/remote.js` contiene `YOUR_PROJECT_REF`, el job falla. | `.github/workflows/deploy-pages.yml`: step "Check remote.js has real URLs when secrets are set". |
| **Smoke test opcional** | Si hay `REMOTE_CLIMATE_URL` y `REMOTE_ANON_KEY`, GET al clima; si no devuelve 200, se emite `::warning::` (el deploy no se corta). | `.github/workflows/deploy-pages.yml`: step "Smoke test (backend reachable)". |
| **Export isRemoteReady** | El front puede saber si el remoto está configurado para mostrar el mensaje de "todo local". | `remote.js`: export de `isRemoteReady`. |
| **Hook para métricas externas** | Si se define `window.__observatoryReportEvent`, se llama con el nombre del evento en cada fallback o error (sin payload de usuario). Eventos: `remote_fallback_moments`, `remote_fallback_climate`, `remote_fallback_nearby`, `boot_error`. | `app.js`: `reportObservatoryEvent()`, llamado en catch de loadSharedMoments, loadClimateTruth, loadFieldClimateTruth y boot().catch. |
| **Procedimientos de incidencias** | Guía de qué revisar cuando no se ven momentos, el grado no actualiza, la página tarda, etc. | `docs/INCIDENT_PROCEDURES.md`. |
| **TTL de cache GET** | Cache de respuestas GET subido a 45 s (antes 20 s) para reducir peticiones sin datos muy viejos. | `remote.js` y `remote.js.template`: `GET_CACHE_TTL_MS = 45000`. |

---

## 1. Observabilidad y errores

**Situación:** Los fallos de red (moments, climate, geo) se tragan en `catch` y se usa fallback local; el usuario no sabe si algo falló.

**Recomendaciones:**
- **Logging acotado:** En desarrollo o con un flag (ej. `?debug=1`), hacer `console.warn` con código de error cuando falle remoto (ej. `REMOTE_GET_FAILED`, `REMOTE_CLIMATE_GET_FAILED`), sin datos sensibles. En producción evitar `console` o enviar a un servicio opcional.
- **Métricas opcionales:** Si más adelante se usa un servicio (ej. Vercel Analytics, Sentry), enviar un evento cuando `loadSharedMoments` o `loadClimateTruth` usen fallback por error (solo contador, sin payload de usuario).
- **UI de error suave:** Si *todas* las peticiones remotas fallan, mostrar un mensaje breve en la página (ej. "Reading from this device only" o "Connection issue; showing local data") y quitar `aria-busy`. No bloquear la app.

---

## 2. Timeouts y reintentos

**Situación:** `REMOTE_TIMEOUT_MS = 4500` en `remote.js`; una sola tentativa por petición.

**Recomendaciones:**
- Mantener 4500 ms o bajar a 3000–3500 ms si la latencia típica del backend es menor, para no alargar la carga en vano.
- **Reintentos:** Para GET (moments, climate, geo), considerar 1 reintento con backoff corto (ej. 500–800 ms) solo en fallo de red o 5xx, no en 4xx. No reintentar POST (contribución) de forma automática para evitar duplicados.
- Documentar en código o en este doc la política: "GET: 1 retry on network/5xx; POST: no retry".

---

## 3. Carga en segundo plano (Nearby)

**Situación:** `loadFieldClimateTruth` se lanza en segundo plano; si falla, la sección Nearby se queda con el fallback global y no hay feedback.

**Recomendaciones:**
- En el `.then()` que actualiza Nearby, añadir `.catch()`: si falla, opcionalmente mostrar un indicador discreto (ej. "Nearby data temporarily unavailable") o dejar el texto de fallback y no mostrar error agresivo.
- Asegurar que, si la promesa nunca se resuelve (red colgada), no quede `aria-busy` ni estados intermedios: el hero ya no depende de esa promesa.

---

## 4. Cache (GET)

**Situación:** `GET_CACHE_TTL_MS = 20000` (20 s) para moments, climate y geo; evita peticiones repetidas en poco tiempo.

**Recomendaciones:**
- Mantener 20 s; si el producto se usa en pestañas largas, 30–60 s es razonable. No subir mucho para no mostrar datos muy viejos.
- En cambio de "Field lens" (scope), ya se vuelve a pedir clima del campo; correcto. No cachear por encima del TTL sin invalidación explícita.

---

## 5. Despliegue y comprobaciones

**Situación:** El workflow genera `remote.js` con secrets y despliega estático a GitHub Pages.

**Recomendaciones:**
- **Comprobación post-build:** Tras `Prepare site`, comprobar que `remote.js` contiene la URL del backend (por ejemplo que no sea el placeholder `YOUR_PROJECT_REF`) cuando los secrets están definidos. Si falta, fallar el job con un mensaje claro.
- **Smoke test opcional:** Un job que, tras el deploy, haga una petición GET a la URL del clima (o momentos) y compruebe 200. Si falla, no romper el deploy pero notificar (ej. issue o Slack). Útil para detectar rotura del backend o CORS.

---

## 6. Resiliencia del front

**Resumen de buenas prácticas ya presentes:**
- Fallback a datos locales cuando falla remoto.
- Timeouts con `AbortController` para no colgar la UI.
- `aria-busy` en el panel del observatorio durante la carga inicial.
- Paralelización de momentos + clima + geo y carga diferida de Nearby.

**Añadir:**
- Si en `boot()` ocurre una excepción no controlada (p. ej. un bug), capturarla al final del flujo y mostrar un mensaje genérico ("Something went wrong; refresh the page.") en lugar de pantalla en blanco, y quitar `aria-busy`.

---

## 7. Seguridad y configuración

- Las URLs y la anon key no deben estar en el cliente más allá de lo necesario; el uso actual (build con secrets, `remote.js` generado) es adecuado.
- No loguear ni enviar en errores el contenido de `REMOTE_ANON_KEY` ni datos de momentos de usuarios.
- CORS y rate limit se gestionan en el backend (Supabase/Edge Functions); mantener documentado en el repo qué dominios están permitidos.

---

## 8. Prioridad de implementación sugerida

| Prioridad | Acción |
|----------|--------|
| Alta      | Manejo de error en la promesa de `loadFieldClimateTruth` (`.catch`) y mensaje discreto si falla Nearby. |
| Alta      | Captura de excepción no controlada en `boot()` y mensaje genérico + quitar `aria-busy`. |
| Media     | Comprobación en el workflow de que `remote.js` no queda con placeholders cuando hay secrets. |
| Media     | Un `console.warn` (o flag) en fallos remotos para depuración. |
| Baja      | Reintento único para GET con backoff corto. |
| Baja      | Smoke test opcional tras deploy. |

Este documento se puede ampliar con procedimientos de incidencias (qué revisar si "no se ven momentos" o "el grado no actualiza") y con contactos o enlaces al backend.

# Procedimientos de incidencias

Guía rápida para el técnico: qué revisar cuando algo falla en el Observatorio.

---

## No se ven momentos compartidos

1. **Comprobar remoto:** ¿`USE_REMOTE_SHARED` y URLs están configurados? (en producción, `remote.js` generado con secrets).
2. **Fallback local:** Si el remoto falla, la app usa momentos locales (solo los de este dispositivo). El usuario verá "Moments from this device only" / "Solo momentos de este dispositivo" en el contexto reciente.
3. **Condition line:** Si además el clima remoto falló, puede verse "Reading from this device only." / "Leyendo solo desde este dispositivo."
4. **Depuración:** Abrir la página con `?debug=1` y revisar la consola: si hay `REMOTE_GET_FAILED` o `REMOTE_CLIMATE_GET_FAILED`, el backend no respondió o hubo error de red.
5. **Backend:** Revisar que la Edge Function `moments` (GET con `scope=shared`) responda 200 y devuelva un array. Revisar CORS y rate limit en Supabase.

---

## El grado no actualiza o se queda fijo

1. **Clima remoto:** El grado viene de la Edge Function `climate` (GET). Si falla, se usa cálculo local con los momentos cargados; el valor puede ser distinto.
2. **Cache:** El cliente cachea la respuesta de clima 45 s (`GET_CACHE_TTL_MS`). Tras contribuir, la app puede hacer una nueva petición (contribute flow). Refrescar la página para forzar nueva lectura.
3. **Animación:** Tras contribuir, el grado anima hacia el nuevo valor; si hay `prefers-reduced-motion`, se actualiza sin animación.
4. **Depuración:** Con `?debug=1`, si aparece `REMOTE_CLIMATE_GET_FAILED`, el clima remoto no está llegando. Revisar que `climate` devuelva `computedDegree` y `total` válidos.

---

## La página tarda mucho en cargar

1. **Peticiones en paralelo:** La carga inicial espera momentos + clima + geo (geo en paralelo desde la última mejora). El tiempo total es el del más lento de esos.
2. **Nearby:** La sección "Nearby" se rellena en segundo plano; no bloquea el hero. Si tarda, la sección puede quedarse con el fallback global un momento.
3. **Reintentos:** Los GET tienen 1 reintento con 600 ms de espera en fallo de red o 5xx. Eso puede añadir ~600 ms en caso de fallo.
4. **Timeouts:** Cada petición tiene timeout de 4500 ms (`REMOTE_TIMEOUT_MS`). Si el backend tarda más, se corta y se usa fallback.
5. **Revisar:** Latencia del backend (Supabase Edge Functions), red del usuario, y en consola (con `?debug=1`) si hay warnings de fallback.

---

## Error genérico "Something went wrong" / "Algo ha fallado"

1. **Causa:** Una excepción no controlada en `boot()` (por ejemplo un bug o datos inesperados del backend).
2. **Consola:** Revisar `console.error("[Observatory] boot error", ...)` para el stack y el motivo.
3. **Métricas:** Si está configurado `window.__observatoryReportEvent`, se habrá enviado el evento `boot_error` (integrar con Sentry/Analytics para ver frecuencia).
4. **Pasos:** Reproducir con `?debug=1`, verificar que las respuestas de moments y climate tengan la forma esperada (array de momentos; objeto con `computedDegree`, `total`, etc.).

---

## Nearby / Field lens no muestra datos del scope seleccionado

1. **Clima del campo:** Al elegir un scope (Nearby, país, etc.) se llama a `loadFieldClimateTruth`, que puede pedir clima con `scope=local` y `geo=...`. Si falla, se muestra fallback global.
2. **Consola:** Con `?debug=1`, si aparece el mensaje de "Nearby field data could not be loaded", la petición clima local falló.
3. **Backend:** La Edge Function `climate` debe aceptar parámetros `scope` y `geo` y devolver datos para ese bucket (o 4xx/5xx). Revisar CORS y que la URL del clima esté bien configurada.

---

## Deploy falla: "remote.js still contains placeholder"

1. **Causa:** El workflow comprueba que, si `REMOTE_MOMENTS_URL` está definido en secrets, el archivo `_site/remote.js` no contenga `YOUR_PROJECT_REF`.
2. **Solución:** Asegurarse de que en GitHub Actions → Settings → Secrets están definidos `REMOTE_MOMENTS_URL`, `REMOTE_CLIMATE_URL`, `REMOTE_ANON_KEY` (y opcionalmente `USE_REMOTE_SHARED`) con valores reales. El step "Generate remote.js" debe ejecutarse antes de "Prepare site" y sustituir el bloque de config en `remote.js`.
3. **Local:** Si generas `remote.js` con `node scripts/generate-remote.js` y env o `remote.local.js`, comprueba que el archivo generado no tenga `YOUR_PROJECT_REF`.

---

## Smoke test en deploy: "climate GET returned XXX"

1. **Qué es:** El workflow hace un GET a la URL del clima con anon key; si el status no es 200, se emite un warning (el deploy no se corta).
2. **Si aparece el warning:** Revisar que la Edge Function `climate` esté desplegada, que la URL en secrets sea correcta, que la anon key sea válida y que no haya rate limit o CORS bloqueando desde el runner de GitHub. El smoke test no comprueba CORS desde el navegador, solo que el backend responda 200 a una petición autenticada.

---

## Integrar métricas / Sentry

Para enviar eventos a un servicio externo cuando hay fallback o error:

1. Antes de cargar la app, definir en la página:
   ```js
   window.__observatoryReportEvent = function(eventName) {
     // Ejemplo: Sentry.captureMessage("observatory_" + eventName);
     // Ejemplo: analytics.track("observatory_fallback", { event: eventName });
   };
   ```
2. Eventos que se emiten: `remote_fallback_moments`, `remote_fallback_climate`, `remote_fallback_nearby`, `boot_error`. Solo se pasa el nombre del evento, sin datos de usuario.

Este documento se puede ampliar con contactos de escalado o enlaces al dashboard del backend.

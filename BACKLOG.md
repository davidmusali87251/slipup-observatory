# Backlog / mejoras

Lista de mejoras identificadas para el proyecto. Ver también las reglas de commit y la documentación interna (si está disponible localmente).

---

## 1. Tamaño de app.js

| Prioridad | Media |
|-----------|--------|
| **Problema** | Un solo archivo muy largo (~3.5k líneas); dificulta navegación y pruebas. |
| **Objetivo** | Mantenibilidad y pruebas por módulo. |
| **Siguiente paso** | Extraer módulos (p. ej. `uiCopy.js` para copy, luego `climate.js` para lógica de clima cliente, `render.js` para pintado). Mantener `app.js` como orquestador que importa y arranca. |

---

## 2. Duplicación de lógica

| Prioridad | Media |
|-----------|--------|
| **Problema** | Constantes y lógica de clima en `modelConstants.js` y `supabase/functions/_shared/modelConstants.ts` + `computeClimate.ts`; sincronía a mano. |
| **Objetivo** | Una sola fuente de verdad para constantes del modelo. |
| **Siguiente paso** | Documentar contrato de sincronía en README o en comentarios; opcionalmente generar `modelConstants.js` desde el .ts en build, o mover constantes a un paquete compartido. |

---

## 3. Testing

| Prioridad | Alta |
|-----------|--------|
| **Problema** | No hay tests en el repo; la física del clima y la generación de copy son frágiles ante cambios. |
| **Objetivo** | Tests unitarios para clima (computeClimate, conditionForDegree) y para copy (getReadingStatusLine, getMixLinePhrase). |
| **Siguiente paso** | Añadir script de test (Node o Vitest/Jest); al menos tests para `modelConstants` + función de clima local y para 2–3 funciones de copy. |

---

## 4. Dependencia de Supabase

| Prioridad | Baja |
|-----------|--------|
| **Problema** | Backend atado a Supabase (Edge Functions, RPC, buckets). Migrar a otro stack implica reescribir. |
| **Objetivo** | Consciencia del acoplamiento; no bloqueante si el stack se mantiene. |
| **Siguiente paso** | Dejar documentado en este backlog; si en el futuro se plantea multi-backend, extraer una capa de “adaptador” de API (fetch climate / moments) para poder sustituir implementación. |

---

## 5. Horizon / Strata

| Prioridad | Media |
|-----------|--------|
| **Problema** | Horizon derivado en cliente; Strata más placeholder. A escala puede hacer falta lógica en servidor o jobs. |
| **Objetivo** | Que Horizon/Strata escalen sin bloquear el cliente. |
| **Siguiente paso** | Seguir con la arquitectura actual; cuando el volumen lo pida, diseñar endpoints o jobs que precalculen Horizon/Strata y el cliente solo consuma. Documentar en `ARCHITECTURE_AT_SCALE` cuando se defina. |

---

## 6. Reversión de “Remove”

| Prioridad | Media |
|-----------|--------|
| **Problema** | Al ocultar un momento se guarda en `hidden_moment_ids`; no había UI para “mostrar de nuevo”. |
| **Objetivo** | Poder recuperar un momento oculto sin tocar el storage a mano. |
| **Siguiente paso** | Implementado: sección “Hidden from view” con “Show again” por id. Ver commit que añade esta funcionalidad. |

---

## 7. Placeholders de build (BUILD_ID)

| Prioridad | Baja |
|-----------|--------|
| **Problema** | `{{BUILD_ID}}` en HTML/CSS/JS; si no se reemplaza en CI, el cache busting no varía. |
| **Objetivo** | Que el deploy sustituya `{{BUILD_ID}}` en los archivos servidos. |
| **Siguiente paso** | El workflow `.github/workflows/deploy-pages.yml` ya sustituye `{{BUILD_ID}}` por `github.sha` en todos los `.html` de `_site/`. Los `<script>` y `<link>` con `?v={{BUILD_ID}}` están en el HTML, así que queda cubierto. Si en el futuro se usa BUILD_ID dentro de .js o .css, añadir en el step “Prepare site” un `sed` sobre `_site/*.js` y `_site/*.css`. |

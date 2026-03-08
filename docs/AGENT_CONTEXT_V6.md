# Contexto agente V6 — SlipUp Observatory

Referencia única para agentes (Cursor, Claude, GPT, etc.). Consolida identidad, física, arquitectura, UI y guardrails.

**Documento derivado (detalle técnico):** `docs/ARCHITECTURE_AT_SCALE.md`

---

## 1. Identidad del sistema

SlipUp es un **instrumento atmosférico**, no una red social ni una herramienta de auto-mejora.

- **Moment** = unidad mínima (no "error"). **Cielo** = instrumento (no dashboard).
- **Canal shared** = evidencia mínima en el campo, no feed ni consumo infinito.
- Objetivo: **eventos pequeños → agregación por ventana → clima determinista → render calmado.**

---

## 2. Reglas de producto (guardrails)

- **No** dashboard, feed infinito, ranking, likes, trending, gamificación ni métricas como logro.
- **No** cambiar strings sagrados: `type` ∈ { avoidable | fertile | observed }, `mood` ∈ { calm | focus | stressed | curious | tired }, `note` max 19 caracteres.
- **No** tocar `schema_v2.sql` sin acuerdo explícito.
- **Shared = evidencia mínima:** preview y sheet acotados (listas limitadas). Sistema habitable, no panel consultable.

---

## 3. Arquitectura

- **Cliente:** render + animación de `displayDegree` + fallback local si remoto falla. Nunca queries directas a tablas; todo por Edge Functions (moments, climate, relate).
- **Servidor:** verdad única de `computedDegree`. `GET /climate` con forma de respuesta fija; agregación por **últimos 48 buckets** (horarios) para 48h, no scan de momentos crudos a escala. `referenceTime` generado en servidor.
- **Frase:** *Event log abajo, atmósfera arriba.*

---

## 4. Física del clima

- El clima se comporta como **masa atmosférica:** más masa total (momentos en ventana) → menor impacto marginal por momento.
- **Misma presión, más masa → menor movimiento visible.** La fórmula exacta puede calibrarse; el comportamiento (más pesado y calmado a escala) no debe cambiar.
- No modelo lineal de conteo. Inercia por masa (p. ej. `1 / (1 + √total / MASS_INERTIA_REF)`). Misma entrada + mismo `referenceTime` + mismo `modelVersion` ⇒ misma salida.
- Ejemplo de intuición: con 10 momentos el mismo empuje mueve bastante el grado; con 10M casi no lo mueve. Ver ejemplos numéricos en `ARCHITECTURE_AT_SCALE.md`.

---

## 5. UI

- **Vista principal (hero, cielo, línea de lectura):** solo lectura (grado, resumen breve, mezcla). **Nunca** mostrar: número de momentos, density, signal counts, mass metrics, stability/ground index como copy principal.
- **Telemetría e internos:** solo en panel "i" o debug.
- **Criterio:** Si suena a lectura atmosférica, se siente espacio.

---

## 6. AI (futuro)

- Si hay capa AI (p. ej. Telescope): consume **snapshot** agregado; no calcula el grado ni modifica estado físico; no prescribe.
- **Physics leads. AI observes. UI reveals.**

---

## 7. Commit y push

- Respetar `.gitignore`. No commitear `remote.js` con valores reales ni `remote.local.js`, `PLAN_MASTER.md`, `supabase/.temp/`. Ver `.cursor/rules/remote-config-security.mdc`.

---

*Documento interno; no desplegar como página pública.*

# Contexto agente V5 — SlipUp Observatory

**Supersedido por:** `docs/AGENT_CONTEXT_V6.md` (identidad, física, arquitectura, UI y guardrails consolidados). Este archivo se mantiene por historial.

Documento de referencia para que el agente (y quien mantenga el proyecto) no confunda el estado actual con el "proyecto inicial". El sistema evolucionó de forma estructural.

---

## Evolución estructural (no cosmética)

Lo que nació como lectura local del "clima" es ahora un sistema **híbrido**:

- **Moment** sigue siendo la unidad mínima (no "error").
- El **cielo** sigue siendo instrumento (no dashboard).
- Existe un **canal compartido real**: momentos de otros entran al campo y la atmósfera deja de ser solo "mía".

### Antes vs ahora

| Antes | Ahora |
|-------|--------|
| Local-first: tu clima era el de tu dispositivo | Local-first **+ shared channel**: el dispositivo sigue vivo offline, pero con red el cielo se vuelve colectivo |

Esa evolución es la correcta para SlipUp: no rompe esencia, no introduce feed, no moraliza; solo amplía el "campo".

---

## Nuevo contrato del proyecto

### 1. Canal shared remoto con fallback local

- **Shared sky** ya no es metáfora: es **infraestructura**.
- Cuando hay red, el front usa Edge Functions (`moments`, `climate`, `relate`); cuando falla o no hay red, usa fallback local (localStorage, lectura local).
- El front es **render/animación + fallback**; la verdad del modelo (computed) puede migrar a servidor sin romper el front.

### 2. El cliente nunca toca tablas directo

- El front **nunca** accede a Supabase con queries directas a tablas.
- Toda lectura/escritura compartida pasa por **Edge Functions** (moments, climate, relate). RLS y lógica en el backend.

### 3. Shared = evidencia mínima (no consumo infinito)

- **Preview** y **sheet** siguen **acotados** (listas limitadas, ej. 6 en home, 50 en sheet).
- **Sin ranking**, sin feed infinito, sin métricas de comparación ni "clima emocional" como producto.
- Mantener el sistema **habitable**, no consultable como panel.

### 4. ComputedDegree migra a servidor en Fase 2

- Hoy el grado puede computarse en front o en backend según capa.
- En una futura Fase 2, el grado computado (computed degree) puede vivir en servidor; el front sigue siendo render + fallback.

---

## Riesgo a evitar

Al compartir, el peligro natural es que el sistema se convierta en: red social (feed), métrica, comparación o "clima emocional". La forma de mantenerlo como **Observatory** es la regla anterior: **shared = evidencia mínima**, no consumo infinito.

### Criterio de coherencia (copy y UI)

**Si suena a lectura atmosférica, se siente espacio.**  
Lo que se muestra en la hero y en las capas debe sonar a *lectura* (grado, resumen, mezcla), no a panel ni telemetría. Las cifras y etiquetas de instrumento (Global, N moments, density, tone, stability) quedan en el panel "i" o en internos; en la vista principal solo ancla que es lectura agregada (p. ej. "Reading from the last 48 hours.") y el resultado (grado + frase de mezcla).

---

## Resumen para el agente

- Existe **canal shared remoto** con **fallback local**.
- **Cliente nunca toca tablas**; solo Edge Functions.
- **Preview y sheet acotados**; sin feed ni ranking.
- **ComputedDegree** puede migrar a servidor en Fase 2; el front sigue siendo render + fallback.
- En **commit y push**: respetar `.gitignore`; no commitear `remote.js` con valores reales ni `remote.local.js`, `PLAN_MASTER.md`, `supabase/.temp/`. Ver regla de seguridad (config remota) en `.cursor/rules`.

*Documento interno; no desplegar como página pública.*

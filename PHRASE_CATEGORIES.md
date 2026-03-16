# Mapa de frases del Observatorio

Cada sección y elemento tiene **una categoría de frases** en un solo lugar. Así podés cambiar cada conjunto por **frases memorables** que inviten a entrar cada día a ver qué está pasando.

Sin AI para generar respuestas, las frases deben ser **conceptuales pero siempre legibles**: una lectura que se entienda a la primera y que represente bien el estado (de la materia / del campo / del observatorio).

---

## Principios para nuevas frases

- **Conceptual:** reflejan el estado (calma, subida, densidad, tensión, etc.) sin ser telemetría.
- **Legible:** lenguaje simple, juvenil si hace falta; que se entienda de un vistazo.
- **Memorable:** una frase que quede en la cabeza y motive a volver.
- **Pull diario:** sensación de “algo puede cambiar” — continuidad, ahora, “volvé a ver”.

---

## 1. Hero — identidad y contexto

| Elemento | Dónde | Variable / ubicación | Uso |
|----------|--------|----------------------|-----|
| **Título principal** | `app.js` | `UI_COPY.en.heroIdentityLine` / `UI_COPY.es.heroIdentityLine` | "Where human moments meet" — una sola frase por idioma. |
| **Eyebrow (capa)** | `app.js` | `UI_COPY.en.eyebrowLayer` / `UI_COPY.es.eyebrowLayer` | "Atmosphere" / "Atmósfera". En HTML está "Atmosphere — Current"; si querés "— Current" en ambos idiomas, unificarlo en estas claves. |
| **Value prop** | `app.js` | `UI_COPY.en.valueProp` / `UI_COPY.es.valueProp` | "Collective reading from shared moments" — debajo del hero, una frase. |
| **CTA microcopy** | `index.html` + `app.js` | Texto en `<p class="cta-microcopy">` y opcionalmente en UI_COPY | "Let the atmosphere read this moment." — invitación a contribuir. |

---

## 2. Señal en vivo (atmReadingLine)

**Archivo:** `atmosphere-signal.js`  
**Objeto:** `LABELS` (en / es) con tres estados: **quiet**, **rising**, **dense**.

- **quiet:** campo en calma, nada se mueve aún, lectura en espera.
- **rising:** algo está subiendo, señales reuniéndose, despertando.
- **dense:** campo lleno, pesado, capa cargada.

Son las **primeras frases que se leen** y representan **estados de la materia**. Conviene que sean cortas, claras y memorables.

---

## 3. Patrón en la lectura (#atmosphere-pattern-line)

**Archivo:** `app.js`  
**Función:** `renderPatternLayer()`  
**Variables locales:** `tagMap` (pattern_a, pattern_b, pattern_c) y `patternFallback`.

- **tagMap:** frases cuando hay patrón detectado (tensión repetida, mood repetido, clustering).
- **patternFallback:** frases cuando hay “eco/ritmo” pero sin tag concreto.

Ideas para reemplazo: mismo significado (patrón, ritmo, eco) con frases más memorables y pull (“seguí leyendo”, “mirá qué sigue”).

---

## 4. Clima 48h (atmosphericWeatherLine)

**Archivo:** `app.js`  
**Constante:** `ATMOSPHERIC_WEATHER_LABELS` (en / es).

Cuatro estados: **calm**, **reflective**, **tension**, **release**. Cada uno es un array de frases; se elige una al azar según el estado del campo en las últimas 48h.

Deben diferenciarse de `atmReadingLine` (no repetir “Calm layer”, etc.) y sonar a **parte del tiempo** del observatorio: “qué tiempo hizo en el campo”.

---

## 5. Caption del tiempo 48h (atmosphericWeatherCaption)

**Archivo:** `app.js`  
**Variable:** `UI_COPY.en.atmosphericWeatherCaption` / `UI_COPY.es.atmosphericWeatherCaption`

Una sola frase por idioma. Ejemplo: "The atmosphere reflects the last 48 hours of moments." — explicación breve y conceptual.

---

## 6. Resumen de lectura (#climateSummaryLine)

**Archivo:** `uiCopy.js` (exportado) + lógica en `app.js` (`getReadingStatusLine`).

| Conjunto | Export / constante | Cuándo se usa |
|----------|--------------------|----------------|
| **READING_SUMMARY_STEADY** | `uiCopy.js` | 3–999 momentos. ~60 frases EN/ES. |
| **READING_SUMMARY_FALLBACK** | `uiCopy.js` | Total ≥ 1000 sin dominantMix. |
| **READING_SUMMARY_BY_MIX** | `uiCopy.js` | Total ≥ 1000 con type|mood dominante (ej. observed\|calm, fertile\|stressed). 75 combinaciones, 5 frases cada una. |
| **total < 3** | Dentro de `getReadingStatusLine` | Una frase fija tipo "Signals are gathering." |

Objetivo: voz del observatorio + **pull para volver** (“the read continues—check back”, “come see what the field holds”).

---

## 7. Orbital

| Elemento | Dónde | Notas |
|----------|--------|--------|
| **Título** | `index.html` | `<h3 class="orbital-title">Orbital</h3>` — estático. |
| **Kicker** | `index.html` | "UPPER LAYER" en el HTML. |
| **Subtítulo** | `index.html` | `<p class="orbital-subtitle">Instrument observation</p>`. |
| **Copy** | `index.html` | Dos `<p class="orbital-copy">` con el texto de la capa. |
| **Seed blocks** | `index.html` | "Constellations", "Field readings", "Signal clusters" — etiquetas. |
| **Transición al entrar** | `app.js` | `UI_COPY.en.orbitalTransitionLine` / `UI_COPY.es.orbitalTransitionLine` — "Entering orbital view". Se muestra al hacer scroll a Orbital. |

Para hacer todo el copy editable desde un solo lugar, se podría mover a UI_COPY y rellenar por JS.

---

## 8. Constelaciones de momentos

**Archivo:** `app.js`  
**Variables:** `UI_COPY.en.momentConstellationLine` / `UI_COPY.es.momentConstellationLine` y `momentConstellationRelatedLabel`.

- **momentConstellationLine:** "This moment is part of a constellation."
- **momentConstellationRelatedLabel:** "Connected moments" (aria-label de la lista de relacionados).

---

## 9. Resonancia (“Not alone”)

**Archivo:** `app.js`  
**Variable:** `UI_COPY.en.resonanceFeedback` / `UI_COPY.es.resonanceFeedback` — array de frases.

Se muestran al hacer clic en “Not alone” durante ~1 s. Ejemplos: "Signal shared.", "You are not alone.", "Another observer.", "Field expanded."

---

## 10. Otros copy del hero y capas

En `UI_COPY` (app.js) también están, entre otros:

- **emptyStateQuiet / emptyStateSignal** — estados vacíos.
- **momentRelateLabel** — "Not alone" (tooltip del botón).
- **strata**, **nearby**, **horizon**, **sheet**, **loading**, etc. — etiquetas y mensajes de cada sección.

Para cualquier texto que quieras hacer memorable o con pull diario, buscá la clave en `UI_COPY` o en los archivos indicados arriba.

---

## Resumen rápido por archivo

| Archivo | Qué frases contiene |
|---------|----------------------|
| **atmosphere-signal.js** | `LABELS` → atmReadingLine (quiet, rising, dense). |
| **app.js** | `ATMOSPHERIC_WEATHER_LABELS`, `UI_COPY` (hero, orbital transition, constellations, resonance, y mucho copy global), `tagMap` y `patternFallback` en `renderPatternLayer`. |
| **uiCopy.js** | `READING_SUMMARY_STEADY`, `READING_SUMMARY_FALLBACK`, `READING_SUMMARY_BY_MIX` y `getReadingStatusLine()` para #climateSummaryLine. |
| **index.html** | Orbital (título, subtitle, copy, seed labels), eyebrow inicial "Atmosphere — Current", cta-microcopy. |

Con este mapa podés **cambiar cada conjunto por frases memorables** que sigan siendo conceptuales y legibles, e inviten a entrar cada día a ver qué está pasando.

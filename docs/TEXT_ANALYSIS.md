# Análisis de texto en el Observatorio

El único texto que influye en el modelo es el campo **note** (Intention) de cada momento (máx. 19 caracteres). Hoy **toda la relación** entre ese texto y el clima se basa en **listas de tokens**: si una subcadena del texto coincide con un token, se cuenta; si no, se ignora.

---

## Cómo se reconoce el texto hoy

1. **Normalización:** minúsculas, NFD, sin acentos, trim.
2. **Detección:** el texto normalizado se recorre con `text.includes(token)` para dos listas:
   - **REFLECTIVE_TOKENS:** palabras asociadas a reflexión / calma / aprendizaje → suman a `reflective`.
   - **REACTIVE_TOKENS:** palabras asociadas a reacción / tensión / urgencia → suman a `reactive`.
3. **Señal:**  
   `reflective` y `reactive` se normalizan (divisor 2.5, cap 0.16) y se usan así:
   - **semanticPressure = reactive − reflective** → influye en la presión atmosférica (grado, tono).
   - **semanticStabilize = reflective × 0.75** → suma a la masa de estabilización (amortigua el movimiento del grado).

**Limitación:** Cualquier palabra que **no esté** en una de las dos listas no tiene ningún efecto. El contenido "no clasificado" se ignora por completo.

---

## Relaciones que dependen solo de las listas

| Variable / efecto | Depende del texto vía |
|-------------------|------------------------|
| reflective | Conteo de REFLECTIVE_TOKENS en la nota |
| reactive | Conteo de REACTIVE_TOKENS en la nota |
| semanticPressure | reactive − reflective |
| semanticStabilize | reflective × factor |
| atmosphericPressure (parte semántica) | semanticPressure × masa de recencia |
| stabilizeMass (parte semántica) | semanticStabilize × masa |
| computedDegree / toneReading | Derivados de presión y estabilización |

Si la nota tiene texto pero **ningún** token coincide → reflective = 0, reactive = 0 → la nota no aporta señal semántica (solo cuenta type + mood).

---

## Opciones para dar más utilidad al texto

### 1. Tratar explícitamente el "texto no clasificado"
- **hasUnmatchedText:** booleano "había texto pero ningún token hizo match".
- Permite en el código (y en analytics) distinguir "nota vacía" de "nota con contenido no clasificado".
- Opcionalmente: aplicar una señal muy pequeña cuando `hasUnmatchedText` (ej. neutral o ligero sesgo) en lugar de 0,0.

### 2. Ampliar las listas de tokens (sin nuevas dependencias)
- Añadir **variantes y sinónimos** a REFLECTIVE_TOKENS y REACTIVE_TOKENS (p. ej. "learning", "learned" además de "learn"; "rushing", "rushed" además de "rush").
- Mantener una sola fuente de verdad (modelConstants) y documentar el criterio de cada token.

### 3. Raíces / stemmer ligero
- Reducir cada palabra de la nota a una raíz (stem) y comparar con tokens también stemizados.
- Ej.: "learning" → "learn", "aprendiendo" → "aprend".
- Ventaja: más cobertura con las mismas listas. Coste: mantener un stemmer mínimo EN/ES en el cliente y en el backend.

### 4. Herramienta externa (API)
- Servicio de sentimiento o de embeddings que devuelva un score (reflective/reactive) por texto.
- Ventaja: mejor "comprensión" del texto. Coste: latencia, costo, privacidad, dependencia. Requiere diseño de fallback cuando la API falle o no esté disponible.

### 5. Heurísticas adicionales (sin listas)
- Ej.: longitud de la nota, signos de exclamación, interrogaciones.
- Podrían modular ligeramente la señal (ej. más peso cuando hay más texto y hay match). No sustituyen a las listas; las complementan.

---

## Recomendación de implementación

- **Corto plazo:**  
  - Introducir **hasUnmatchedText** en la salida de `noteSignal` y documentar que "solo las listas de tokens" definen reflective/reactive.  
  - Ir **ampliando las listas** con variantes (plurales, conjugaciones, sinónimos) para mejorar cobertura sin nuevas herramientas.

- **Medio plazo:**  
  - Valorar un **stemmer ligero** (solo reglas, sin diccionario) para EN/ES y aplicarlo tanto al texto como a los tokens antes de hacer el match.

- **Largo plazo:**  
  - Si se necesita más "inteligencia" sobre el texto, evaluar una **API de análisis** con fallback a token-list + hasUnmatchedText.

---

## Dónde se define y usa

- **Tokens:** `modelConstants.js` (frontend), `supabase/functions/_shared/modelConstants.ts` (backend). La Edge Function `moments` importa REFLECTIVE_TOKENS, REACTIVE_TOKENS, NOTE_SIGNAL_CAP y NOTE_SIGNAL_DIVISOR desde `_shared/modelConstants.ts` para una sola fuente de verdad.
- **noteSignal:** `app.js`, `computeClimate.ts`, `moments/index.ts` (agregados con reflective_sum/reactive_sum). La salida incluye `hasUnmatchedText` cuando hay texto pero ningún token coincide.
- **Uso:** `calculateClimate` (app.js), `computeClimate` (backend), y agregados por bucket en la Edge Function de climate.

Mantener las listas de tokens en un solo lugar y sincronizadas entre frontend y backend (ver MODEL_DESIGN_AND_CALIBRATION.md).

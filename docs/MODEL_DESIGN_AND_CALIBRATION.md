# Diseño y calibración del modelo del Observatorio

Documento de referencia sobre las decisiones de diseño, la calibración actual y cuándo conviene (o no) aumentar la complejidad del sistema.

---

## 1. Diseño del modelo

### 1.1 Filosofía de diseño

- **Una sola lectura por ventana:** no hay estado persistente entre ventanas; cada llamada agrega los momentos de las últimas 48 h y produce un grado. Simple de razonar y de auditar.
- **Salida acotada:** el grado vive en [0, 100] por construcción (clamp + tanh). No hay explosión con muchos usuarios.
- **Semántica estable:** type (avoidable / fertile / observed) y mood (calm, focus, stressed, curious, tired) definen una tabla de influencia fija; la nota aporta una señal suave (reflexivo vs reactivo) sin dominar.

### 1.2 Decisiones de diseño actuales

| Elemento | Valor / regla | Rol en el diseño |
|----------|----------------|-------------------|
| **BASELINE** | 28 | Centro de la escala; “sin señal” o mezcla neutra se queda cerca de 28. |
| **SCALE** | 100 | Techo del grado; da margen hacia arriba (condense) y hacia abajo (clear) desde 28. |
| **RECENCY_HALFLIFE_HOURS** | 18 | Dentro de 48 h, lo reciente pesa más; 18 h equilibra “últimas horas” vs “ayer”. |
| **RESPONSE_AMPLITUDE** | 20 | Cuánto se puede alejar el target del baseline; con tanh limita el rango de movimiento. |
| **pressureNormalizer** | `2·√(fieldMass) + 80` | Evita que la presión crezca linealmente con N; con millones de momentos el grado sigue acotado. |
| **tanh(normalizedPressure · 2.2)** | factor 2.2 | Sensibilidad de la curva: más grande = más respuesta ante misma presión normalizada. |
| **warmupFactor** | `min(1, fieldMass/6)` | Con poca masa (< 6 equivalente) la respuesta es más cauta; evita saltos con 1–2 momentos. |
| **chooseAlpha** | 0.12 / 0.17 / 0.2 por tramos de mass | Cuánto se acerca el grado al “target” en un paso; más bajo = más inercia. |
| **Bandas condition** | 38, 60, 74 | Límites entre quiet / balance / gathering / dense; definen el copy y la narrativa. |
| **derivePressureMode** | delta ≥ 4.5 → condensing, ≤ -3.5 → clearing | Umbrales para etiquetar tendencia (hPa) sin depender solo del patrón. |
| **Tabla INFLUENCE** | 15 celdas type×mood | avoidable → condense (strength 0.35–1.0), fertile → clear (0.22–0.7), observed → stabilize (0.14–0.3). |
| **NOTE_SIGNAL_CAP** | 0.16 | La nota no puede aportar más de ±0.16 a la presión normalizada; evita que un solo texto domine. |
| **Repetition** | pattern_a/b/c, strength 0.22–0.6, nudge ×2.4 × repetitionDamping | Refuerza el grado cuando hay patrones estructurales (evitables estresados repetidos, etc.). |

El diseño prioriza **interpretabilidad** y **estabilidad** sobre maximizar sensibilidad o añadir más variables ocultas.

### 1.3 Lo que no está en el diseño (a propósito)

- No hay aprendizaje automático de pesos: la tabla de influencia y las constantes son fijas y revisables por humanos.
- No hay filtro recursivo (Kalman, EWMA entre ventanas): cada ventana es independiente.
- No hay geografía en el núcleo del cálculo: el mismo `computeClimate` sirve para global o por bucket; la agregación por geo es previa.
- No hay “revolt meter”: la escala es densidad del campo, no conflicto social.

---

## 2. Calibración del modelo

### 2.1 Calibración actual

Hoy la calibración es **manual y heurística**: constantes y umbrales se eligieron para que el grado no salte con pocos momentos ni sature con muchos. **Fuente única de verdad:** `supabase/functions/_shared/modelConstants.ts` (backend). El frontend usa `modelConstants.js` en la raíz del proyecto como espejo; hay que mantenerlo al día al cambiar constantes en el backend (ver comentario en modelConstants.js).

### 2.2 Cómo mejorar la calibración sin cambiar el diseño

1. **Centralizar constantes**  
   Pasar BASELINE, RESPONSE_AMPLITUDE, RECENCY_HALFLIFE_HOURS, factor de tanh, warmup 6, alpha por tramos, bandas 38/60/74 y umbrales de pressureMode a un único archivo o config (por ejemplo `modelConstants.ts` o env) para poder ajustar sin tocar la lógica.

2. **Registro y análisis**  
   Loggear (en agregado, sin PII) por ventana: `total`, `fieldMass`, `atmosphericPressure`, `computedDegree`, `pressureMode`, `stabilityIndex`. Con el tiempo se puede ver distribución del grado, tiempo en cada banda y correlaciones con eventos o volumen.

3. **A/B de constantes**  
   Probar variantes (por ejemplo RESPONSE_AMPLITUDE 18 vs 22, o bandas 36/58/72) en un pequeño % de tráfico y comparar métricas de producto (retención, uso del observatorio) o cualitativos (feedback).

4. **Revisión periódica de tokens**  
   Los REFLECTIVE_TOKENS y REACTIVE_TOKENS pueden ampliarse o afinarse con ejemplos reales de notas (anonimizados) para que la señal semántica siga alineada con la intención del producto.

### 2.3 Calibración “con datos” (futura)

Si más adelante se quisiera calibrar con datos:

- **Objetivo:** podría ser “grado que mejor predice X”, donde X es una métrica de producto o una etiqueta humana (p. ej. “esta ventana se sintió densa”). No es obligatorio; el modelo puede seguir siendo solo heurístico.
- **Método:** mantener la estructura actual (tanh, normalizer, bandas) y optimizar solo constantes (amplitud, factor tanh, bandas) por mínimos cuadrados o similar sobre un conjunto de (ventana → grado_deseado). No hace falta pasar a un modelo negro tipo red neuronal.
- **Riesgo:** sobreajustar a un dataset pequeño o sesgado; conviene validación temporal y revisión de sentido común de los valores obtenidos.

---

## 3. ¿Debemos mejorar la complejidad del sistema?

### 3.1 Cuándo **no** conviene aumentar complejidad

- **Si el producto está bien servido con la lectura actual:** un solo número (grado) + tendencia + balance + concentración ya comunica “clima”. Añadir más variables ocultas o más no linealidades sin un objetivo claro aumenta mantenimiento y riesgo de bugs.
- **Si no hay datos para calibrar:** más parámetros sin proceso de calibración o revisión empeoran la interpretabilidad y pueden empeorar el comportamiento en la práctica.
- **Si la latencia o el coste importan:** el modelo actual es O(N) por ventana y sin dependencias externas (ML, APIs). Aumentar complejidad a veces implica más CPU o más llamadas.

Recomendación: **mantener la complejidad actual** mientras no haya un requisito concreto (métrica, feature o problema de comportamiento) que lo justifique.

### 3.2 Cuándo **sí** podría tener sentido

- **Más escalas temporales:** por ejemplo una lectura “rápida” (últimas 6 h) además de la de 48 h. Implica una segunda ventana y posiblemente una segunda salida (grado_corto); la lógica interna puede ser la misma (`computeClimate` con otro `windowHours`).
- **Desglose por tipo o mood en la API:** ya se expone `dominantMix`, `stabilityIndex`, `groundIndex`. Si el producto pide “qué mood sube más el grado esta semana”, se puede exponer más agregados sin cambiar el núcleo del cálculo.
- **Suavizado entre ventanas:** si se percibe “saltos” molestos al pasar de una ventana a la siguiente, se podría introducir un EWMA del grado en el cliente o en una capa del backend, **sin** tocar la definición del grado por ventana (seguiría siendo la misma fórmula).
- **Patrones adicionales:** más tags de repetición (pattern_d, e…) si se definen reglas claras y se documentan. Aumenta algo la complejidad de diseño pero no el orden del sistema.
- **Señal de nota más rica:** por ejemplo más cap en reflexivo/reactivo, o pesos por token, o detección de idioma. Aumenta parámetros y posiblemente necesidad de calibración.

### 3.3 Qué evitar al “mejorar”

- **No** añadir capas ocultas o modelos ML pesados solo por tener “IA”: el valor actual está en la transparencia y la coherencia momento → grado.
- **No** romper la propiedad “mismos inputs → mismo grado” (determinismo) sin una razón muy clara.
- **No** duplicar constantes entre front y backend: un solo lugar de verdad (shared o config servidor) y el cliente solo para visualización y copy.

---

## 4. Resumen

| Tema | Recomendación |
|------|----------------|
| **Diseño** | Mantener filosofía: una lectura por ventana, salida acotada, semántica type/mood/note estable. Documentar cada constante en código o en este doc. |
| **Calibración** | Centralizar constantes, registrar agregados por ventana, revisar tokens con el tiempo. Calibración con datos solo si hay objetivo y dataset definidos. |
| **Complejidad** | No subirla por defecto. Valorar solo si hay requisito claro (métrica, feature, suavizado). Priorizar cambios que mantengan O(N) y un solo lugar de verdad para el modelo. |

El observatorio está en un punto donde **diseño y calibración son mejorables de forma iterativa** (constantes, observabilidad, A/B) **sin aumentar la complejidad del sistema** hasta que el producto o los datos pidan algo más.

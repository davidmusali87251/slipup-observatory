# Observatory: arquitectura visual final a escala

Cuando SlipUp opere con **cientos de miles o millones de momentos**, la interfaz debe volverse **más simple, más pesada y más calmada**.

La ley:

```
más datos → más masa → menos ruido visible
```

Este documento define la **arquitectura visual final** del Observatory a escala, para que futuros cambios no rompan la esencia del producto.

---

# Principio central

A medida que el sistema crece, la interfaz debe ser:

* más calmada
* más lenta
* más pesada
* más simple

Nunca más orientada a métricas ni más ruidosa.

---

# Estructura vertical del Observatory

El scroll debe preservar esta **geografía descendente**:

```
Atmosphere (cielo compartido)
↓
Recent (llovizna humana global)
↓
Nearby (campo humano cercano)
↓
Horizon (línea personal que se forma)
↓
Strata (sedimento personal)
```

Cada capa responde a una pregunta distinta.

---

# 1. Atmosphere — cielo compartido

Lectura atmosférica global.

### Qué debe mostrar

* **Atmosphere**
* **Reading from the last 48 hours.**
* **[grado]** (ej. 28°)
* **una sola línea de lectura:** Quiet. / Steady. / Holds. / Condensing. / Opening.
* **CTA:** Contribute a moment / Let it rise into the atmosphere.
* **Confianza:** No account. No exact pin. Just shared moments.

### Qué no debe mostrar nunca

* telemetría visible
* conteos
* densidad
* “global”
* métricas de sistema

### Sensación

Con millones de momentos: **pesado**, **estable**, **lento**, casi meteorológico. El número no “salta”; **respira**.

---

# 2. Recent — llovizna humana global

Textura que muestra que la atmósfera está hecha de momentos reales.

### Qué muestra

* sin título obligatorio
* línea opcional muy sutil: **Across the atmosphere.**
* 6–10 momentos compartidos visibles
* **View more** → sheet limitado (no infinite scroll)

Formato de momento:

```
Observed · Focus · Working Alone
01:58 AM · Jerusalem
```

### Restricciones

* no infinite scroll
* no “latest updates”
* no popular moments
* no sensación de timeline

### Sensación

**Humedad en el aire.** No contenido.

---

# 3. Nearby — campo humano cercano

Devuelve **escala humana** cuando el cielo ya es muy pesado y abstracto.

### Qué muestra

* **Nearby**
* línea muy corta: **Local field reading.** o solo la lectura: **Quiet.** / **Forming.** / **Light movement.**
* **Moments nearby**
* 6–10 momentos cercanos reales (ubicación gruesa: Jerusalem, coarse bucket)

### Qué no debe mostrar

* density
* field scope
* wider field
* métricas técnicas

### Sensación

**Escuchar el aire alrededor.** No analytics regionales.

---

# 4. Horizon — línea personal que se forma

Interpreta **los momentos recientes del usuario**.

### Qué muestra

* **Horizon**
* **línea principal:** Forming. / Leans to observed. / Holds. / Shifting.
* **línea pulse:** Still gathering. / Steady pace. / Slow drift.
* botón mínimo: **Deeper**

### Reglas

* corto
* observacional
* no analítico
* no exponer mecánicas del modelo

### Sensación

**Línea de horizonte que empieza a dibujarse.** No insight engine.

---

# 5. Strata — tierra personal

Estructura a largo plazo formada por los momentos del **mismo usuario**. Con millones arriba, abajo aparece **mi propia tierra**.

### Qué muestra

* **Strata**
* línea contextual mínima: **Below the surface, your moments settle.**
* 2–3 sedimentos (máximo 4)

Ejemplo:

```
Observed calm returns after stress.
Avoidable tension gathers late.
Fertile openings follow fatigue.
```

### Qué no debe mostrar nunca

* porcentajes
* density
* trend arrows
* stability scores
* tone
* “deep mix: low”
* reportes

### Sensación

**Inscripciones en tierra.** No panel profundo.

---

# Reglas de descenso visual

Al bajar por el Observatory:

### Espacio

Más espacio vertical hacia Strata. Variables tipo:

* `--descent-gap-nearby`
* `--descent-gap-horizon`
* `--descent-gap-strata`

Strata tiene la mayor respiración vertical.

### Contraste

El contraste **decrece** al descender:

* Atmosphere → más contraste
* Nearby → medio
* Horizon → más suave
* Strata → más quieto

El texto en Strata debe sentirse como **inscripciones**.

### Fondo

Transición sutil hacia un tono **más cálido / más oscuro** en Strata (cielo → tierra). Siempre sutil.

---

# Comportamiento a gran escala

Con millones de momentos:

* **Atmosphere:** el grado se mueve **lento y pesado**. Evitar cambios rápidos.
* **Recent / Nearby:** mostrar siempre 6–10 momentos. No aumentar el tamaño de la lista.
* **Horizon:** se vuelve más confiable.
* **Strata:** más estable, cambia raramente.

---

# Direcciones de diseño prohibidas

No introducir:

* dashboards
* paneles de insights
* gráficos de tendencias
* métricas de popularidad
* contadores de engagement
* feeds con infinite scroll

SlipUp debe seguir siendo **un instrumento atmosférico**, no un producto de analytics social.

---

# Frase resumen

**A shared sky above, a personal earth below.**

O más funcional:

**Shared atmosphere above. Personal sediment below.**

La interfaz debe sentirse **menos como una app y más como un lugar**: estar dentro de un sistema de clima humano.

---

# Reglas de lenguaje

El tono del sistema se protege con vocabulario coherente.

**Preferir en copy y UI:**

* reading, field, atmosphere, mix, signal, settle, gather, rise, moment, layer

**Evitar:**

* score, performance, trend, improve, optimize, analytics, dashboard, engagement, metrics (en líneas narrativas)

Esto mantiene la metáfora atmosférica y evita que el producto suene a herramienta de productividad o analytics. En el código, `COPY_MODE` debe permanecer en `"narrative"` para que Horizon y condition usen copy observacional (Forming., Leans to X., Holds.); las variantes `clear`/`poetic` exponen "metrics", "score", "trend" en la UI.

---

# Regla de números

**Los números son raros.**

**Pueden aparecer en:**

* el grado atmosférico (Atmosphere)

**No deben aparecer en:**

* Horizon
* Strata
* líneas narrativas de lectura (Quiet., Steady., etc.)

Evitar en copy visible: porcentajes (62%), tendencias (+4%), densidad (1.2), stability scores. Romperían la metáfora de clima/geografía.

---

# Razones de retorno (modelo de producto)

SlipUp no depende de notificaciones, streaks, likes ni engagement loops. Las razones para volver son **contemplativas** y se apoyan en las tres capas:

1. **Ver cómo está el cielo** — Curiosidad atmosférica. "¿Cómo está el aire humano hoy?" Atmosphere responde con grado y lectura (Quiet., Condensing.). No requiere escribir nada.

2. **Reconocimiento en Strata** — "Esto me describe." El usuario vuelve para ver si el sistema sigue diciendo algo cierto. No para publicar.

3. **Sensación de campo humano** — Recent y Nearby muestran momentos reales (Working alone, Too much coffee). "No soy el único viviendo esto." Presencia humana ligera, sin interacción.

Ciclo: ver el cielo → sentir el campo → reconocerse en la tierra.

**Señal de que el producto funciona:** alguien abre solo para ver "Quiet." y cierra. Ya respondió su pregunta. Las sesiones cortas y repetidas son **saludables** para SlipUp; no hay que forzar sesiones largas.

---

# Referencia para Cursor / agentes

Al modificar el Observatory, respetar:

1. **Más datos → menos ruido visible.** No añadir métricas, conteos ni telemetría en las capas.
2. **Estructura vertical fija:** Atmosphere → Recent → Nearby → Horizon → Strata. Orden y roles no negociables.
3. **Recent y Nearby:** listas acotadas (6–10 ítems), View more, sin infinite scroll.
4. **Strata:** solo 2–4 líneas sedimentarias; sin porcentajes, tone, stability ni reportes.
5. **Atmosphere:** solo grado, una línea de lectura corta, CTA y confianza. Sin instrumento visible en hero.
6. **Lenguaje:** preferir reading, field, atmosphere, mix, signal, settle, gather; evitar score, performance, trend, optimize, analytics en narrativa.
7. **Números:** solo en el grado atmosférico; nunca en Horizon, Strata ni en líneas de lectura narrativas.

Ver también: `OBSERVATORY_FLOW_AND_LAYERS.md`, `OBSERVATORY_ALIVE_THRESHOLD.md`, `OBSERVATORY_GROWTH_PITFALLS.md`, `SLIPUP_MASTER_CONTEXT.md`.

---

# Appendix: Cursor prompt (at-scale)

Resumen para Cursor/agentes: SlipUp debe escalar a millones de momentos sin volverse dashboard ni feed. Principio: más datos → más masa → menos ruido visible. Estructura: Atmosphere → Recent → Nearby → Horizon → Strata. No telemetría en hero; listas 6–10 ítems, View more, sin infinite scroll; Strata 2–4 líneas, sin métricas. Prohibido: dashboards, insights, trending, infinite scroll. Lenguaje: preferir reading, field, atmosphere, signal, settle; evitar score, trend, optimize, analytics. Números solo en el grado; no en Horizon, Strata ni líneas narrativas. Frase: "A shared sky above, a personal earth below."

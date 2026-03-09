# Observatory flow and layers

El SlipUp Observatory se lee como **un solo instrumento atmosférico**, no como pantallas separadas. El flujo vertical es:

```
cielo → campo cercano → horizonte → sedimento
```

## Orden de capas (DOM y lectura)

| Orden | Capa        | Sección / ID       | Tiempo      | Responde a |
|-------|-------------|--------------------|-------------|-------------|
| 1     | **Atmosphere** | `#observatory-hero` | ahora       | ¿Cómo está el aire ahora? |
| 2     | **Nearby**    | `#local-climate`    | cerca       | ¿Qué está pasando cerca? |
| 3     | **Horizon**   | `#horizon`          | tendencia   | ¿Qué empieza a verse en mi línea? |
| 4     | **Strata**    | `#ground-strata`    | estructura  | ¿Qué estructura se forma en el tiempo? |

Cada capa **explica menos** y tiene **más tiempo** hacia abajo.

**Viaje vertical:** El scroll debe sentirse como **descender del cielo a la tierra**. Variables CSS `--descent-gap-nearby`, `--descent-gap-horizon`, `--descent-gap-strata` aumentan el espacio entre capas; Horizon y Strata suavizan el contraste (menos ruido); Strata usa tinte más cálido/oscuro y más aire. Arriba = clima humano; abajo = mi propia tierra.

**Regla de oro:** *Interpretation must never appear before human signals.* El orden Nearby → Horizon queda protegido: el usuario ve primero los momentos cercanos y después la lectura que se forma; nunca la interpretación antes que la evidencia humana.

## Reglas de diseño por capa

### 1. Atmosphere (el cielo)
- Una sola lectura; el número es protagonista.
- Sin telemetría: sin densidad, sin conteos.
- Calma visual.

### 2. Nearby (campo cercano)
- Solo momentos reales.
- Sin density, field scope, telemetría ni conteos sociales en vista.
- Humanidad local, no métricas.

### 3. Horizon (lo que decanta)
- Frases cortas y observacionales.
- No explicar el modelo ni mostrar cálculos.
- Lectura estructural de los momentos propios.

### 4. Strata (subsuelo)
- 2–5 líneas; cambian poco.
- Sin métricas, timeline ni archivo.
- Sedimentos estructurales.

## Principios globales

1. **Cada capa explica menos**: una lectura → momentos → una dirección → sedimentos.
2. **El usuario baja en profundidad**: no cambia de pantalla, desciende en el sistema.
3. **El sistema respira**: aire, campo humano, línea de lectura, estructura.

El Observatory debe sentirse como **un clima hecho de momentos humanos**, no como una app.

---

Ver también:
- **OBSERVATORY_ALIVE_THRESHOLD.md** — cuándo el sistema empieza a sentirse vivo (~300–500 momentos en 48 h) y fases por masa.
- **OBSERVATORY_GROWTH_PITFALLS.md** — riesgos al crecer (feed, telemetría, contenido, sobre-interpretación, inercia) y paradoja del crecimiento.
- **STRATA_AT_SCALE.md** — ley de Strata a escala: más silencio, menos líneas, lenguaje sedimentario, sin métricas visibles.
- **OBSERVATORY_AT_SCALE_MOMENTS.md** — comportamiento a 100k–1M momentos: inercia por masa, Nearby limitado, más datos → menos ruido → más calma.

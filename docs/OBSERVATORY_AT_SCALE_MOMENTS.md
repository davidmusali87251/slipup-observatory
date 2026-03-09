# Observatory a escala: 100k – 1M momentos

Cuando SlipUp llegue a **100k o 1M momentos**, el Observatory no solo tiene más datos: **cambia su comportamiento físico**. Hay dos problemas estructurales que casi todos los sistemas enfrentan en ese punto. La arquitectura actual ya está orientada a resolverlos.

---

## Problema 1: la atmósfera se vuelve caótica

Si el sistema simplemente suma momentos, el clima empieza a oscilar demasiado, reaccionar demasiado rápido y parecer ruido (ej. 28° → 32° → 25° → 31°). Eso destruye la sensación de **atmósfera real**.

**Solución (ya en marcha):** SlipUp debe comportarse como un **sistema con masa**.

- Regla: **más momentos → menos impacto marginal.**
- Inercia por masa: 10 momentos → un evento mueve ~1°; 10.000 momentos → un evento mueve ~0,01°.
- Con millones de momentos el clima debe sentirse **pesado, estable, creíble**, como un sistema meteorológico real.

---

## Problema 2: Nearby se convierte en feed

Con muchos usuarios, Nearby puede degenerar en scroll infinito y convertir SlipUp en red social.

**Solución (ya aplicada):** Nearby = **campo cercano limitado**.

- Máximo **6–10 momentos visibles** (p. ej. 3 visibles + “View more” hasta 6). Nunca más.
- Siempre **campo regional**, no global.
- Sensación: **escuchar voces cercanas**, no leer un timeline.

---

## Comportamiento de cada capa con masa

| Capa        | Con pocos datos     | Con millones                         |
|------------|----------------------|--------------------------------------|
| **Atmosphere** | Puede saltar         | **Muy estable**: 27,9° → 28,1° → 28,0°. Transmite clima real. |
| **Nearby**    | A veces vacío        | **Más humano**: siempre hay momentos cercanos; límite visual 6–10. |
| **Horizon**   | “Forming.”           | **Más confiable**: “Leans to observed.” → “Holds.” |
| **Strata**    | “A pattern may be forming.” | **Recuerda mejor**: “Observed calm returns after stress.” |

---

## Ley de escala

Con millones de momentos el Observatory debe sentirse:

- **Menos reactivo**
- **Más pesado**
- **Más lento**

La mayoría de apps se vuelven más rápidas, reactivas y ruidosas. SlipUp debe hacer **lo contrario**.

**Regla:** *Más datos → menos ruido → más calma.* Si pasa lo contrario, el Observatory se rompe.

---

## Efecto psicológico

Cuando el sistema tiene masa real, el usuario percibe:

- *“Mi momento entra en algo grande”* — contribuir al clima.
- No *“publicar”*.

A escala, el número del cielo deja de ser lo más interesante; la gente mira más **Nearby, Horizon y Strata**, porque ahí está **la humanidad del sistema**.

---

## Arquitectura que lo permite

```
Client → Edge functions → moments store → hourly buckets → computeClimate → cache → render
```

Con agregación por buckets (p. ej. 48 horarios), inercia por masa y límites de UI (Nearby acotado, Strata 2–3 líneas), se puede escalar a millones sin romper la experiencia.

---

Ver también: `OBSERVATORY_ALIVE_THRESHOLD.md`, `STRATA_AT_SCALE.md`, `OBSERVATORY_GROWTH_PITFALLS.md`, `ARCHITECTURE_AT_SCALE.md`.

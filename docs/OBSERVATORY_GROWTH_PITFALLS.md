# Riesgos al crecer: qué puede matar un observatorio humano

Cuando el sistema empieza a tener vida propia, el mayor riesgo ya no es la falta de usuarios, sino **cambiar el sistema para “mostrar más actividad”**. Estos patrones suelen matar proyectos tipo observatorio.

## La decisión más peligrosa: "Across the atmosphere" como feed

**Objetivo de diseño:** que esa sección **no parezca un feed**. Justo al revés: debe sentirse como señales del aire, no como timeline ni actividad.

La tentación más dañina al crecer es convertir la sección tipo *"Across the atmosphere"* (momentos recientes) en **un feed de actividad**: más momentos, orden por popularidad/reciente, scroll infinito, "actividad del sistema".

**Qué rompe:** SlipUp se basa en *momentos → atmósfera*. Si se muestran demasiados momentos, el usuario deja de percibir **el campo** y empieza a percibir **posts individuales**. El foco pasa de *el cielo* a *quién dijo qué*.

### Reglas que protegen la sección

| Regla | Motivo |
|-------|--------|
| **6–8 momentos** (ideal); **máximo 10** | El cerebro percibe 6–10 como un *campo*; más se convierte en *lista*. |
| **Sin scroll infinito** en esa sección | Infinito = feed. La sección es una **ventana al aire**, no un timeline. |
| **Sin orden explícito** (popularidad, "más recientes primero" como narrativa) | Evitar sensación de ranking o actividad. |
| **Más datos del sistema → menos ruido visible** | A escala, la interfaz debe mostrar **menos**, no más. Más silencio, misma sensación de atmósfera. |

### Función real de la sección

"Across the atmosphere" **no es una lista**. Es simplemente **una ventana para ver de qué está hecho el aire**. Y el aire solo necesita unas pocas partículas visibles para sentirse real.

### Regla de oro

La sección **no debe parecer** un feed (ni timeline, ni activity, ni stream). Debe seguir siendo *señales del aire*, no *actividad de usuarios*. Si una mejora la acerca a feed, está rompiendo la arquitectura.

---

## 1. Convertir el campo en feed

**Qué pasa:** scroll infinito, orden por reciente/popular, “más actividad ahora”, conteos visibles.

**Efecto:** de *campo atmosférico* a *feed social* → ansiedad, competencia, comparación.

**SlipUp:** lectura sin juicio. Limitar preview (p. ej. 10), sheet con 50, **sin infinite scroll**. Mantenerlo así.

---

## 2. Mostrar telemetría

**Qué pasa:** “1,245 moments today”, “density 1.08”, “activity rising”.

**Efecto:** el observatorio se vuelve panel de métricas. El usuario interpreta números, busca tendencias, siente responsabilidad sobre el clima.

**SlipUp:** el clima debe percibirse como *algo que existe*, no como algo que hay que optimizar.

---

## 3. Convertir los momentos en contenido

**Qué pasa:** los momentos se ven como “posts” → frases más cuidadas, humor performativo, confesiones dramáticas, se pierde lo cotidiano.

**SlipUp:** se sostiene en lo cotidiano (*Working alone*, *Running late*, *Going to the gym*). Si se incentiva “contenido interesante”, se pierde la textura humana.

---

## 4. Interpretar demasiado

**Qué pasa:** insights, explicaciones, recomendaciones.

**SlipUp:** funciona diciendo poco (*Quiet.*, *Forming.*, *Leans to observed.*). La mente del usuario completa el significado. No explicar de más.

---

## 5. Olvidar la inercia del clima

**Qué pasa:** con muchos momentos, si el grado reacciona demasiado rápido parece artificial, manipulado, pierde credibilidad.

**SlipUp:** inercia basada en masa — el grado se mueve lentamente cuando hay masa suficiente. Mantenerla.

---

## Paradoja del crecimiento

Cuando SlipUp crezca, el objetivo **no** es mostrar más actividad. Es **mostrar menos, pero con más peso**:

- Menos números, menos texto, menos explicación
- Más sensación de campo

---

## Señal de que vas bien

Cuando alguien entra al Observatory y piensa algo como:

> “esto es raro, pero siento que describe algo real”

el sistema está funcionando. No necesita entender el modelo; solo sentir que el clima **refleja momentos humanos**.

---

## Rol de cada capa al crecer

Cada capa debe seguir la regla: **explicar menos que la anterior**.

- **Atmosphere** → estado global  
- **Nearby** → humanidad cercana  
- **Horizon** → lectura  
- **Strata** → estructura lenta  

---

## Prueba final del producto

Un buen observatorio se reconoce cuando:

1. Alguien contribuye un momento  
2. Vuelve horas después  
3. Mira el cielo  
4. Siente que algo cambió ligeramente  

sin saber exactamente por qué.

Si SlipUp logra eso, deja de ser una app y se convierte en **un lugar donde mirar el clima humano**.

---

## Diseño de observatorios reales

Los observatorios (meteorología, astronomía, sismología) no están diseñados para **maximizar interacción**. Están diseñados para **revelar algo que ya existe**.

SlipUp debe sentirse así:

- No estoy alimentando el sistema  
- Estoy observando algo que ya está pasando  

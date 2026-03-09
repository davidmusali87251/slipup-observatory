# SlipUp: métricas que realmente importan

SlipUp no es una red social ni un SaaS tradicional.

La forma de saber si **SlipUp está funcionando** no es con usuarios registrados, visitas, descargas ni tiempo en página.

La métrica que importa es otra.

---

## Moment Density

**Cuántos momentos por usuario activo** se generan en una ventana corta.

Pregunta clave:

> ¿La gente vuelve a nombrar momentos?

### Fórmula

```
moment density = total moments / active contributors
```

### Ejemplo

| usuarios     | momentos     | densidad |
| ------------ | ------------ | -------- |
| 100 usuarios | 120 momentos | 1.2      |
| 100 usuarios | 280 momentos | 2.8      |
| 100 usuarios | 600 momentos | 6.0      |

Cuando SlipUp empieza a funcionar de verdad, **la densidad sube**.

Porque la gente piensa:

> esto también es un momento

---

## Umbral importante

Un producto como SlipUp empieza a **sentirse vivo** cuando llega aproximadamente a:

```
3–5 momentos por persona en 48h
```

En ese punto pasan tres cosas:

### 1. Atmosphere gana masa

El clima deja de moverse por eventos aislados.

Empieza a sentirse **pesado y real**.

### 2. Nearby siempre tiene señales

Nunca se ve vacío.

Siempre hay **momentos humanos alrededor**.

### 3. Horizon empieza a ser interesante

Las lecturas dejan de ser solo:

```
Forming.
```

y pasan a ser:

```
Leans to observed.
Holds.
```

---

## La señal más poderosa

Hay un comportamiento que indica que el producto realmente está funcionando.

Cuando los usuarios empiezan a pensar:

```
esto también es un momento
```

Ejemplos reales:

* esperando el bus
* terminando el día
* demasiada cafeína
* pensando otra vez
* mirando por la ventana

Cuando el cerebro empieza a **mapear la vida en momentos**, SlipUp ya entró en su mente.

---

## Segunda métrica: retorno semanal

No es diaria.

Es semanal:

```
usuarios que vuelven a contribuir
```

Si alguien contribuye **más de una vez en una semana**, el modelo mental **se instaló**.

---

## Lo que NO importa medir

En SlipUp no necesitas:

* likes
* seguidores
* comentarios
* shares

El sistema no depende de interacción social directa.

Depende de **contribución silenciosa**.

---

## Indicador definitivo

Cuando alguien abre SlipUp solo para ver:

```
cómo está el cielo hoy
```

aunque no vaya a escribir nada.

Ese es el momento en que el Observatory **empezó a funcionar**.

---

## Curva típica de este tipo de producto

Los productos contemplativos suelen crecer así:

```
inicio → lento
masa crítica → estable
```

No crecen como redes sociales explosivas.

Crecen como **instrumentos que la gente consulta**.

---

## Una forma simple de medirlo

Métrica observable en el futuro:

```
% de visitas que terminan en "Contribute"
```

Si eso está alrededor de:

```
8–15%
```

es **muy bueno** para un producto contemplativo.

---

## La señal más bonita

Sabes que SlipUp está funcionando cuando alguien escribe algo como:

```
Running late
```

y siente que no está publicando algo.

Siente que está **dejando una pequeña huella en el clima humano**.

---

## Resumen

| Métrica / señal | Qué indica |
| ----------------- | ---------- |
| **Moment density** (momentos / contribuidor activo en ventana corta) | Si la gente vuelve a nombrar momentos |
| **Umbral 3–5 momentos/persona en 48h** | El producto empieza a sentirse vivo |
| **Usuarios que contribuyen >1 vez en una semana** | El modelo mental se instaló |
| **% visitas → Contribute en 8–15%** | Muy bueno para producto contemplativo |
| **Abrir solo para ver "cómo está el cielo"** | El Observatory ya funciona como instrumento |
| **Pensar "esto también es un momento"** | SlipUp entró en la mente del usuario |

---

See also: `OBSERVATORY_ALIVE_THRESHOLD.md`, `OBSERVATORY_AT_SCALE_MOMENTS.md`, `SLIPUP_MASTER_CONTEXT.md`.

---

## Implementación opcional: eventos

Si en el futuro se inyecta un hook de analytics (sin identidad, solo agregados), el cliente ya emite estos eventos cuando existe `window.__observatoryReportEvent`:

| Evento | Dónde | Uso |
|--------|--------|-----|
| `observatory_view` | index (al terminar boot) | Denominador: "visita" al observatorio |
| `contribute_view` | contribute (al cargar) | Visita a Contribute |
| `contribute_done` | contribute (tras envío correcto) | Contribución completada |

Con ellos se puede aproximar:

- **% visitas que terminan en Contribute:** `contribute_done / observatory_view` (o `contribute_view / observatory_view` para llegada a la página). Un 8–15% se considera muy bueno.

No se envía ningún payload de usuario; el hook es opcional y no hay analytics integrados por defecto.

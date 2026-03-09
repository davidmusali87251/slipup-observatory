# Control visual responsive — Mobile, Tablet, Web

Referencia para revisar que el Observatory y Contribute se vean y usen bien en móvil, tablet y escritorio.

---

## Breakpoints usados en el proyecto

| Rango | Uso en CSS | Dispositivo típico |
|-------|------------|--------------------|
| **&lt; 320px** | `max-width: 320px` | Móvil muy estrecho |
| **&lt; 360px** | `max-width: 360px` | Móvil pequeño |
| **&lt; 380px** | `max-width: 380px` | Móvil / back link short |
| **&lt; 420px** | `max-width: 420px` | Móvil |
| **&lt; 480px** | `max-width: 480px` | **Móvil** (límite principal) |
| **481px – 1024px** | `min-width: 481px` y `max-width: 1024px` | **Tablet** (portrait y landscape) |
| **&lt; 520px** | `max-width: 520px` | Contribute: topbar en columna |
| **&lt; 768px** | (implícito dentro de 1024) | Tablet portrait |
| **≥ 900px** | `min-width: 900px` | Strata / desktop |
| **≥ 1025px** | (por defecto) | **Web / escritorio** |

---

## Checklist por dispositivo

### Móvil (&lt; 480px)

- [ ] **Viewport:** `width=device-width, initial-scale=1.0, viewport-fit=cover` en todas las páginas.
- [ ] **Ancho:** `.page` ~94vw; padding horizontal suficiente (0.5rem mínimo).
- [ ] **Safe area:** `env(safe-area-inset-*)` en padding del body/page para muescas.
- [ ] **Touch targets:** Botones y enlaces principales ≥ 44px de altura (CTA, View more, Contribute, Back).
- [ ] **Grado (Atmosphere):** Tamaño legible sin zoom (clamp 3.2rem–4.6rem según ancho).
- [ ] **Texto:** Sin overflow horizontal; long words break o wrap.
- [ ] **Nearby / listas:** Legibles; momento (note) como señal principal.
- [ ] **Contribute:** Campos y botón accesibles; ejemplos visibles; topbar en columna si &lt; 520px.
- [ ] **Scroll:** Suave; sin saltos bruscos entre secciones.

### Tablet (481px – 1024px)

- [ ] **Ancho:** `.page` min(720px, 88vw); márgenes laterales cómodos.
- [ ] **Touch targets:** 44px mínimo en CTAs y botones (ya aplicado en el bloque 481–1024).
- [ ] **Paneles:** Padding y gaps coherentes; transición Horizon → Strata sin cortes.
- [ ] **Instrumento "i":** Posición correcta; no solapar grado ni condición.
- [ ] **Sheet (View more):** Altura máxima usable; lista con buen espacio.

### Web / escritorio (≥ 1025px)

- [ ] **Ancho máximo:** `.page` min(880px, 92vw); contenido centrado.
- [ ] **Hover:** Estados hover en enlaces y botones (no solo focus).
- [ ] **Strata:** Más aire vertical; transición de fondo cielo → tierra visible.
- [ ] **Contribute:** Formulario centrado y legible; no líneas demasiado largas.

---

## Reglas ya aplicadas en CSS

- **Body:** `-webkit-tap-highlight-color` suave para toques.
- **Tablet (481–1024):** `.cta-observatory`, `.text-button`, `.text-link` con `min-height: 44px`.
- **Móvil (&lt; 360px):** Reducción de padding y fuentes; grado con clamp; topbar compacto.
- **Contribute &lt; 520px:** Topbar en columna; back link con ellipsis; `max-width: 44vw` en el enlace.
- **Contribute &lt; 380px:** Back link corto (“Back”); fuentes más pequeñas.
- **Safe area:** `.page` usa `env(safe-area-inset-*)` en padding.

---

## Qué revisar manualmente

1. **iPhone SE / 320px:** Grado, CTA y listas sin desborde.
2. **iPhone 14 / 390px:** Contribute y Observatory con buen aire.
3. **iPad 768px:** Tablet portrait; touch targets y lectura.
4. **iPad 1024px:** Tablet landscape; mismo bloque 481–1024.
5. **Desktop 1280px+:** Contenido centrado; hover y espaciado.

---

## Archivos clave

- `index.html` — viewport meta.
- `contribute.html` — viewport meta.
- `styles.css` — todos los `@media` (mobile-first implícito con overrides por max-width).

Ver también: `OBSERVATORY_VISUAL_ARCHITECTURE_AT_SCALE.md` (descenso visual), `LAYER_BACKGROUNDS_COHERENCE.md`.

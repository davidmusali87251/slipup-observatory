# Coherencia de fondos y capas — SlipUp Observatory

Control de coherencia visual: cada capa usa la paleta del observatorio y la progresión **aire → horizonte → suelo → tinta** se respeta en los fondos.

---

## Paleta base (`:root`)

| Variable | Uso |
|----------|-----|
| `--bg` | Fondo más claro (atmósfera). |
| `--bg-deep` | Transición media. |
| `--bg-ink` | Fondo más denso (strata / base). |
| `--layer-air` | Capa “aire” (transparente). |
| `--layer-horizon` | Capa “horizonte” (tinte sutil). |
| `--layer-ground` | Capa “suelo” (tinte sutil). |
| `--layer-horizon-soft` | Transición horizonte (derivado de bg-deep + layer-horizon). |
| `--layer-ground-soft` | Transición suelo (derivado de bg-ink + layer-ground). |
| `--layer-border-soft` | Bordes entre capas (line + bg-ink). |
| `--card` | Paneles (superficie semitransparente). |

---

## Capas y fondos

### 1. Página (body + .page)
- **body:** Gradientes radiales y lineal con `--bg`, `--bg-deep`, `--bg-ink`; reacción a `--atmo`.
- **.page::before:** Degradado vertical suave (transparente arriba → `--bg-deep` / `--bg-ink` abajo) para coherencia con el scroll.

### 2. Upper / Topbar
- **.topbar:** Degradado de continuidad hacia arriba: `--layer-horizon` + `--bg` → transparente. Anticipa otra capa superior.

### 3. Observatory hero
- **.observatory-hero:** Sin fondo plano; solo sombras internas (inset) para continuidad:
  - Arriba: tinte `--layer-air` / `--layer-horizon` (continuidad hacia página superior).
  - Abajo: `--layer-horizon` y `--layer-ground` (continuidad hacia secciones siguientes).
- **::before:** Radiales con `--bg`, `--layer-air`, `--layer-horizon`.
- **::after:** Lineal de `--bg` → `--layer-horizon` → `--layer-ground`.

### 4. Panel observatory (Atmosphere)
- **.panel-observatory:** Degradado lineal: `--bg` / `--bg-deep` / `--card` arriba → `--layer-horizon` + `--card` abajo.
- **.atmosphere-air:** Hereda; sin fondo propio.
- **.atmosphere-grounding:** Sin fondo; línea de transición con `--line`.
- **.panel-observatory::after:** Transición hacia abajo con `--bg-deep`, `--layer-horizon`.

### 5. Panel recent (Shared moments)
- **.panel-recent:** `background: transparent` (se ve el body/page).
- **.panel-recent::before:** Transición desde el hero: radial + lineal con `--layer-horizon-soft`.

### 6. Panel horizon (Horizon line)
- **.panel-horizon:** Gradiente con `--layer-air` → `--layer-horizon` → `--layer-ground`; base con `--card` y `--layer-horizon-soft`. Borde con `--card`.
- **::before:** Borde superior con `--layer-horizon-soft`.
- **::after:** Transición inferior con `--layer-ground`.

### 7. Local climate (Nearby)
- **.local-climate:** Gradiente: transparente → `--layer-ground` → `--bg-deep`.
- **::after:** Banda de transición con `--layer-ground-soft`.

### 8. Ground strata (Strata)
- **.ground-strata:** Gradiente: `--layer-ground` → `--bg-ink`. Borde superior con `--layer-border-soft`.
- **::before:** Transición superior con `--layer-ground-soft`.

### 9. Contribute / otras páginas
- **.panel-contribute:** `background: transparent` para fundir con la página.
- Fondos de página (contribute, etc.): usar `--bg`, `--bg-deep` o degradados derivados para mantener coherencia.

---

## Reglas de coherencia

1. **No hex sueltos** para violetas/lavanda: usar `--bg`, `--bg-deep`, `--bg-ink`, `--layer-horizon`, `--layer-ground` o los derivados `-soft` / `-border-soft`.
2. **Orden conceptual:** Arriba más “aire” (claro/transparente), abajo más “tierra” (horizonte → ground → ink).
3. **Transiciones:** Los pseudo-elements (::before, ::after) que unen capas usan `--layer-*-soft` o `color-mix` con la paleta.
4. **Continuidad:** Hero y topbar usan tintes de la misma paleta para insinuar flujo hacia arriba/abajo.

---

## Revisión

Al añadir una nueva sección o cambiar fondos:
- Asignar la capa conceptual (aire / horizonte / suelo / tinta).
- Usar solo variables de `:root` o `color-mix(in oklab, var(--*), …)`.
- Actualizar este documento si se define una nueva capa o variable.

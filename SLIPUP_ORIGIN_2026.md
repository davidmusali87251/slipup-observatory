# Origen y autoría — SlipUp™ Observatory

Documento de referencia para acreditar la creación del sistema. Generado en marzo de 2026.

---

## 1. Fecha de creación del proyecto

- **Año de creación:** 2026  
- **Documento de origen:** marzo 2026  
- El proyecto SlipUp Observatory (V2) nace como reconstrucción limpia alineada con el modelo de observatorio atmosférico, sin carryover de una versión anterior en producción.

---

## 2. Concepto del observatorio

SlipUp™ Observatory no es una red social ni un dashboard. Es un **instrumento de lectura atmosférica** sobre momentos humanos compartidos.

- **Momento:** unidad mínima de aporte (una frase corta, tipo/mood, sin identificación ni ranking).  
- **Cielo / atmósfera:** lectura agregada en ventana de 48 horas; no telemetría ni métricas expuestas en hero.  
- **Canal shared con fallback local:** con red se usan Edge Functions (moments, climate, relate); sin red o si fallan, fallback local. El cliente nunca toca tablas directamente.  
- **Capas de lectura:** Atmosphere (grado, condición, resumen) → Recent (lista acotada) → Nearby (ámbito regional por buckets) → Horizon (transición shared/global) → Strata (sedimento, eco colectivo).  
- **Principios:** sin ranking, sin gamificación, sin lenguaje moral. Lenguaje observacional (quiet, gathering, holding, shifting, dense, unsettled). La UI revela fenómeno, no cifras crudas.  
- **Proximidad atmosférica:** la “región más cercana” en Nearby es la **siguiente en el orden conceptual** del observatorio que tenga actividad, no distancia geográfica ni métricas de proximidad.

*Physics leads. AI observes. UI reveals.*

---

## 3. Arquitectura del climate engine

El motor de clima (climate engine) agrega momentos en **ventana de 48 horas** por **buckets horarios**. No usa GPS ni coordenadas exactas; usa buckets regionales (timezone, país, zona cultural).

### Señales principales (v1)

- **Activity:** masa reciente normalizada en la ventana (log(1+mass) respecto a referencia). Peso típico ~0,45.  
- **Spread:** diversidad por `type` de momento (entropía normalizada). Peso ~0,35.  
- **Persistence:** continuidad de actividad en buckets (cuántos buckets tienen masa ≥ umbral). Peso ~0,20.  

### Grado e inercia

- **computedDegree** (0–100): combinación ponderada de Activity, Spread y Persistence.  
- **Inercia:** dependiente de masa; más masa total → menor impacto marginal por nuevo momento.  
- **Límite de movimiento:** variación máxima de grado por actualización (p. ej. MAX_DEGREE_DELTA) para evitar saltos bruscos.  

### Condition

Etiquetas observacionales fijas por bandas de grado (sin score visible):  
Quiet → Gathering → Holding → Shifting → Dense → Unsettled.

### Repetition

Detección de patrón estructural (hasPattern, tag, strength) sobre la ventana; reglas claras, sin interpretación libre.

La agregación se hace sobre **últimos 48 buckets horarios**; no full-table scan. `referenceTime` lo fija el servidor en GET /climate.

---

## 4. Capturas de la web

*(Añadir aquí capturas de pantalla del sitio en funcionamiento: vista principal del observatorio, hero con lectura atmosférica, lista Recent, panel Nearby, página Contribute. Sirven como prueba visual del estado del sistema en la fecha de este documento.)*

- Sitio de referencia: **https://www.slipup.io/**  
- Incluir al menos: hero con grado y línea de lectura, lista de momentos recientes, estado vacío de Nearby con “The field is quiet.” y eventual “Nearby signals”, y barra superior fija “SlipUp™ Observatory”.

---

## 5. Scroll, ritmo y estado vacío de Nearby (memoria del diseño)

SlipUp no tiene “scroll de contenido”: tiene **scroll de aire**. El desplazamiento es un movimiento suave entre capas, no una lista ni un feed. Cualquier elemento nuevo debe entrar en ese ritmo, no interrumpirlo.

### Estado vacío y “Señales cercanas”

- El **estado vacío** no es un error: es un estado atmosférico. Si no hay momentos en el ámbito actual, se muestra el mensaje principal (“No shared moments in this scope yet.” / “El campo está quieto.”) y, si existe otra región con actividad en el orden conceptual del observatorio, la sección **“Señales cercanas”** con 1–3 momentos reales.
- **“Señales cercanas”** es un eco, no un feed: sin tarjetas, sin bordes, sin sombras, sin “ver más”. Solo texto (nota + hora · región). La suficiente presencia para ser percibida, no para reclamar atención.
- **Región “más cercana”:** se elige por **orden conceptual** (siguiente región en la lista del observatorio con ≥1 momento), no por distancia geográfica ni por volumen. Sin métricas, sin proximidad cuantitativa.
- **Selección de momentos:** aleatoria entre los **últimos 10** de esa región; se muestran **1–3**. Sin “más recientes”, sin ranking, sin urgencia.
- **Silencio:** si no hay ninguna región con actividad, no se inventan ejemplos ni se simula movimiento. SlipUp acepta el silencio como parte del clima.
- **Espaciado:** el margen entre “El campo está quieto.” y “Señales cercanas” forma parte del ritmo (silencio → eco). En desktop ~1.75rem; en móvil algo menor para que sea pausa, no salto. La altura por señal se mantiene mínima para no cargar el scroll.

Ritmo del scroll: **silencio → eco → vacío**. Sin loops, sin carga infinita, sin presión.

---

## 6. Autor

**Autor del proyecto y del sistema:**  
**Selim D. Musali**

SlipUp™ es una marca del mismo autor.  
Copyright y titularidad del código: véase [LICENSE](LICENSE).

---

*Documento generado para dejar constancia del origen y la autoría del sistema SlipUp™ Observatory. Última actualización: marzo 2026.*

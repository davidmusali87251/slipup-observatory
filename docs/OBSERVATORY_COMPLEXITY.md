# Nivel de complejidad del Observatorio

*Definición desde la perspectiva de un ingeniero de sistemas y cálculos de primer nivel.*

---

## Resumen en una frase

**Sistema dinámico de orden bajo, no lineal, con ventana temporal fija, normalización por raíz de la masa y salida acotada por saturación (tanh): complejidad de cálculo baja; complejidad de diseño, moderada.**

---

## Desglose técnico

### Orden del sistema
- **Variables de estado efectivas:** unas pocas agregadas por ventana: `fieldMass`, `atmosphericPressure`, `stabilizeMass`, más un indicador discreto de patrón (repetition a/b/c). No hay integración en el tiempo más allá de la ventana deslizante.
- **Entradas por evento:** cada momento aporta (type, mood, note, timestamp) → contribución a presión y masa con peso de recencia. Dimensión de entrada: 15 celdas type×mood + señal de nota (reflexivo/reactivo) + tiempo.
- **Salida principal:** un escalar en [0, 100] (grado), más índices derivados (estabilidad, ground, pressureMode).

### Escalas temporales
- **Ventana de observación:** 48 h (parámetro configurable hasta 168 h).
- **Semivida de recencia:** 18 h — decaimiento exponencial para ponderar eventos recientes.
- No hay filtro recursivo tipo Kalman ni estado persistente entre ventanas; cada lectura es una agregación sobre la ventana.

### No linealidades
- **Normalización de presión:** `pressureNormalizer = 2·√(fieldMass) + 80` — crecimiento sublineal con la masa para que el grado no explote con muchos usuarios.
- **Saturación de respuesta:** `tanh(normalizedPressure · 2.2)` — salida acotada, comportamiento tipo “sistema estable”.
- **Ganancia adaptativa:** `alpha = f(fieldMass)` por tramos; `warmupFactor = min(1, fieldMass/6)` — respuesta más cauta con pocos datos.
- **Amortiguación:** por `stabilizeMass` y por `repetitionDamping` en función de `fieldMass`.

### Complejidad de cálculo
- **Por lectura:** O(N) en el número N de momentos en ventana; agregación en un paso, sin recursión. Patrones (a/b/c) son detecciones por umbrales y ventana deslizante acotada.
- **Complejidad algorítmica:** baja — adecuada para edge/server en tiempo real con ventanas de 48 h.

### Complejidad de diseño
- **Moderada:** elección de constantes (BASELINE 28, RESPONSE_AMPLITUDE 20, semivida 18 h), tabla de influencia type×mood, tokens semánticos y bandas de condición implica diseño deliberado y calibración, no deducción automática. Para diseño y calibración detallados, ver [MODEL_DESIGN_AND_CALIBRATION.md](MODEL_DESIGN_AND_CALIBRATION.md).

---

## Conclusión

El observatorio es un **sistema de agregación no lineal con ventana fija y salida acotada**, de bajo orden y costo de cálculo acotado linealmente. La complejidad está en la **definición del modelo** (influencias, recencia, saturación) más que en la **complejidad computacional**. Un ingeniero de sistemas lo clasificaría como **modelo de complejidad baja a moderada**, adecuado para producción y mantenible, con la salvedad de documentar bien las constantes y las bandas semánticas (steady, balance, gathering, dense).

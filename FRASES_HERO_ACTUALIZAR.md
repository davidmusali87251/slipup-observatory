# Listas de frases a actualizar — Hero (4 elementos)

Referencia para **atmReadingLine**, **atmosphericWeatherLine**, **atmosphere-pattern-line** y **climateSummaryLine**.  
Archivos a editar: `atmosphere-signal.js`, `app.js`, `uiCopy.js`.

---

## 1. atmReadingLine

**Archivo:** `atmosphere-signal.js` → objeto `LABELS`  
**Estados:** quiet | rising | dense (se elige según señal en vivo).

### EN
- **quiet:** Holding its breath. | Calm before something rises. | Resting for now. | Nothing moving yet. | Still reading. | The read is here. | Quiet in the field. | Waiting. | Calm layer. | No lift yet. | Still air. | Right now. | Something will stir.
- **rising:** Something is rising. | Stirring now. | A shift in the air. | Waking up. | Moments gathering. | The read is rising. | Here and now. | Lift in the air. | Waking. | Signals gathering. | Going up. | Moving. | See what's in the air. | It's happening.
- **dense:** Full tonight. | Heavy with signal. | The air is charged. | Thick read. | Weight in the layer. | A lot in the field. | Full. | Carrying weight. | Charged. | Heavy reading. | Dense with moments. | The layer speaks.

### ES
- **quiet:** Contiene la respiración. | Calma antes de que suba algo. | Descansando por ahora. | Nada se mueve aún. | Sigue leyendo. | La lectura está aquí. | Quieto en el campo. | Esperando. | Capa en calma. | Sin subida aún. | Aire quieto. | Ahora mismo. | Algo se va a mover.
- **rising:** Algo está subiendo. | Se agita ahora. | Un cambio en el aire. | Despertando. | Los momentos se juntan. | La lectura sube. | Aquí y ahora. | Subida en el aire. | Despertando. | Las señales se juntan. | Subiendo. | En movimiento. | Mirá qué hay en el aire. | Está pasando.
- **dense:** Lleno esta noche. | Pesado de señal. | El aire está cargado. | Lectura densa. | Peso en la capa. | Mucho en el campo. | Lleno. | Lleva peso. | Cargado. | Lectura pesada. | Denso de momentos. | La capa habla.

---

## 2. atmosphericWeatherLine

**Archivo:** `app.js` → `ATMOSPHERIC_WEATHER_LABELS`  
**Estados:** calm | reflective | tension | release (lectura últimas 48h).

### EN
- **calm:** All calm. | Light and easy. | Nothing heavy. | Clear and still. | Easy drift.
- **reflective:** Taking it in. | Inside weather. | Long echoes. | Waiting. | Quiet signal.
- **tension:** Restless. | Heavy in the air. | A lot going on. | Things are tight. | Weight.
- **release:** Clear sky. | Light is back. | Open air. | Letting go. | Ease.

### ES
- **calm:** Todo en calma. | Ligero y suave. | Nada pesado. | Claro y quieto. | Deriva tranquila.
- **reflective:** Se está procesando. | Clima adentro. | Ecos largos. | En espera. | Señal baja.
- **tension:** Inquieto. | Pesado en el aire. | Hay mucho. | Todo apretado. | Peso.
- **release:** Cielo claro. | Vuelve la luz. | Aire abierto. | Soltando. | Alivio.

---

## 3. atmosphere-pattern-line

**Archivo:** `app.js` → `renderPatternLayer()`: `tagMap` + `patternFallback`.

### EN
- **pattern_a:** Repeated strain in the read. | The read keeps going—with strain. | Strain in the read—see what shifts.
- **pattern_b:** Repeated mood in the field. | The field holds a mood—now. | Mood in the field—keep reading.
- **pattern_c:** Clustering in the window. | Clustering in the window—now. | The window shows a cluster—see it.
- **fallback:** Pattern in the reading—it continues. | Rhythm in the window—see what's next. | Collective echo in the read. | The read has a pattern—now. | Echo in the field—keep reading.

### ES
- **pattern_a:** Tensión repetida en la lectura. | La lectura sigue—con tensión. | Tensión en la lectura—mirá qué cambia.
- **pattern_b:** Estado de ánimo repetido en el campo. | El campo sostiene un estado—ahora. | Estado en el campo—seguí leyendo.
- **pattern_c:** Agrupamiento en la ventana. | Se agrupa en la ventana—ahora. | La ventana muestra un grupo—mirá.
- **fallback:** Patrón en la lectura—sigue. | Ritmo en la ventana—mirá qué sigue. | Eco colectivo en la lectura. | La lectura tiene patrón—ahora. | El campo hace eco—seguí leyendo.

---

## 4. climateSummaryLine

**Archivo:** `uiCopy.js` → `READING_SUMMARY_STEADY` (3–999 momentos).  
También existen `READING_SUMMARY_FALLBACK` y `READING_SUMMARY_BY_MIX` para total ≥ 1000.

### EN (60 frases — READING_SUMMARY_STEADY.en)
The field is listening. | Moments have a place here. | The air carries what we send. | We read the same sky. | Something sent is in the field. | The observatory holds the line. | The signal landed. | The field remembers what rises. | We're reading together. | What goes in the air remains. | The read includes what lands. | The moment entered the field. | The sky holds what we share. | The reading holds what rises. | The atmosphere notes what lands. | The line joined the mix. | The field sees what rises. | We're in the same window. | The contribution holds. | The read gathers what we send. | Something landed. | The observatory reads the field. | The air carries the moment. | We share this reading. | The field gathers what rises. | The field is open to what rises. | What is sent joins the read. | The sky reads what we offer. | The atmosphere holds the read. | The read holds what we share. | The signal is in the air. | The field welcomes what rises. | We're reading the same sky. | The line landed in the field. | The observatory carries the trace. | The air holds the contribution. | We're part of the same reading. | Signals settle in the air. | The field listens to what we send. | What was added is now in the field. | The sky includes the line. | Contributions live in the air. | We read what we share. | The field notes what lands. | The moment lives in the read. | The observatory reads what we share. | The air reads. | What was sent remains. | We're in the same field. | The line joins the reading. | The read continues—check back. | Something is shifting in the field—now. | The field is reading again. | What we share keeps the read alive. | The reading holds—see what rises next. | The field keeps reading. | The read is moving—now. | Come see what the field holds. | The atmosphere is reading—stay with it. | The read goes on.

### ES (60 frases — READING_SUMMARY_STEADY.es)
El campo está escuchando. | Los momentos tienen un lugar aquí. | El aire lleva lo que enviamos. | Leemos el mismo cielo. | Algo enviado está en el campo. | El observatorio sostiene la línea. | La señal aterrizó. | El campo recuerda lo que sube. | Estamos leyendo juntos. | Lo que sube al aire permanece. | La lectura incluye lo que aterriza. | El momento entró en el campo. | El cielo sostiene lo que compartimos. | La lectura sostiene lo que sube. | La atmósfera nota lo que aterriza. | La línea se sumó a la mezcla. | El campo ve lo que sube. | Estamos en la misma ventana. | La contribución se mantiene. | La lectura reúne lo que enviamos. | Algo aterrizó. | El observatorio lee el campo. | El aire lleva el momento. | Compartimos esta lectura. | El campo reúne lo que sube. | El campo está abierto a lo que sube. | Lo enviado se suma a la lectura. | El cielo lee lo que ofrecemos. | La atmósfera sostiene la lectura. | La lectura sostiene lo que compartimos. | La señal está en el aire. | El campo recibe lo que sube. | Leemos el mismo cielo. | La línea aterrizó en el campo. | El observatorio lleva la traza. | El aire sostiene la contribución. | Somos parte de la misma lectura. | Las señales se asientan en el aire. | El campo escucha lo que enviamos. | Lo sumado está ahora en el campo. | El cielo incluye la línea. | Las contribuciones viven en el aire. | Leemos lo que compartimos. | El campo nota lo que aterriza. | El momento vive en la lectura. | El observatorio lee lo que compartimos. | El aire lee. | Lo enviado permanece. | Estamos en el mismo campo. | La línea se suma a la lectura. | La lectura sigue—volvé a mirar. | Algo se mueve en el campo—ahora. | El campo está leyendo de nuevo. | Lo que compartimos mantiene la lectura viva. | La lectura se mantiene—mirá qué sube. | El campo sigue leyendo. | La lectura se mueve—ahora. | Vení a ver qué sostiene el campo. | La atmósfera está leyendo—quedate. | La lectura continúa.

---

## Nota sobre duplicados

Si **atmReadingLine** y **atmosphericWeatherLine** muestran lo mismo (ej. "Calm layer"), es porque en un mismo momento el estado en vivo es "quiet" y el tiempo 48h es "calm". Para evitarlo, no usar las mismas frases en ambos conjuntos: reservar palabras como "Calm layer" / "Capa en calma" solo para uno (por ejemplo atmReadingLine) y en ATMOSPHERIC_WEATHER_LABELS usar otras ("All calm.", "Todo en calma.", etc.).

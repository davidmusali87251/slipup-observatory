/**
 * SlipUp™ Observatory
 * Copy para #climateSummaryLine (línea de lectura del hero).
 * Primer módulo extraído desde app.js para reducir tamaño y facilitar pruebas.
 */

/** 100 frases para 3–999 momentos: voz del observatorio que incluye al usuario (versión pulida). */
export const READING_SUMMARY_STEADY = {
  en: [
    "The field is listening.",
    "Your moment has a place here.",
    "The air carries what you send.",
    "We read the same sky.",
    "Something you sent is in the read.",
    "The observatory holds your line.",
    "Your signal landed.",
    "The field remembers what rises.",
    "We're reading together.",
    "What you put in the air is here.",
    "The read includes you.",
    "Your moment entered the field.",
    "The sky holds what we contribute.",
    "You're part of the reading.",
    "The atmosphere notes what lands.",
    "Your line is in the mix.",
    "The field sees what rises.",
    "We're all in the same window.",
    "Your contribution holds.",
    "The read gathers what we send.",
    "Something landed because of you.",
    "The observatory reads you in.",
    "The air is richer with your moment.",
    "We share this reading.",
    "Your moment is in the field.",
    "The field is open to what you add.",
    "What you sent is part of the read.",
    "The sky reads what we offer.",
    "You're in the atmosphere now.",
    "The read holds what we contribute.",
    "Your signal is in the air.",
    "The field welcomes what rises.",
    "We're reading the same moment.",
    "Your line landed in the read.",
    "The observatory carries your trace.",
    "The air holds your contribution.",
    "We're part of the same reading.",
    "Your moment is in the window.",
    "The field listens to what we send.",
    "What you added is in the read.",
    "The sky includes your line.",
    "Your contribution is in the air.",
    "We read what we give.",
    "The field notes what lands.",
    "Your moment is part of the read.",
    "The observatory reads what we share.",
    "The air is reading with you.",
    "What you sent holds.",
    "We're in the same field.",
    "Your line is part of the reading.",
  ],
  es: [
    "El campo está escuchando.",
    "Tu momento tiene un lugar aquí.",
    "El aire lleva lo que envías.",
    "Leemos el mismo cielo.",
    "Algo que enviaste está en la lectura.",
    "El observatorio sostiene tu línea.",
    "Tu señal aterrizó.",
    "El campo recuerda lo que sube.",
    "Estamos leyendo juntos.",
    "Lo que pusiste en el aire está aquí.",
    "La lectura te incluye.",
    "Tu momento entró en el campo.",
    "El cielo sostiene lo que contribuimos.",
    "Formás parte de la lectura.",
    "La atmósfera nota lo que aterriza.",
    "Tu línea está en la mezcla.",
    "El campo ve lo que sube.",
    "Estamos en la misma ventana.",
    "Tu contribución se mantiene.",
    "La lectura reúne lo que enviamos.",
    "Algo aterrizó por vos.",
    "El observatorio te lee.",
    "El aire es más rico con tu momento.",
    "Compartimos esta lectura.",
    "Tu momento está en el campo.",
    "El campo está abierto a lo que sumás.",
    "Lo que enviaste es parte de la lectura.",
    "El cielo lee lo que ofrecemos.",
    "Estás en la atmósfera ahora.",
    "La lectura sostiene lo que contribuimos.",
    "Tu señal está en el aire.",
    "El campo recibe lo que sube.",
    "Leemos el mismo momento.",
    "Tu línea aterrizó en la lectura.",
    "El observatorio lleva tu traza.",
    "El aire sostiene tu contribución.",
    "Somos parte de la misma lectura.",
    "Tu momento está en la ventana.",
    "El campo escucha lo que enviamos.",
    "Lo que sumaste está en la lectura.",
    "El cielo incluye tu línea.",
    "Tu contribución está en el aire.",
    "Leemos lo que damos.",
    "El campo nota lo que aterriza.",
    "Tu momento es parte de la lectura.",
    "El observatorio lee lo que compartimos.",
    "El aire está leyendo con vos.",
    "Lo que enviaste se mantiene.",
    "Estamos en el mismo campo.",
    "Tu línea es parte de la lectura.",
  ],
};

/** Fallback cuando total >= 1000 y no hay dominantMix. Incluye frases de eco/ritmo colectivo. */
export const READING_SUMMARY_FALLBACK = {
  en: ["The reading holds.", "The field steadies.", "A layer forms.", "Signals settle.", "The mix holds.", "Steady in the window.", "The reading steadies.", "Moments in the field.", "The read holds a collective rhythm.", "Calm gathers after strain.", "The field echoes."],
  es: ["La lectura se mantiene.", "El campo se estabiliza.", "Se forma una capa.", "Las señales se asientan.", "La mezcla se mantiene.", "Estable en la ventana.", "La lectura se estabiliza.", "Momentos en el campo.", "La lectura sostiene un ritmo colectivo.", "La calma se reúne tras la tensión.", "El campo hace eco."],
};

/** 75 frases por type×mood para total >= 1000. */
export const READING_SUMMARY_BY_MIX = {
  en: {
    "observed|calm": ["Calm holds observed moments.", "Observed signals rest in calm.", "The reading stays quiet with observed moments.", "Calm carries simple observations.", "Observed moments settle in calm air."],
    "observed|focus": ["Focus sharpens observed moments.", "Observed signals gather in focus.", "The field reads observation through focus.", "Focus holds quiet observation.", "Observed moments move with focus."],
    "observed|stressed": ["Stress reveals observed moments.", "Observed signals surface under stress.", "The reading shows observation through stress.", "Stress sharpens observation.", "Observed moments appear under pressure."],
    "observed|curious": ["Curiosity carries observed moments.", "Observed signals follow curiosity.", "The field opens through observation.", "Curiosity reveals quiet signals.", "Observed moments travel with curiosity."],
    "observed|tired": ["Fatigue softens observed moments.", "Observed signals appear through fatigue.", "The reading slows into observation.", "Fatigue carries quiet noticing.", "Observed moments settle after effort."],
    "fertile|calm": ["Calm allows fertile moments.", "Fertile signals open in calm air.", "The field grows through calm.", "Fertile moments rest in calm.", "Calm carries quiet openings."],
    "fertile|focus": ["Focus brings fertile moments forward.", "Fertile signals gather through focus.", "The reading opens with focus.", "Focus sharpens fertile signals.", "Fertile moments follow attention."],
    "fertile|stressed": ["Fertile moments follow fatigue.", "Openings appear under pressure.", "The field holds tension and growth.", "Stress carries fertile signals.", "Fertile moments rise after strain."],
    "fertile|curious": ["Curiosity opens fertile moments.", "Fertile signals follow curiosity.", "The reading widens through curiosity.", "Curiosity reveals fertile traces.", "Fertile moments move with wonder."],
    "fertile|tired": ["Fatigue precedes fertile moments.", "Tired hours carry openings.", "The field softens into growth.", "Fertile moments follow rest.", "Fatigue leaves room for change."],
    "avoidable|calm": ["Calm reveals avoidable moments.", "Avoidable signals appear in calm air.", "The reading shows quiet mistakes.", "Calm exposes avoidable traces.", "Avoidable moments settle into view."],
    "avoidable|focus": ["Focus reveals avoidable moments.", "Avoidable signals surface in attention.", "The field sharpens around mistakes.", "Focus exposes avoidable traces.", "Avoidable moments appear under focus."],
    "avoidable|stressed": ["Stress gathers avoidable moments.", "Avoidable signals cluster under pressure.", "The reading tightens around mistakes.", "Stress reveals avoidable traces.", "Avoidable moments follow tension."],
    "avoidable|curious": ["Curiosity notices avoidable moments.", "Avoidable signals surface through curiosity.", "The field questions avoidable traces.", "Curiosity reveals quiet mistakes.", "Avoidable moments appear through wonder."],
    "avoidable|tired": ["Fatigue invites avoidable moments.", "Avoidable signals appear in tired hours.", "The reading loosens under fatigue.", "Fatigue carries avoidable traces.", "Avoidable moments follow long days."],
  },
  es: {
    "observed|calm": ["La calma sostiene momentos observados.", "Las señales observadas descansan en calma.", "La lectura se queda tranquila con momentos observados.", "La calma lleva observaciones simples.", "Los momentos observados se asientan en aire calmado."],
    "observed|focus": ["El foco afila momentos observados.", "Las señales observadas se reúnen en foco.", "El campo lee observación a través del foco.", "El foco sostiene observación tranquila.", "Los momentos observados se mueven con foco."],
    "observed|stressed": ["El estrés revela momentos observados.", "Las señales observadas afloran bajo estrés.", "La lectura muestra observación bajo estrés.", "El estrés afila la observación.", "Los momentos observados aparecen bajo presión."],
    "observed|curious": ["La curiosidad lleva momentos observados.", "Las señales observadas siguen la curiosidad.", "El campo se abre a través de la observación.", "La curiosidad revela señales tranquilas.", "Los momentos observados viajan con curiosidad."],
    "observed|tired": ["El cansancio suaviza momentos observados.", "Las señales observadas aparecen con el cansancio.", "La lectura se ralentiza en observación.", "El cansancio lleva una atención tranquila.", "Los momentos observados se asientan tras el esfuerzo."],
    "fertile|calm": ["La calma permite momentos fértiles.", "Las señales fértiles se abren en aire calmado.", "El campo crece a través de la calma.", "Los momentos fértiles descansan en calma.", "La calma lleva aperturas tranquilas."],
    "fertile|focus": ["El foco trae momentos fértiles al frente.", "Las señales fértiles se reúnen con el foco.", "La lectura se abre con foco.", "El foco afila señales fértiles.", "Los momentos fértiles siguen la atención."],
    "fertile|stressed": ["Los momentos fértiles siguen al cansancio.", "Las aperturas aparecen bajo presión.", "El campo sostiene tensión y crecimiento.", "El estrés lleva señales fértiles.", "Los momentos fértiles surgen tras la tensión."],
    "fertile|curious": ["La curiosidad abre momentos fértiles.", "Las señales fértiles siguen la curiosidad.", "La lectura se amplía con la curiosidad.", "La curiosidad revela trazas fértiles.", "Los momentos fértiles se mueven con asombro."],
    "fertile|tired": ["El cansancio precede momentos fértiles.", "Las horas cansadas llevan aperturas.", "El campo se suaviza hacia el crecimiento.", "Los momentos fértiles siguen al descanso.", "El cansancio deja espacio al cambio."],
    "avoidable|calm": ["La calma revela momentos evitables.", "Las señales evitables aparecen en aire calmado.", "La lectura muestra errores tranquilos.", "La calma expone trazas evitables.", "Los momentos evitables entran en vista."],
    "avoidable|focus": ["El foco revela momentos evitables.", "Las señales evitables afloran en la atención.", "El campo se afila en torno a los errores.", "El foco expone trazas evitables.", "Los momentos evitables aparecen bajo foco."],
    "avoidable|stressed": ["El estrés reúne momentos evitables.", "Las señales evitables se agrupan bajo presión.", "La lectura se tensa en torno a los errores.", "El estrés revela trazas evitables.", "Los momentos evitables siguen a la tensión."],
    "avoidable|curious": ["La curiosidad nota momentos evitables.", "Las señales evitables afloran con la curiosidad.", "El campo cuestiona trazas evitables.", "La curiosidad revela errores tranquilos.", "Los momentos evitables aparecen con el asombro."],
    "avoidable|tired": ["El cansancio invita momentos evitables.", "Las señales evitables aparecen en horas cansadas.", "La lectura se afloja bajo el cansancio.", "El cansancio lleva trazas evitables.", "Los momentos evitables siguen a días largos."],
  },
};

/**
 * Línea de lectura neutral para el hero (#climateSummaryLine): fenómeno, no telemetría.
 * total < 3 → cielo quieto; 3–999 → 100 frases observatorio; total >= 1000 → frases por mix type|mood.
 */
export function getReadingStatusLine(lang, total, seed = 0, dominantMix = "") {
  const quiet = lang === "es" ? "Las señales se reúnen." : "Signals are gathering.";
  if (total < 3) return quiet;
  if (total >= 1000) {
    const raw = String(dominantMix || "").trim();
    const key = raw.toLowerCase().replace(/\s*[·•]\s*/g, "|");
    const byMix = READING_SUMMARY_BY_MIX[lang]?.[key];
    const pool = Array.isArray(byMix) && byMix.length > 0
      ? byMix
      : READING_SUMMARY_FALLBACK[lang] || READING_SUMMARY_FALLBACK.en;
    const idx = Math.abs(seed) % pool.length;
    return pool[idx];
  }
  const pool = READING_SUMMARY_STEADY[lang] || READING_SUMMARY_STEADY.en;
  const idx = Math.abs(seed) % pool.length;
  return pool[idx];
}

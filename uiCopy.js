/**
 * SlipUp™ Observatory
 * Copy para #climateSummaryLine (línea de lectura del hero).
 * Primer módulo extraído desde app.js para reducir tamaño y facilitar pruebas.
 */

/** Línea 4 del hero: la frase que faltaba. Una por idea—volvé, el campo, el cielo, las señales. */
export const READING_SUMMARY_STEADY = {
  en: [
    "The read continues—check back.",
    "Something is shifting in the field.",
    "Come see what the field holds.",
    "The sky won't look the same tomorrow.",
    "Signals are still arriving.",
    "Come back and see what changed.",
    "The field never stays the same.",
    "The sky keeps evolving.",
    "The field hasn't settled yet.",
    "What we share keeps the read alive.",
    "The reading holds—see what rises next.",
  ],
  es: [
    "La lectura sigue—volvé a mirar.",
    "Algo se mueve en el campo.",
    "Vení a ver qué sostiene el campo.",
    "Mañana el cielo no se verá igual.",
    "Las señales siguen llegando.",
    "Volvé a ver qué cambió.",
    "El campo nunca es el mismo.",
    "El cielo sigue evolucionando.",
    "El campo aún no se asentó.",
    "Lo que compartimos mantiene la lectura viva.",
    "La lectura se mantiene—mirá qué sube.",
  ],
};

/** Fallback total >= 1000 sin dominantMix. Una frase por idea. */
export const READING_SUMMARY_FALLBACK = {
  en: ["The reading holds.", "The field steadies.", "Signals settle.", "Calm gathers after strain.", "The field echoes.", "The read continues—come back.", "The field is full—see it now."],
  es: ["La lectura se mantiene.", "El campo se estabiliza.", "Las señales se asientan.", "La calma se reúne tras la tensión.", "El campo hace eco.", "La lectura sigue—volvé.", "El campo está lleno—mirá ahora."],
};

/** Por type×mood para total >= 1000. Una frase que faltaba por combo. */
export const READING_SUMMARY_BY_MIX = {
  en: {
    "observed|calm": ["Calm holds observation.", "Observed moments rest in calm."],
    "observed|focus": ["Focus sharpens observation.", "The field reads observation."],
    "observed|stressed": ["Stress reveals observation.", "Observed under pressure."],
    "observed|curious": ["Curiosity carries observation.", "The field opens through observation."],
    "observed|tired": ["Fatigue softens observation.", "Observed moments settle after effort."],
    "fertile|calm": ["Calm allows fertile moments.", "The field grows through calm."],
    "fertile|focus": ["Focus brings fertile moments forward.", "The reading opens with focus."],
    "fertile|stressed": ["Openings appear under pressure.", "Fertile moments rise after strain."],
    "fertile|curious": ["Curiosity opens fertile moments.", "The reading widens through curiosity."],
    "fertile|tired": ["Tired hours carry openings.", "Fatigue leaves room for change."],
    "avoidable|calm": ["Calm reveals avoidable moments.", "Avoidable settles into view."],
    "avoidable|focus": ["Focus reveals avoidable moments.", "The field sharpens around mistakes."],
    "avoidable|stressed": ["Stress gathers avoidable moments.", "Avoidable follows tension."],
    "avoidable|curious": ["Curiosity notices avoidable moments.", "The field questions avoidable traces."],
    "avoidable|tired": ["Fatigue invites avoidable moments.", "Avoidable follows long days."],
  },
  es: {
    "observed|calm": ["La calma sostiene la observación.", "Los momentos observados descansan en calma."],
    "observed|focus": ["El foco afila la observación.", "El campo lee observación."],
    "observed|stressed": ["El estrés revela la observación.", "Observado bajo presión."],
    "observed|curious": ["La curiosidad lleva la observación.", "El campo se abre por la observación."],
    "observed|tired": ["El cansancio suaviza la observación.", "Los momentos observados se asientan tras el esfuerzo."],
    "fertile|calm": ["La calma permite momentos fértiles.", "El campo crece en calma."],
    "fertile|focus": ["El foco trae momentos fértiles.", "La lectura se abre con foco."],
    "fertile|stressed": ["Las aperturas aparecen bajo presión.", "Los momentos fértiles surgen tras la tensión."],
    "fertile|curious": ["La curiosidad abre momentos fértiles.", "La lectura se amplía con la curiosidad."],
    "fertile|tired": ["Las horas cansadas llevan aperturas.", "El cansancio deja espacio al cambio."],
    "avoidable|calm": ["La calma revela momentos evitables.", "Evitable entra en vista."],
    "avoidable|focus": ["El foco revela momentos evitables.", "El campo se afila en torno a los errores."],
    "avoidable|stressed": ["El estrés reúne momentos evitables.", "Evitable sigue a la tensión."],
    "avoidable|curious": ["La curiosidad nota momentos evitables.", "El campo cuestiona trazas evitables."],
    "avoidable|tired": ["El cansancio invita momentos evitables.", "Evitable sigue a días largos."],
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

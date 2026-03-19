/**
 * SlipUp™ Observatory
 * Copy para #climateSummaryLine (línea de lectura del hero).
 * Hero reading column: máx. 19 caracteres por línea (ancho UI).
 */

/** Límite de caracteres por línea en el bloque hero (climate / atm / tag). */
export const HERO_READING_LINE_MAX = 19;

/**
 * Recorta a max caracteres en límite de palabra; añade … si trunca.
 * @param {string} s
 * @param {number} [max]
 * @returns {string}
 */
export function clampHeroReadingLine(s, max = HERO_READING_LINE_MAX) {
  if (typeof s !== "string" || s.length === 0) return s;
  const t = s.trim();
  if (t.length <= max) return t;
  let cut = t.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > Math.floor(max * 0.5)) cut = cut.slice(0, lastSpace);
  else cut = cut.slice(0, max);
  cut = cut.trimEnd();
  if (cut.endsWith(",") || cut.endsWith("—")) cut = cut.slice(0, -1).trimEnd();
  return cut.length < t.length ? `${cut}…` : cut;
}

/** Línea 4 del hero: frases cortas (≤19). */
export const READING_SUMMARY_STEADY = {
  en: [
    "Read more on return",
    "Shift held in field",
    "Come see the field.",
    "A new sky tomorrow.",
    "Still more signals",
    "See new on return.",
    "Field always moving",
    "Sky still evolving",
    "Field unsettled yet",
    "Sharing sustains it",
    "Watch the next rise",
  ],
  es: [
    "Hay más al volver.",
    "El campo se mueve.",
    "Mirá el campo hoy.",
    "Mañana otro cielo.",
    "Llegan más señales.",
    "Volvé: algo cambió.",
    "Campo nunca igual.",
    "Cielo no se fija.",
    "Campo sin asentar.",
    "Compartir sostiene.",
    "Mirá qué surge acá.",
  ],
};

/** Fallback total >= 1000 sin dominantMix. */
export const READING_SUMMARY_FALLBACK = {
  en: [
    "The reading holds.",
    "The field steadies.",
    "Signals settle.",
    "Calm after strain.",
    "The field echoes.",
    "Read on—come back.",
    "Full field—see it.",
  ],
  es: [
    "Lectura firme aún.",
    "El campo se calma.",
    "Señales en reposo.",
    "Calma tras tensión.",
    "El campo hace eco.",
    "La lectura espera.",
    "Campo lleno: mirá.",
  ],
};

/** Por type×mood para total >= 1000. Cada frase ≤19. */
export const READING_SUMMARY_BY_MIX = {
  en: {
    "observed|calm": ["Watch held in calm.", "Held quiet in calm."],
    "observed|focus": ["Line stays in focus", "Field held in focus"],
    "observed|stressed": ["Strain on the watch", "Strain, still watch"],
    "observed|curious": ["Curious quiet watch", "Lean into wonder."],
    "observed|tired": ["Tired steady watch.", "Rest in the field."],
    "fertile|calm": ["Quiet room to grow.", "Calm fertile patch."],
    "fertile|focus": ["Openings in focus.", "Focus spurs growth."],
    "fertile|stressed": ["Strain opens a gap.", "After strain, opens"],
    "fertile|curious": ["Open curious field.", "New air for wonder."],
    "fertile|tired": ["Fatigued yet open.", "Room outlasts tired"],
    "avoidable|calm": ["Soft on avoidable.", "Soft view on avoid."],
    "avoidable|focus": ["Clear eye on avoid.", "Sharp view: avoid."],
    "avoidable|stressed": ["Strain marks avoid.", "Strain shows avoid."],
    "avoidable|curious": ["Questioning avoid.", "Curious on avoid."],
    "avoidable|tired": ["Tired eye on avoid.", "Avoid in tired view"],
  },
  es: {
    "observed|calm": ["Vigilia en calma.", "Mirada quieta acá."],
    "observed|focus": ["Foco fijo en línea.", "Campo afila el foco"],
    "observed|stressed": ["Tensa lectura acá.", "Línea con tensión"],
    "observed|curious": ["Curiosa la lectura.", "Línea curiosa hoy."],
    "observed|tired": ["Línea cansada acá.", "El campo descansa."],
    "fertile|calm": ["Calma fértil acá.", "Acá calma y fértil."],
    "fertile|focus": ["Foco abre camino.", "Foco en el crecer."],
    "fertile|stressed": ["Abre bajo tensión.", "Apertura con carga."],
    "fertile|curious": ["Curiosidad fértil.", "Más curioso aquí."],
    "fertile|tired": ["Cansado con aire.", "Abierto y cansado."],
    "avoidable|calm": ["Evitable en calma.", "Lo evitable, suave."],
    "avoidable|focus": ["Foco en lo evitable", "Claro el evitable."],
    "avoidable|stressed": ["Tensión y evitable.", "Evitable con carga."],
    "avoidable|curious": ["Mirada al evitable.", "Cuestiona evitable."],
    "avoidable|tired": ["Cansado y evitable.", "Evitable con sueño."],
  },
};

/**
 * Línea de lectura neutral para el hero (#climateSummaryLine).
 */
export function getReadingStatusLine(lang, total, seed = 0, dominantMix = "") {
  const quiet = lang === "es" ? "Se reúnen señales." : "Soft signs gather.";
  if (total < 3) return clampHeroReadingLine(quiet);
  if (total >= 1000) {
    const raw = String(dominantMix || "").trim();
    const key = raw.toLowerCase().replace(/\s*[·•]\s*/g, "|");
    const byMix = READING_SUMMARY_BY_MIX[lang]?.[key];
    const pool = Array.isArray(byMix) && byMix.length > 0
      ? byMix
      : READING_SUMMARY_FALLBACK[lang] || READING_SUMMARY_FALLBACK.en;
    const idx = Math.abs(seed) % pool.length;
    return clampHeroReadingLine(pool[idx]);
  }
  const pool = READING_SUMMARY_STEADY[lang] || READING_SUMMARY_STEADY.en;
  const idx = Math.abs(seed) % pool.length;
  return clampHeroReadingLine(pool[idx]);
}

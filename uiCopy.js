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
    "Field is listening",
    "Something forms.",
    "Air keeps trace.",
    "The field holds.",
    "Signals settle in.",
    "More gathers now.",
    "Air remembers this.",
    "Stillness, then up.",
    "What lands, stays.",
    "The field shifts.",
    "Openings hold.",
  ],
  es: [
    "Hay más al volver.",
    "El campo se mueve.",
    "Mirá el campo hoy.",
    "Mañana otro cielo.",
    "Llegan más señales.",
    "Volvé: algo cambió.",
    "Nunca es igual.",
    "Cielo no se fija.",
    "Campo sin asentar.",
    "Sostiene el campo.",
    "Mirá qué surge acá.",
  ],
};

/** Fallback total >= 1000 sin dominantMix. */
export const READING_SUMMARY_FALLBACK = {
  en: [
    "Dense, but moving.",
    "Pressure breathes.",
    "The read runs deep.",
    "Mass holds line.",
    "Heavy, still moving",
    "Weight with motion.",
    "Echoes keep forming",
  ],
  es: [
    "Lectura firme aún.",
    "El campo se calma.",
    "Señales en reposo.",
    "Calma tras tensión.",
    "Algo hace eco.",
    "La lectura espera.",
    "Campo lleno: mirá.",
  ],
};

/** Por type×mood para total >= 1000. Cada frase ≤19. */
export const READING_SUMMARY_BY_MIX = {
  en: {
    "observed|calm": ["Quiet watch holds.", "Seen, then settled."],
    "observed|focus": ["Focus keeps watch.", "Clear watch stays."],
    "observed|stressed": ["Watch under strain.", "Strain seen clear."],
    "observed|curious": ["Watch asks softly.", "Curious watch stays"],
    "observed|tired": ["Tired watch holds.", "Low energy, clear."],
    "fertile|calm": ["Calm room to grow.", "Growth in soft air."],
    "fertile|focus": ["Focus opens room.", "Clear room to grow."],
    "fertile|stressed": ["Strain opens space.", "Tight air, new gap."],
    "fertile|curious": ["Curious growth here", "Wonder opens room."],
    "fertile|tired": ["Tired, still open.", "Low fuel, still up."],
    "avoidable|calm": ["Soft view on risk.", "Risk named, calmly."],
    "avoidable|focus": ["Clear eye on risk.", "Risk in sharp view."],
    "avoidable|stressed": ["Risk under strain.", "Strain marks risk."],
    "avoidable|curious": ["Curious about risk", "Risk, asked gently."],
    "avoidable|tired": ["Tired eye on risk.", "Risk in low energy"],
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
    "avoidable|calm": ["Se ve lo evitable.", "Lo evitable, suave."],
    "avoidable|focus": ["Foco en lo evitable", "Claro el evitable."],
    "avoidable|stressed": ["Lo evitable pesa.", "Evitable con carga."],
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

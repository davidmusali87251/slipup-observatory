/**
 * SlipUp™ Observatory
 * Observatory model constants — frontend mirror for calibration.
 * Canonical source: supabase/functions/_shared/modelConstants.ts
 * Keep in sync when changing backend constants (see docs/MODEL_DESIGN_AND_CALIBRATION.md).
 */

export const BASELINE = 28;
export const SCALE = 100;

export const RECENCY_HALFLIFE_HOURS = 18;
export const RESPONSE_AMPLITUDE = 20;
export const NOTE_SIGNAL_CAP = 0.16;
export const NOTE_SIGNAL_DIVISOR = 2.5;

export const WARMUP_MASS_THRESHOLD = 6;
export const PRESSURE_NORMALIZER_SQRT_COEF = 2;
export const PRESSURE_NORMALIZER_OFFSET = 80;
export const TANH_SENSITIVITY = 2.2;

export const STABILIZE_DAMPING_MIN = 0.65;
export const STABILIZE_DAMPING_MAX = 1;

export const ALPHA_TIER1_MASS = 4;
export const ALPHA_TIER1 = 0.12;
export const ALPHA_TIER2_MASS = 14;
export const ALPHA_TIER2 = 0.17;
export const ALPHA_TIER3 = 0.2;

export const REPETITION_FIELD_MASS_DIVISOR = 28;
export const REPETITION_NUDGE_FACTOR = 2.4;
export const REPETITION_NUDGE_MAX = 1.4;
export const REPETITION_DAMPING_MIN = 0.18;
export const REPETITION_DAMPING_MAX = 1;

export const SINGLE_MOMENT_DEGREE_DELTA = 5;

/** Inercia por masa: Δclima ∝ presión/masa. Factor = 1 / (1 + sqrt(total)/MASS_INERTIA_REF). Más momentos → menos movimiento.
 *  Crítico para escala (100k–1M): no reducir; con más masa el clima debe sentirse más pesado y estable. Ver docs/OBSERVATORY_AT_SCALE_MOMENTS.md. */
export const MASS_INERTIA_REF = 100;

export const DEGREE_BAND_STEADY = 38;
export const DEGREE_BAND_BALANCE = 60;
export const DEGREE_BAND_GATHERING = 74;

/** DEGREE_SCALE_BANDS for copy/UI (steady, balance, gathering, dense) */
export const DEGREE_SCALE_BANDS = {
  steady: DEGREE_BAND_STEADY,
  balance: DEGREE_BAND_BALANCE,
  gathering: DEGREE_BAND_GATHERING,
  dense: 100,
};

/* ----- Climate v1 aggregation (Activity / Spread / Persistence). Ver docs/CLIMATE_ENGINE_DESIGN.md ----- */
export const ACTIVITY_WEIGHT = 0.45;
export const SPREAD_WEIGHT = 0.35;
export const PERSISTENCE_WEIGHT = 0.2;
export const INERTIA_ALPHA = 0.35;
export const MAX_DEGREE_DELTA = 4;
/** Referencia para normalizar activity: log(1+mass)/log(1+ACTIVITY_MAX_MASS_REF) → [0,1]. */
export const ACTIVITY_MAX_MASS_REF = 40;
/** Buckets con mass >= este valor cuentan como "activos" para persistence (evita ruido disperso). */
export const PERSISTENCE_MIN_MASS = 2;

/** Bandas de condition v1: cortas, observacionales, sin score. */
export const CONDITION_BANDS_V1 = [
  { max: 15, label: "Quiet." },
  { max: 28, label: "Gathering." },
  { max: 42, label: "Holding." },
  { max: 58, label: "Shifting." },
  { max: 74, label: "Dense." },
  { max: 100, label: "Unsettled." },
];

export const PRESSURE_MODE_CONDENSING_DELTA = 4.5;
export const PRESSURE_MODE_CLEARING_DELTA = -3.5;

export const PATTERN_A_STRENGTH_BASE = 0.25;
export const PATTERN_A_STRENGTH_RATE = 0.1;
export const PATTERN_A_STRENGTH_MIN = 0.25;
export const PATTERN_A_STRENGTH_MAX = 0.6;
export const PATTERN_B_STRENGTH_BASE = 0.22;
export const PATTERN_B_STRENGTH_RATE = 0.08;
export const PATTERN_B_STRENGTH_MIN = 0.22;
export const PATTERN_B_STRENGTH_MAX = 0.55;
export const PATTERN_C_STRENGTH = 0.28;

export const INFLUENCE_DEFAULT_STRENGTH = 0.12;
export const REFLECTIVE_SEMANTIC_STABILIZE_FACTOR = 0.75;

export const INFLUENCE = {
  avoidable: {
    stressed: { mode: "condense", strength: 1.0 },
    tired: { mode: "condense", strength: 0.8 },
    curious: { mode: "condense", strength: 0.55 },
    focus: { mode: "condense", strength: 0.5 },
    calm: { mode: "condense", strength: 0.35 },
  },
  fertile: {
    calm: { mode: "clear", strength: 0.7 },
    focus: { mode: "clear", strength: 0.55 },
    curious: { mode: "clear", strength: 0.45 },
    tired: { mode: "clear", strength: 0.28 },
    stressed: { mode: "clear", strength: 0.22 },
  },
  observed: {
    calm: { mode: "stabilize", strength: 0.3 },
    focus: { mode: "stabilize", strength: 0.22 },
    curious: { mode: "stabilize", strength: 0.18 },
    tired: { mode: "stabilize", strength: 0.14 },
    stressed: { mode: "stabilize", strength: 0.16 },
  },
};

/** Tokens reflexivos: reflexión, calma, aprendizaje, intención. Criterio: utilidad, claridad, no genéricos. */
export const REFLECTIVE_TOKENS = [
  "reflect", "noticed", "learn", "learned", "lesson", "pause", "adjust", "again", "next",
  "aware", "observe", "chose", "choice", "calm", "breathe", "intent", "reflex",
  "aprend", "leccion", "pausa", "ajust", "proxima", "siguiente", "consciente", "observo",
  "elegi", "eleccion", "calma", "respir", "intencion",
  "mindful", "notice", "accept", "peace", "slow", "wait", "step back", "atencion",
  "lento", "esper", "acept", "paz", "noto", "mirar",
  "rest", "gentle", "patience", "space", "insight", "clarity", "ground", "center", "soften", "allow",
  "descans", "suave", "paciencia", "espacio", "claridad", "centro", "suaviz", "permit",
];

/** Tokens reactivos: urgencia, tensión, culpa, caos. Criterio: utilidad, claridad, no genéricos. */
export const REACTIVE_TOKENS = [
  "rush", "late", "panic", "angry", "stuck", "again!", "always", "never", "chaos",
  "overwhelm", "noise", "blame", "fight", "explode",
  "prisa", "tarde", "panico", "enoj", "atasc", "siempre", "nunca", "caos", "ruido",
  "culpa", "pelea", "explot",
  "stress", "worry", "anxious", "urgent", "lost", "hate", "wrong", "fail",
  "estres", "preocup", "ansio", "urgente", "perd", "odio", "error", "fall",
  "frustrat", "guilty", "tense", "pressure", "repeated", "loop",
  "frustr", "culpable", "tension", "presion", "repet", "bucle",
];

export function chooseAlpha(mass) {
  if (mass < ALPHA_TIER1_MASS) return ALPHA_TIER1;
  if (mass < ALPHA_TIER2_MASS) return ALPHA_TIER2;
  return ALPHA_TIER3;
}

/* ----- Note analysis (Rise): same logic as backend, single source with REFLECTIVE/REACTIVE tokens ----- */

export function normalizeNoteText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function wordMatchesAnyToken(word, tokens) {
  return tokens.some((token) => word.includes(token));
}

function matchedTokens(text, tokens) {
  const out = [];
  tokens.forEach((token) => {
    if (text.includes(token)) out.push(token);
  });
  return out;
}

function unmatchedWords(normalizedText, reflectiveTokens, reactiveTokens) {
  if (!normalizedText) return [];
  const words = normalizedText.split(/\s+/).filter((w) => w.length > 0);
  const seen = new Set();
  return words.filter((word) => {
    if (seen.has(word)) return false;
    const matchesReflective = wordMatchesAnyToken(word, reflectiveTokens);
    const matchesReactive = wordMatchesAnyToken(word, reactiveTokens);
    if (matchesReflective || matchesReactive) return false;
    seen.add(word);
    return true;
  });
}

export function getNoteSignalBreakdown(note) {
  const text = normalizeNoteText(note);
  if (!text) {
    return {
      normalizedText: "",
      reflective: 0,
      reactive: 0,
      matchedReflective: [],
      matchedReactive: [],
      unmatchedWords: [],
    };
  }
  const matchedReflective = matchedTokens(text, REFLECTIVE_TOKENS);
  const matchedReactive = matchedTokens(text, REACTIVE_TOKENS);
  const reflectiveCount = matchedReflective.length;
  const reactiveCount = matchedReactive.length;
  const reflective = Math.min(reflectiveCount / NOTE_SIGNAL_DIVISOR, NOTE_SIGNAL_CAP);
  const reactive = Math.min(reactiveCount / NOTE_SIGNAL_DIVISOR, NOTE_SIGNAL_CAP);
  const unmatched = unmatchedWords(text, REFLECTIVE_TOKENS, REACTIVE_TOKENS);
  return {
    normalizedText: text,
    reflective,
    reactive,
    matchedReflective,
    matchedReactive,
    unmatchedWords: unmatched,
  };
}

export function noteSignal(note) {
  const b = getNoteSignalBreakdown(note);
  return { reflective: b.reflective, reactive: b.reactive };
}

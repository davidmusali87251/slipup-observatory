/**
 * Observatory model constants — single source of truth for calibration.
 * Backend: import from here. Frontend: keep modelConstants.js in sync (see docs/MODEL_DESIGN_AND_CALIBRATION.md).
 */

export const BASELINE = 28;
export const SCALE = 100;

/** Recency decay half-life (hours). Events within ~18h weigh more. */
export const RECENCY_HALFLIFE_HOURS = 18;
/** Max degree shift from baseline due to pressure (before tanh saturation). */
export const RESPONSE_AMPLITUDE = 20;
/** Cap for note semantic signal (reflective/reactive) so one note doesn't dominate. */
export const NOTE_SIGNAL_CAP = 0.16;
/** Note token count is divided by this before capping (reflective/reactive). */
export const NOTE_SIGNAL_DIVISOR = 2.5;

/** Field mass above which warmup factor reaches 1 (response no longer cautious). */
export const WARMUP_MASS_THRESHOLD = 6;
/** pressureNormalizer = PRESSURE_NORMALIZER_SQRT_COEF * sqrt(fieldMass) + PRESSURE_NORMALIZER_OFFSET */
export const PRESSURE_NORMALIZER_SQRT_COEF = 2;
export const PRESSURE_NORMALIZER_OFFSET = 80;
/** targetDelta uses tanh(normalizedPressure * TANH_SENSITIVITY). */
export const TANH_SENSITIVITY = 2.2;

/** stabilizeDamping = clamp(1 - stabilizeMass/(fieldMass+1), STABILIZE_DAMPING_MIN, STABILIZE_DAMPING_MAX) */
export const STABILIZE_DAMPING_MIN = 0.65;
export const STABILIZE_DAMPING_MAX = 1;

/** Alpha (blend toward target): mass < ALPHA_TIER1_MASS -> ALPHA_TIER1, mass < ALPHA_TIER2_MASS -> ALPHA_TIER2, else ALPHA_TIER3 */
export const ALPHA_TIER1_MASS = 4;
export const ALPHA_TIER1 = 0.12;
export const ALPHA_TIER2_MASS = 14;
export const ALPHA_TIER2 = 0.17;
export const ALPHA_TIER3 = 0.2;

/** repetitionDamping = clamp(1/sqrt(1 + fieldMass/REPETITION_FIELD_MASS_DIVISOR), REPETITION_DAMPING_MIN, REPETITION_DAMPING_MAX) */
export const REPETITION_FIELD_MASS_DIVISOR = 28;
export const REPETITION_NUDGE_FACTOR = 2.4;
export const REPETITION_NUDGE_MAX = 1.4;
export const REPETITION_DAMPING_MIN = 0.18;
export const REPETITION_DAMPING_MAX = 1;

/** When total === 1, degree is capped at BASELINE + SINGLE_MOMENT_DEGREE_DELTA */
export const SINGLE_MOMENT_DEGREE_DELTA = 5;

/** Condition bands (degree thresholds): under steady = quiet, under balance = balance, under gathering = gathering, else dense */
export const DEGREE_BAND_STEADY = 38;
export const DEGREE_BAND_BALANCE = 60;
export const DEGREE_BAND_GATHERING = 74;

/** Pressure mode: delta from BASELINE >= CONDENSING_DELTA -> condensing, <= CLEARING_DELTA -> clearing */
export const PRESSURE_MODE_CONDENSING_DELTA = 4.5;
export const PRESSURE_MODE_CLEARING_DELTA = -3.5;

/** Pattern A: avoidableStressed >= 2; strength in [PATTERN_A_STRENGTH_MIN, PATTERN_A_STRENGTH_MAX] */
export const PATTERN_A_STRENGTH_BASE = 0.25;
export const PATTERN_A_STRENGTH_RATE = 0.1;
export const PATTERN_A_STRENGTH_MIN = 0.25;
export const PATTERN_A_STRENGTH_MAX = 0.6;
/** Pattern B: max avoidable mood count >= 3 */
export const PATTERN_B_STRENGTH_BASE = 0.22;
export const PATTERN_B_STRENGTH_RATE = 0.08;
export const PATTERN_B_STRENGTH_MIN = 0.22;
export const PATTERN_B_STRENGTH_MAX = 0.55;
/** Pattern C: cluster in 3h with >50% avoidable */
export const PATTERN_C_STRENGTH = 0.28;
export const PATTERN_CLUSTER_WINDOW_HOURS = 3;
export const PATTERN_CLUSTER_MIN_SIZE = 3;

/** stabilityIndex = observedRatio * STABILITY_OBSERVED_WEIGHT + calmFocusRatio * STABILITY_CALM_FOCUS_WEIGHT */
export const STABILITY_OBSERVED_WEIGHT = 0.62;
export const STABILITY_CALM_FOCUS_WEIGHT = 0.38;
/** groundIndex = avoidableRatio * GROUND_AVOIDABLE_WEIGHT + fertileRatio * GROUND_FERTILE_WEIGHT */
export const GROUND_AVOIDABLE_WEIGHT = 0.55;
export const GROUND_FERTILE_WEIGHT = 0.45;

/** Reflective note signal contributes to stabilizeMass as reflective * REFLECTIVE_SEMANTIC_STABILIZE_FACTOR */
export const REFLECTIVE_SEMANTIC_STABILIZE_FACTOR = 0.75;

export const MODEL_VERSION = "v2.2-global";

export type InfluenceMode = "condense" | "clear" | "stabilize";
export type InfluenceCell = { mode: InfluenceMode; strength: number };
export type InfluenceTable = Record<string, Record<string, InfluenceCell>>;

export const INFLUENCE: InfluenceTable = {
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

/** Default strength when type/mood not in INFLUENCE */
export const INFLUENCE_DEFAULT_STRENGTH = 0.12;

export function chooseAlpha(mass: number): number {
  if (mass < ALPHA_TIER1_MASS) return ALPHA_TIER1;
  if (mass < ALPHA_TIER2_MASS) return ALPHA_TIER2;
  return ALPHA_TIER3;
}

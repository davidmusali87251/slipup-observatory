import {
  BASELINE,
  SCALE,
  MODEL_VERSION,
  RECENCY_HALFLIFE_HOURS,
  RESPONSE_AMPLITUDE,
  NOTE_SIGNAL_CAP,
  NOTE_SIGNAL_DIVISOR,
  WARMUP_MASS_THRESHOLD,
  PRESSURE_NORMALIZER_SQRT_COEF,
  PRESSURE_NORMALIZER_OFFSET,
  TANH_SENSITIVITY,
  STABILIZE_DAMPING_MIN,
  STABILIZE_DAMPING_MAX,
  REPETITION_FIELD_MASS_DIVISOR,
  REPETITION_NUDGE_FACTOR,
  REPETITION_NUDGE_MAX,
  REPETITION_DAMPING_MIN,
  REPETITION_DAMPING_MAX,
  SINGLE_MOMENT_DEGREE_DELTA,
  DEGREE_BAND_STEADY,
  DEGREE_BAND_BALANCE,
  DEGREE_BAND_GATHERING,
  PRESSURE_MODE_CONDENSING_DELTA,
  PRESSURE_MODE_CLEARING_DELTA,
  PATTERN_A_STRENGTH_BASE,
  PATTERN_A_STRENGTH_RATE,
  PATTERN_A_STRENGTH_MIN,
  PATTERN_A_STRENGTH_MAX,
  PATTERN_B_STRENGTH_BASE,
  PATTERN_B_STRENGTH_RATE,
  PATTERN_B_STRENGTH_MIN,
  PATTERN_B_STRENGTH_MAX,
  PATTERN_C_STRENGTH,
  PATTERN_CLUSTER_WINDOW_HOURS,
  PATTERN_CLUSTER_MIN_SIZE,
  STABILITY_OBSERVED_WEIGHT,
  STABILITY_CALM_FOCUS_WEIGHT,
  GROUND_AVOIDABLE_WEIGHT,
  GROUND_FERTILE_WEIGHT,
  REFLECTIVE_SEMANTIC_STABILIZE_FACTOR,
  INFLUENCE,
  REFLECTIVE_TOKENS,
  REACTIVE_TOKENS,
  INFLUENCE_DEFAULT_STRENGTH,
  chooseAlpha,
} from "./modelConstants.ts";
import type { InfluenceMode, InfluenceCell } from "./modelConstants.ts";

export type MomentInput = {
  timestamp: string;
  type: "avoidable" | "fertile" | "observed" | string;
  mood: "calm" | "focus" | "stressed" | "curious" | "tired" | string;
  note?: string;
};

type Repetition = {
  hasPattern: boolean;
  tag: "" | "pattern_a" | "pattern_b" | "pattern_c";
  strength: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function recencyMass(ageHours: number) {
  return Math.pow(0.5, ageHours / RECENCY_HALFLIFE_HOURS);
}

function signedPressure(mode: InfluenceMode, strength: number) {
  if (mode === "condense") return strength;
  if (mode === "clear") return -strength;
  return 0;
}

function getInfluenceCell(type: string, mood: string): InfluenceCell {
  const row = INFLUENCE[type] ?? {};
  return row[mood] ?? { mode: "stabilize", strength: INFLUENCE_DEFAULT_STRENGTH };
}

function noteSignal(note: string) {
  const text = String(note || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!text) return { reflective: 0, reactive: 0, hasUnmatchedText: false };

  let reflective = 0;
  let reactive = 0;
  REFLECTIVE_TOKENS.forEach((token) => {
    if (text.includes(token)) reflective += 1;
  });
  REACTIVE_TOKENS.forEach((token) => {
    if (text.includes(token)) reactive += 1;
  });

  const reflectiveNorm = Math.min(reflective / NOTE_SIGNAL_DIVISOR, NOTE_SIGNAL_CAP);
  const reactiveNorm = Math.min(reactive / NOTE_SIGNAL_DIVISOR, NOTE_SIGNAL_CAP);
  const hasUnmatchedText = text.length > 0 && reflective === 0 && reactive === 0;

  return { reflective: reflectiveNorm, reactive: reactiveNorm, hasUnmatchedText };
}

function compositionCounts(moments: MomentInput[]) {
  const byType = { avoidable: 0, fertile: 0, observed: 0 };
  const byMood = { calm: 0, focus: 0, stressed: 0, curious: 0, tired: 0 };
  moments.forEach((m) => {
    if (m.type in byType) byType[m.type as keyof typeof byType] += 1;
    if (m.mood in byMood) byMood[m.mood as keyof typeof byMood] += 1;
  });
  return { byType, byMood };
}

function dominantCombination(moments: MomentInput[]) {
  const counts = new Map<string, number>();
  moments.slice(0, 60).forEach((m) => {
    const key = `${m.type}|${m.mood}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  let maxKey = "";
  let maxCount = 0;
  counts.forEach((count, key) => {
    if (count > maxCount) {
      maxCount = count;
      maxKey = key;
    }
  });
  return maxKey;
}

function derivePressureMode(computedDegree: number, repetition: Repetition) {
  const delta = computedDegree - BASELINE;
  if (repetition?.hasPattern && repetition?.tag === "pattern_a") return "condensing";
  if (delta >= PRESSURE_MODE_CONDENSING_DELTA) return "condensing";
  if (delta <= PRESSURE_MODE_CLEARING_DELTA) return "clearing";
  return "stabilizing";
}

function detectStructuralPattern(entries: MomentInput[]): Repetition {
  if (!entries.length) return { hasPattern: false, tag: "", strength: 0 };

  const sorted = [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let avoidableStressedCount = 0;
  const avoidableByMood = new Map<string, number>();

  sorted.forEach((entry) => {
    if (entry.type !== "avoidable") return;
    const moodKey = entry.mood || "unknown";
    avoidableByMood.set(moodKey, (avoidableByMood.get(moodKey) || 0) + 1);
    if (entry.mood === "stressed") avoidableStressedCount += 1;
  });

  if (avoidableStressedCount >= 2) {
    const strength = clamp(
      PATTERN_A_STRENGTH_BASE + (avoidableStressedCount - 2) * PATTERN_A_STRENGTH_RATE,
      PATTERN_A_STRENGTH_MIN,
      PATTERN_A_STRENGTH_MAX
    );
    return { hasPattern: true, tag: "pattern_a", strength };
  }

  const repeatedAvoidableMood = Array.from(avoidableByMood.values()).some((count) => count >= 3);
  if (repeatedAvoidableMood) {
    const maxRepeat = Math.max(...avoidableByMood.values());
    const strength = clamp(
      PATTERN_B_STRENGTH_BASE + (maxRepeat - 3) * PATTERN_B_STRENGTH_RATE,
      PATTERN_B_STRENGTH_MIN,
      PATTERN_B_STRENGTH_MAX
    );
    return { hasPattern: true, tag: "pattern_b", strength };
  }

  const clusterWindowMs = PATTERN_CLUSTER_WINDOW_HOURS * 60 * 60 * 1000;
  let left = 0;
  for (let right = 0; right < sorted.length; right += 1) {
    const rightTs = new Date(sorted[right].timestamp).getTime();
    while (left <= right && rightTs - new Date(sorted[left].timestamp).getTime() > clusterWindowMs) {
      left += 1;
    }
    const clusterSize = right - left + 1;
    if (clusterSize < PATTERN_CLUSTER_MIN_SIZE) continue;
    const clusterSlice = sorted.slice(left, right + 1);
    const avoidableInCluster = clusterSlice.filter((item) => item.type === "avoidable").length;
    if (avoidableInCluster > clusterSize / 2) {
      return { hasPattern: true, tag: "pattern_c", strength: PATTERN_C_STRENGTH };
    }
  }

  return { hasPattern: false, tag: "", strength: 0 };
}

export function conditionForDegree(value: number, total: number) {
  if (total < 3) return "Shared moments are still gathering.";
  if (value < DEGREE_BAND_STEADY) return "Shared movement keeps a quiet line.";
  if (value < DEGREE_BAND_BALANCE) return "The shared field leans toward balance.";
  if (value < DEGREE_BAND_GATHERING) return "The shared field is becoming denser.";
  return "A compact shared front is taking shape.";
}

export function computeClimate(
  moments: MomentInput[],
  referenceTimeIso: string,
  windowHours: number
) {
  const referenceTime = new Date(referenceTimeIso);
  const windowMs = windowHours * 60 * 60 * 1000;
  const cutoff = referenceTime.getTime() - windowMs;
  const windowed = moments.filter((m) => new Date(m.timestamp).getTime() >= cutoff);
  const repetition = detectStructuralPattern(windowed);

  if (windowed.length === 0) {
    return {
      modelVersion: MODEL_VERSION,
      referenceTime: referenceTime.toISOString(),
      windowHours,
      computedDegree: BASELINE,
      total: 0,
      condition: conditionForDegree(BASELINE, 0),
      repetition,
      toneReading: 50,
    };
  }

  let atmosphericPressure = 0;
  let fieldMass = 0;
  let stabilizeMass = 0;
  const total = windowed.length;

  windowed.forEach((m) => {
    const ts = new Date(m.timestamp).getTime();
    const ageHours = Math.max(0, (referenceTime.getTime() - ts) / 3600_000);
    const mass = recencyMass(ageHours);
    const influence = getInfluenceCell(m.type, m.mood);
    const signal = noteSignal(m.note || "");
    const semanticPressure = signal.reactive - signal.reflective;
    const semanticStabilize = signal.reflective * REFLECTIVE_SEMANTIC_STABILIZE_FACTOR;
    fieldMass += mass;
    atmosphericPressure += (signedPressure(influence.mode, influence.strength) + semanticPressure) * mass;
    if (influence.mode === "stabilize") stabilizeMass += influence.strength * mass;
    stabilizeMass += semanticStabilize * mass;
  });

  const warmupFactor = Math.min(1, fieldMass / WARMUP_MASS_THRESHOLD);
  const pressureNormalizer = PRESSURE_NORMALIZER_SQRT_COEF * Math.sqrt(fieldMass) + PRESSURE_NORMALIZER_OFFSET;
  const normalizedPressure = atmosphericPressure / pressureNormalizer;
  const stabilizeDamping = clamp(1 - stabilizeMass / (fieldMass + 1), STABILIZE_DAMPING_MIN, STABILIZE_DAMPING_MAX);
  const targetDelta = RESPONSE_AMPLITUDE * Math.tanh(normalizedPressure * TANH_SENSITIVITY) * stabilizeDamping;
  const target = clamp(BASELINE + targetDelta * warmupFactor, 0, SCALE);
  const alpha = chooseAlpha(fieldMass);

  const warmBase = BASELINE + alpha * (target - BASELINE);
  const repetitionDamping = clamp(
    1 / Math.sqrt(1 + fieldMass / REPETITION_FIELD_MASS_DIVISOR),
    REPETITION_DAMPING_MIN,
    REPETITION_DAMPING_MAX
  );
  const repetitionNudge = clamp(repetition.strength * REPETITION_NUDGE_FACTOR * repetitionDamping, 0, REPETITION_NUDGE_MAX);
  let computedDegree = clamp(warmBase + repetitionNudge, 0, SCALE);
  if (total === 1) computedDegree = Math.min(computedDegree, BASELINE + SINGLE_MOMENT_DEGREE_DELTA);
  const counts = compositionCounts(windowed);
  const totalSafe = Math.max(1, total);
  const observedRatio = counts.byType.observed / totalSafe;
  const calmFocusRatio = (counts.byMood.calm + counts.byMood.focus) / totalSafe;
  const stabilityIndex = clamp(observedRatio * STABILITY_OBSERVED_WEIGHT + calmFocusRatio * STABILITY_CALM_FOCUS_WEIGHT, 0, 1);
  const groundIndex = clamp(
    (counts.byType.avoidable / totalSafe) * GROUND_AVOIDABLE_WEIGHT + (counts.byType.fertile / totalSafe) * GROUND_FERTILE_WEIGHT,
    0,
    1
  );
  const dominantMix = dominantCombination(windowed);
  const pressureMode = derivePressureMode(computedDegree, repetition);
  /** Observatory tone 0–100: 50 = neutral, >50 condensing, <50 clearing. From normalized pressure. */
  const toneReading = clamp(50 + 50 * Math.tanh(normalizedPressure * TANH_SENSITIVITY), 0, 100);

  return {
    modelVersion: MODEL_VERSION,
    referenceTime: referenceTime.toISOString(),
    windowHours,
    computedDegree,
    total,
    condition: conditionForDegree(computedDegree, total),
    repetition,
    pressureMode,
    toneReading,
    dominantMix,
    stabilityIndex,
    groundIndex,
  };
}

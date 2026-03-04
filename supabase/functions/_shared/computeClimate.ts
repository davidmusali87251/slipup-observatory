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

type InfluenceMode = "condense" | "clear" | "stabilize";
type InfluenceCell = { mode: InfluenceMode; strength: number };
type InfluenceTable = Record<string, Record<string, InfluenceCell>>;

const BASELINE = 28;
const SCALE = 100;
const MODEL_VERSION = "v2.2-global";
const RECENCY_HALFLIFE_HOURS = 18;
const RESPONSE_AMPLITUDE = 20;
const NOTE_SIGNAL_CAP = 0.16;

const INFLUENCE: InfluenceTable = {
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

const REFLECTIVE_TOKENS = [
  "reflect",
  "noticed",
  "learn",
  "learned",
  "lesson",
  "pause",
  "adjust",
  "again",
  "next",
  "aware",
  "observe",
  "chose",
  "choice",
  "calm",
  "breathe",
  "intent",
  "reflex",
  "aprend",
  "leccion",
  "pausa",
  "ajust",
  "proxima",
  "siguiente",
  "consciente",
  "observo",
  "elegi",
  "eleccion",
  "calma",
  "respir",
  "intencion",
];

const REACTIVE_TOKENS = [
  "rush",
  "late",
  "panic",
  "angry",
  "stuck",
  "again!",
  "always",
  "never",
  "chaos",
  "overwhelm",
  "noise",
  "blame",
  "fight",
  "explode",
  "prisa",
  "tarde",
  "panico",
  "enoj",
  "atasc",
  "siempre",
  "nunca",
  "caos",
  "ruido",
  "culpa",
  "pelea",
  "explot",
];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function chooseAlpha(mass: number) {
  if (mass < 4) return 0.12;
  if (mass < 14) return 0.17;
  return 0.2;
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
  return row[mood] ?? { mode: "stabilize", strength: 0.12 };
}

function noteSignal(note: string) {
  const text = String(note || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!text) return { reflective: 0, reactive: 0 };

  let reflective = 0;
  let reactive = 0;
  REFLECTIVE_TOKENS.forEach((token) => {
    if (text.includes(token)) reflective += 1;
  });
  REACTIVE_TOKENS.forEach((token) => {
    if (text.includes(token)) reactive += 1;
  });

  const reflectiveNorm = Math.min(reflective / 2.5, NOTE_SIGNAL_CAP);
  const reactiveNorm = Math.min(reactive / 2.5, NOTE_SIGNAL_CAP);
  return { reflective: reflectiveNorm, reactive: reactiveNorm };
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
  if (delta >= 4.5) return "condensing";
  if (delta <= -3.5) return "clearing";
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
    const strength = clamp(0.25 + (avoidableStressedCount - 2) * 0.1, 0.25, 0.6);
    return { hasPattern: true, tag: "pattern_a", strength };
  }

  const repeatedAvoidableMood = Array.from(avoidableByMood.values()).some((count) => count >= 3);
  if (repeatedAvoidableMood) {
    const maxRepeat = Math.max(...avoidableByMood.values());
    const strength = clamp(0.22 + (maxRepeat - 3) * 0.08, 0.22, 0.55);
    return { hasPattern: true, tag: "pattern_b", strength };
  }

  const threeHoursMs = 3 * 60 * 60 * 1000;
  let left = 0;
  for (let right = 0; right < sorted.length; right += 1) {
    const rightTs = new Date(sorted[right].timestamp).getTime();
    while (left <= right && rightTs - new Date(sorted[left].timestamp).getTime() > threeHoursMs) {
      left += 1;
    }
    const clusterSize = right - left + 1;
    if (clusterSize < 3) continue;
    const clusterSlice = sorted.slice(left, right + 1);
    const avoidableInCluster = clusterSlice.filter((item) => item.type === "avoidable").length;
    if (avoidableInCluster > clusterSize / 2) {
      return { hasPattern: true, tag: "pattern_c", strength: 0.28 };
    }
  }

  return { hasPattern: false, tag: "", strength: 0 };
}

export function conditionForDegree(value: number, total: number) {
  if (total < 3) return "Shared moments are still gathering.";
  if (value < 38) return "Shared movement keeps a quiet line.";
  if (value < 60) return "The shared field leans toward balance.";
  if (value < 74) return "The shared field is becoming denser.";
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
    const semanticStabilize = signal.reflective * 0.75;
    fieldMass += mass;
    atmosphericPressure += (signedPressure(influence.mode, influence.strength) + semanticPressure) * mass;
    if (influence.mode === "stabilize") stabilizeMass += influence.strength * mass;
    stabilizeMass += semanticStabilize * mass;
  });

  const warmupFactor = Math.min(1, fieldMass / 6);
  const pressureNormalizer = 2 * Math.sqrt(fieldMass) + 80;
  const normalizedPressure = atmosphericPressure / pressureNormalizer;
  const stabilizeDamping = clamp(1 - stabilizeMass / (fieldMass + 1), 0.65, 1);
  const targetDelta = RESPONSE_AMPLITUDE * Math.tanh(normalizedPressure * 2.2) * stabilizeDamping;
  const target = clamp(BASELINE + targetDelta * warmupFactor, 0, SCALE);
  const alpha = chooseAlpha(fieldMass);

  const warmBase = BASELINE + alpha * (target - BASELINE);
  const repetitionDamping = clamp(1 / Math.sqrt(1 + fieldMass / 28), 0.18, 1);
  const repetitionNudge = clamp(repetition.strength * 2.4 * repetitionDamping, 0, 1.4);
  let computedDegree = clamp(warmBase + repetitionNudge, 0, SCALE);
  if (total === 1) computedDegree = Math.min(computedDegree, BASELINE + 5);
  const counts = compositionCounts(windowed);
  const observedRatio = counts.byType.observed / Math.max(1, total);
  const calmFocusRatio = (counts.byMood.calm + counts.byMood.focus) / Math.max(1, total);
  const stabilityIndex = clamp(observedRatio * 0.62 + calmFocusRatio * 0.38, 0, 1);
  const groundIndex = clamp(
    (counts.byType.avoidable / Math.max(1, total)) * 0.55 + (counts.byType.fertile / Math.max(1, total)) * 0.45,
    0,
    1
  );
  const dominantMix = dominantCombination(windowed);
  const pressureMode = derivePressureMode(computedDegree, repetition);

  return {
    modelVersion: MODEL_VERSION,
    referenceTime: referenceTime.toISOString(),
    windowHours,
    computedDegree,
    total,
    condition: conditionForDegree(computedDegree, total),
    repetition,
    pressureMode,
    dominantMix,
    stabilityIndex,
    groundIndex,
  };
}

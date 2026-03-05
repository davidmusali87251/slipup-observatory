import { fetchClimateRemote, fetchSharedMomentsRemote } from "./remote.js";

const STORAGE_KEY = "slipup_v2_moments";
const RENDER_LIMIT = 10;
const CENTER = 50;
const BASELINE = 28;
const SCALE = 100;
const RECENCY_HALFLIFE_HOURS = 18;
const RESPONSE_AMPLITUDE = 20;
const NOTE_SIGNAL_CAP = 0.16;
const COMPUTED_DEGREE_KEY = "slipup_v2_computed_degree";
const DISPLAY_DEGREE_KEY = "slipup_v2_display_degree";
const INFLUENCE = {
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

// Tone selector for key narrative lines:
// - "clear": direct and legible
// - "poetic": softer and more atmospheric
const COPY_MODE = "poetic";
const COPY_VARIANTS = {
  clear: {
    condition: {
      quiet: [
        "Shared moments are still gathering.",
        "Only a few shared moments are present.",
        "The shared read is still beginning.",
        "The shared layer is still light.",
        "The shared field has just started to form.",
      ],
      steady: [
        "Shared movement holds a steady line.",
        "Shared moments keep a stable rhythm.",
        "The shared field feels even.",
        "The shared read stays calm and level.",
        "Movement remains steady across the shared field.",
      ],
      balance: [
        "The shared field tends toward balance.",
        "The shared field is balancing out.",
        "A balanced read is emerging.",
        "A calmer balance is settling in.",
        "The shared layer returns toward center.",
      ],
      gathering: [
        "Density is gathering in the shared field.",
        "The shared field is becoming denser.",
        "Repeated moments are tightening the read.",
        "A tighter shared layer is now forming.",
        "Repeating moments are drawing the field inward.",
      ],
      dense: [
        "A dense shared front is forming.",
        "A compact shared layer is now present.",
        "The shared field is tightly packed right now.",
        "The shared layer holds strong density.",
        "A heavy shared band is now in place.",
      ],
    },
    horizon: {
      empty: [
        "No shared moments have reached the surface reading yet.",
        "The surface reading has not formed yet.",
        "The surface reading is still waiting for momentum.",
      ],
      early: [
        "The surface reading is still taking shape.",
        "The surface reading is still forming.",
        "Only a faint surface reading is visible.",
      ],
      dominant: [
        (kind) => `A ${kind} current is shaping the surface reading.`,
        (kind) => `The surface reading is led by a ${kind} current.`,
        (kind) => `A ${kind} tone is rising across the surface reading.`,
        (kind) => `A ${kind} movement is becoming clearer at the surface.`,
        (kind) => `The surface reading leans toward a ${kind} current.`,
      ],
      trendSteady: [
        "The collective pulse is steady.",
        "The collective rhythm holds.",
        "The shared pulse remains even.",
        "The broad rhythm is stable.",
      ],
      trendShift: [
        "The collective pulse is still rearranging.",
        "The collective rhythm is still shifting.",
        "The shared pulse is still finding new order.",
        "The broad rhythm is still re-forming.",
      ],
      driftCondensing: [
        "A denser layer lingers at the surface.",
        "The surface is compacting into a tighter layer.",
        "A compact surface band remains present.",
        "Density holds close to the surface line.",
      ],
      driftClearing: [
        "A clearer lane is opening at the surface.",
        "The surface is opening into a clearer line.",
        "A lighter surface lane is appearing.",
        "The surface reading is opening out.",
      ],
      driftStable: [
        "The surface line stays in balance.",
        "The surface reading is holding steady.",
        "The surface keeps a measured balance.",
        "The surface line remains calm.",
      ],
    },
    local: {
      condensing: [
        "Nearby moments are compacting.",
        "Nearby moments are gathering into a tighter band.",
        "Nearby moments are clustering into denser patterns.",
        "Nearby moments are drawing inward.",
      ],
      clearing: [
        "Nearby moments are opening.",
        "Nearby moments are creating more space.",
        "Nearby moments are spreading into lighter space.",
        "Nearby moments are loosening.",
      ],
      stable: [
        "Nearby moments hold a steady balance.",
        "Nearby moments stay in a balanced rhythm.",
        "Nearby moments remain calm and even.",
        "Nearby moments keep a measured line.",
      ],
      fallback: [
        "Nearby read is forming. It mirrors the wider field.",
        "Nearby read is still light. It follows the wider field.",
        "Nearby read is still emerging. It reflects the wider field.",
        "Nearby read is not yet dense. It mirrors the wider field.",
      ],
      regional: [
        "Reading shared moments across your region.",
        "Read based on shared moments from your region.",
        "Regional read drawn from shared moments.",
        "Shared regional moments shape this read.",
      ],
    },
    strataFallback: [
      "Shared and private moments settle below the surface.",
      "Shared and private moments rest together in deeper layers.",
      "Below the surface, moments settle side by side.",
      "Deeper layers hold shared and private moments together.",
      "Shared and private moments keep settling in deeper record.",
    ],
    strataEarly: [
      "The deep record is still forming.",
      "Only a light layer has settled in deep record.",
      "Deep record is beginning to gather moments.",
    ],
  },
  poetic: {
    condition: {
      quiet: [
        "Shared moments are still gathering.",
        "Shared moments are still few.",
        "The shared read is still in its first breath.",
        "The shared field is still quiet in tone.",
        "Only a light pulse is present in the shared field.",
      ],
      steady: [
        "Shared movement keeps a quiet line.",
        "Shared moments move in a calm rhythm.",
        "A steady line holds across the shared field.",
        "The shared field keeps an even cadence.",
        "The shared read remains quietly steady.",
      ],
      balance: [
        "The shared field leans toward balance.",
        "The shared field settles toward balance.",
        "Balance is slowly returning to the shared read.",
        "A balanced tone is returning across the field.",
        "The shared layer drifts toward a calmer center.",
      ],
      gathering: [
        "The field grows denser around repeating moments.",
        "Repeated moments are tightening the shared read.",
        "The shared field gathers into a denser band.",
        "A denser shared band gathers with each return.",
        "Repeating moments draw the shared field inward.",
      ],
      dense: [
        "A compact shared front is taking shape.",
        "A dense layer is now holding in the shared field.",
        "The shared read is settling into a tight front.",
        "A dense shared layer now lingers in place.",
        "The shared field is holding a compact front.",
      ],
    },
    horizon: {
      empty: [
        "No shared moments have reached the surface reading yet.",
        "The surface reading is still waiting for its first line.",
        "The surface reading is still quiet.",
      ],
      early: [
        "The surface reading is still settling.",
        "The surface reading is finding its contour.",
        "A first contour is still forming at the surface.",
      ],
      dominant: [
        (kind) => `A ${kind} current is surfacing in the read.`,
        (kind) => `A ${kind} current is sketching the surface reading.`,
        (kind) => `A ${kind} tone is beginning to lead the surface.`,
        (kind) => `A ${kind} movement is becoming visible at the surface.`,
        (kind) => `The surface reading is turning toward a ${kind} current.`,
      ],
      trendSteady: [
        "The collective pulse stays even.",
        "A calm collective pulse remains in place.",
        "The collective rhythm holds a quiet balance.",
        "A steady collective pulse continues.",
      ],
      trendShift: [
        "The collective pulse is still rearranging.",
        "The collective pulse is still shifting shape.",
        "The collective rhythm is still re-forming.",
        "The collective pulse is still finding its line.",
      ],
      driftCondensing: [
        "A tighter layer lingers near the surface.",
        "The surface is drawing into a denser band.",
        "A compact band stays near the surface line.",
        "The surface layer keeps a denser hold.",
      ],
      driftClearing: [
        "A clearer lane opens near the surface.",
        "A lighter path is opening at the surface.",
        "A softer lane appears near the surface.",
        "The surface line opens into lighter space.",
      ],
      driftStable: [
        "The surface line remains steady.",
        "The surface reading holds a calm balance.",
        "The surface reading remains even and calm.",
        "A stable surface line continues to hold.",
      ],
    },
    local: {
      condensing: [
        "Nearby moments are drawing closer.",
        "Nearby moments are tightening into a closer pattern.",
        "Nearby moments gather into a tighter weave.",
        "Nearby moments settle into a denser cluster.",
      ],
      clearing: [
        "Nearby moments are opening space.",
        "Nearby moments are spreading into lighter space.",
        "Nearby moments are opening into wider space.",
        "Nearby moments are loosening their pattern.",
      ],
      stable: [
        "Nearby moments hold a calm balance.",
        "Nearby moments keep a quiet balance.",
        "Nearby moments remain gently balanced.",
        "Nearby moments hold an even rhythm.",
      ],
      fallback: [
        "Nearby read is forming. It mirrors the wider field.",
        "Nearby read is still thin. It follows the wider field.",
        "Nearby read is still faint. It mirrors the wider field.",
        "Nearby read is still light. It follows the wider field.",
      ],
      regional: [
        "Reading shared moments across your region.",
        "Read drawn from shared moments across your region.",
        "Regional read shaped by shared moments.",
        "Shared moments across your region shape this read.",
      ],
    },
    strataFallback: [
      "Shared and private moments settle into one deeper record.",
      "Shared and private moments rest in the deeper record.",
      "In deeper layers, moments settle side by side.",
      "Deeper record gathers shared and private moments together.",
      "Shared and private moments keep settling in deeper layers.",
    ],
    strataEarly: [
      "Deep record is still taking shape.",
      "Only a thin layer has settled in deep record.",
      "Deep record is beginning to gather moments.",
    ],
  },
};
const COPY = COPY_VARIANTS[COPY_MODE] || COPY_VARIANTS.clear;

function pickCopy(entry, seed) {
  if (Array.isArray(entry)) {
    if (!entry.length) return "";
    return entry[Math.abs(seed) % entry.length];
  }
  return entry;
}

function pickCopyFromState(entry, numericSeed) {
  const chosen = pickCopy(entry, numericSeed);
  if (typeof chosen === "function") return chosen;
  return () => String(chosen || "");
}

const degreeValue = document.getElementById("degreeValue");
const conditionLine = document.getElementById("conditionLine");
const recentMoments = document.getElementById("recentMoments");
const viewMoreButton = document.getElementById("viewMoreButton");
const horizonPrimary = document.getElementById("horizonPrimary");
const horizonSecondary = document.getElementById("horizonSecondary");
const horizonMoreButton = document.getElementById("horizonMoreButton");
const heroEl = document.getElementById("observatory-hero");
const atmospherePatternLine = document.getElementById("atmosphere-pattern-line");
const transientReadingLine = document.getElementById("transientReadingLine");
const sheetBackdrop = document.getElementById("sheet-backdrop");
const sharedSheet = document.getElementById("shared-sheet");
const sharedSheetList = document.getElementById("shared-sheet-list");
const sharedSheetEmpty = document.getElementById("shared-sheet-empty");
const sharedSheetCloseButton = document.getElementById("shared-sheet-close");
const localClimatePrimary = document.getElementById("localClimatePrimary");
const localClimateSecondary = document.getElementById("localClimateSecondary");
const groundStrata = document.getElementById("ground-strata");
const strataLines = document.getElementById("strataLines");

const query = new URLSearchParams(window.location.search);
const contributed = query.get("contributed") === "1";
const SHARED_SHEET_MAX_ITEMS = 50;
const SHEET_TRANSITION_MS = 280;
const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

let isSharedSheetOpen = false;
let lastFocusedEl = null;

function detectStructuralPattern(activeEntries48h) {
  if (!activeEntries48h.length) {
    return { hasPattern: false, tag: "", strength: 0 };
  }

  const sorted = [...activeEntries48h].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let avoidableStressedCount = 0;
  let avoidableCount = 0;
  const avoidableByMood = new Map();

  sorted.forEach((entry) => {
    if (entry.type === "avoidable") {
      avoidableCount += 1;
      const moodKey = entry.mood || "unknown";
      avoidableByMood.set(moodKey, (avoidableByMood.get(moodKey) || 0) + 1);
      if (entry.mood === "stressed") avoidableStressedCount += 1;
    }
  });

  // Pattern A: avoidable + stressed appears >= 2
  if (avoidableStressedCount >= 2) {
    const strength = clamp(0.25 + (avoidableStressedCount - 2) * 0.1, 0.25, 0.6);
    return { hasPattern: true, tag: "pattern_a", strength };
  }

  // Pattern B: avoidable repeats with same mood >= 3
  const repeatedAvoidableMood = Array.from(avoidableByMood.values()).some((count) => count >= 3);
  if (repeatedAvoidableMood) {
    const maxRepeat = Math.max(...avoidableByMood.values());
    const strength = clamp(0.22 + (maxRepeat - 3) * 0.08, 0.22, 0.55);
    return { hasPattern: true, tag: "pattern_b", strength };
  }

  // Pattern C: cluster 3+ entries within 3h and avoidable dominates
  const threeHoursMs = 3 * 60 * 60 * 1000;
  let left = 0;
  let hasCluster = false;
  for (let right = 0; right < sorted.length; right += 1) {
    const rightTs = new Date(sorted[right].timestamp).getTime();
    while (left <= right && rightTs - new Date(sorted[left].timestamp).getTime() > threeHoursMs) {
      left += 1;
    }
    const clusterSize = right - left + 1;
    if (clusterSize >= 3) {
      const clusterSlice = sorted.slice(left, right + 1);
      const avoidableInCluster = clusterSlice.filter((item) => item.type === "avoidable").length;
      if (avoidableInCluster > clusterSize / 2) {
        hasCluster = true;
        break;
      }
    }
  }

  if (hasCluster) {
    return { hasPattern: true, tag: "pattern_c", strength: 0.28 };
  }

  return { hasPattern: false, tag: "", strength: 0 };
}

const PATTERN_LINES = {
  pattern_a: [
    "A familiar tension returns under stress.",
    "Pressure gathers where stress settles.",
    "A denser current forms as the same moment returns.",
    "A repeated stressed line keeps tightening the field.",
    "The same stressed movement returns before it can dissolve.",
  ],
  pattern_b: [
    "A short loop keeps returning.",
    "A familiar cycle comes back in close succession.",
    "The same contour appears again before it fully dissolves.",
    "A looped contour keeps arriving in similar form.",
    "The same shape reappears across short intervals.",
  ],
  pattern_c: [
    "Movement gathers into small clusters.",
    "Signals condense into brief pockets.",
    "Several moments settle close together in time.",
    "Short waves of moments gather into one band.",
    "Close-timed moments cluster before dispersing.",
  ],
};

const COMBINATION_LINES = {
  "avoidable|calm": [
    "A quiet friction line remains near the surface.",
    "Calm holds while a light avoidable current persists.",
    "A soft avoidable moment returns with low pressure.",
    "A soft avoidable rhythm remains under calm tone.",
    "Calm holds while a light avoidable line repeats.",
  ],
  "avoidable|focus": [
    "A focused avoidable current opens a narrow channel.",
    "Attention stays sharp while friction keeps its direction.",
    "A concentrated avoidable line crosses the atmosphere.",
    "A focused avoidable line keeps cutting one narrow path.",
    "Directed friction remains precise and persistent.",
  ],
  "avoidable|stressed": [
    "Stress and friction condense into a denser front.",
    "An avoidable wave rises under stress.",
    "The atmosphere tightens where stressed moments align.",
    "A stressed avoidable band keeps building density.",
    "Friction and stress hold a compact line.",
  ],
  "avoidable|curious": [
    "Exploratory friction leaves an unsettled but open trail.",
    "Curiosity and avoidable drag meet in shifting air.",
    "A searching current moves across avoidable terrain.",
    "A curious avoidable line explores without fully settling.",
    "Searching movement opens and closes in quick turns.",
  ],
  "avoidable|tired": [
    "A tired avoidable layer settles with heavier weight.",
    "Friction turns slower yet more persistent under fatigue.",
    "A low-energy avoidable band remains in place.",
    "Fatigue slows the line, but it keeps repeating.",
    "A heavy avoidable tone lingers near the same track.",
  ],
  "fertile|calm": [
    "Calm fertile moments begin to clear the air.",
    "A softer opening appears where calm meets fertile movement.",
    "The atmosphere loosens through calm fertile currents.",
    "Calm fertile moments keep widening breathable space.",
    "A light fertile line opens with calm continuity.",
  ],
  "fertile|focus": [
    "Fertile focus opens a steady channel in the atmosphere.",
    "A clear opening appears with focused fertile movement.",
    "Clearer pathways form where fertile focus repeats.",
    "Focused fertile moments carve a clean and steady path.",
    "A fertile line remains clear under focused attention.",
  ],
  "fertile|stressed": [
    "A fertile signal persists even under pressure.",
    "Openings appear through stress without collapsing.",
    "A narrow clearing remains despite stressed flow.",
    "Stress passes, but fertile openings keep returning.",
    "A strained field still leaves room for fertile movement.",
  ],
  "fertile|curious": [
    "Curiosity leaves fertile openings across the terrain.",
    "Exploratory fertile movement keeps the field breathable.",
    "A widening current forms through curious fertile moments.",
    "Curious fertile moments keep extending open paths.",
    "Exploratory fertile lines widen the shared read.",
  ],
  "fertile|tired": [
    "Fertile movement stays present, though at lower energy.",
    "A slower fertile current keeps some openings alive.",
    "Openings remain, even as fatigue crosses the field.",
    "Even in low energy, fertile moments keep a small opening.",
    "A tired fertile line moves slowly but remains open.",
  ],
  "observed|calm": [
    "Calm observation stabilizes the surface.",
    "Observed calm moments keep the atmosphere readable.",
    "A settled observational layer supports balance.",
    "Calm observation keeps a stable reading line.",
    "A quiet observed band helps the field stay legible.",
  ],
  "observed|focus": [
    "Focused observation lowers ambient noise.",
    "Observed focus keeps contours clearer near the horizon.",
    "A precise observational line steadies movement.",
    "Focused observation sharpens the read without tightening.",
    "A clear observed line keeps surface contours precise.",
  ],
  "observed|stressed": [
    "Observation remains present while stress passes through.",
    "Stressed observation keeps turbulence from spreading.",
    "A watchful layer contains pressure near the surface.",
    "Even under stress, observation keeps the line readable.",
    "Watchful observation prevents spread into wider turbulence.",
  ],
  "observed|curious": [
    "Curious observation maps subtle changes in the atmosphere.",
    "Observed curiosity keeps movement open and readable.",
    "A light exploratory observation line remains active.",
    "Curious observation traces small shifts across the field.",
    "An exploratory observed line keeps the read open.",
  ],
  "observed|tired": [
    "Observation under fatigue still anchors the layer.",
    "A low-energy observational seam keeps orientation.",
    "Even in tired conditions, observation holds a quiet frame.",
    "Tired observation still offers a stable reference line.",
    "Low-energy observation keeps the read from drifting.",
  ],
};

function pickLine(lines, seedNumber) {
  if (!Array.isArray(lines) || lines.length === 0) return "";
  const idx = Math.abs(seedNumber) % lines.length;
  return lines[idx];
}

function lineSeed(climateTruth, collectionSize) {
  const degreeSeed = Math.round((climateTruth?.computedDegree || BASELINE) * 10);
  const totalSeed = Number.isFinite(climateTruth?.total) ? climateTruth.total : 0;
  return degreeSeed + totalSeed + collectionSize;
}

function dominantCombination(sharedMoments) {
  if (!Array.isArray(sharedMoments) || sharedMoments.length === 0) return "";
  const counts = new Map();
  sharedMoments.slice(0, 30).forEach((m) => {
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

function compositionCounts(moments) {
  const byType = { avoidable: 0, fertile: 0, observed: 0 };
  const byMood = { calm: 0, focus: 0, stressed: 0, curious: 0, tired: 0 };
  moments.forEach((m) => {
    if (byType[m.type] !== undefined) byType[m.type] += 1;
    if (byMood[m.mood] !== undefined) byMood[m.mood] += 1;
  });
  return { byType, byMood };
}

function derivePressureMode(computedDegree, repetition) {
  const delta = computedDegree - BASELINE;
  if (repetition?.hasPattern && repetition?.tag === "pattern_a") return "condensing";
  if (delta >= 4.5) return "condensing";
  if (delta <= -3.5) return "clearing";
  return "stabilizing";
}

function deriveClimateState(climateTruth, sharedMoments, localMoments) {
  const shared = Array.isArray(sharedMoments) ? sharedMoments : [];
  const counts = compositionCounts(shared.slice(0, 60));
  const dominantMix = dominantCombination(shared);
  const total = Math.max(1, shared.length);
  const observedRatio = counts.byType.observed / total;
  const calmFocusRatio = (counts.byMood.calm + counts.byMood.focus) / total;
  const stabilityIndex = clamp(observedRatio * 0.62 + calmFocusRatio * 0.38, 0, 1);

  const longWindow = getLongWindow(localMoments, 30);
  const longCounts = compositionCounts(longWindow);
  const longTotal = Math.max(1, longWindow.length);
  const longAvoidable = longCounts.byType.avoidable / longTotal;
  const longFertile = longCounts.byType.fertile / longTotal;
  const groundIndex = clamp((longAvoidable * 0.55 + longFertile * 0.45) * Math.min(1, longTotal / 20), 0, 1);

  return {
    computedDegree: climateTruth.computedDegree,
    total: climateTruth.total,
    condition: climateTruth.condition,
    repetition: climateTruth.repetition,
    pressureMode: derivePressureMode(climateTruth.computedDegree, climateTruth.repetition),
    dominantMix,
    stabilityIndex,
    groundIndex,
  };
}

function loadMoments() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function getRecentWindow(moments) {
  const now = Date.now();
  const twoDaysMs = 48 * 60 * 60 * 1000;
  return moments.filter((m) => now - new Date(m.timestamp).getTime() <= twoDaysMs);
}

function chooseAlpha(mass) {
  if (mass < 4) return 0.12;
  if (mass < 14) return 0.17;
  return 0.2;
}

function recencyMass(ageHours) {
  return Math.pow(0.5, ageHours / RECENCY_HALFLIFE_HOURS);
}

function signedPressure(mode, strength) {
  if (mode === "condense") return strength;
  if (mode === "clear") return -strength;
  return 0;
}

function getInfluenceCell(type, mood) {
  const row = INFLUENCE[type] || {};
  return row[mood] || { mode: "stabilize", strength: 0.12 };
}

function noteSignal(note) {
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

  return {
    reflective: Math.min(reflective / 2.5, NOTE_SIGNAL_CAP),
    reactive: Math.min(reactive / 2.5, NOTE_SIGNAL_CAP),
  };
}

function calculateClimate(moments) {
  const windowed = getRecentWindow(moments);
  const latestInWindow = windowed[windowed.length - 1] || null;
  const repetition = detectStructuralPattern(windowed);
  if (windowed.length === 0) {
    return {
      computedDegree: BASELINE,
      total: 0,
      latestTimestamp: null,
      repetition,
    };
  }

  const nowMs = Date.now();
  const total = windowed.length;
  let atmosphericPressure = 0;
  let fieldMass = 0;
  let stabilizeMass = 0;
  windowed.forEach((m) => {
    const ageHours = Math.max(0, (nowMs - new Date(m.timestamp).getTime()) / 3600_000);
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
  if (total === 1) {
    computedDegree = Math.min(computedDegree, BASELINE + 5);
  }

  return {
    computedDegree,
    total,
    latestTimestamp: latestInWindow ? latestInWindow.timestamp : null,
    repetition,
  };
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function getStoredComputedDegree() {
  const raw = localStorage.getItem(COMPUTED_DEGREE_KEY);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function setStoredComputedDegree(value) {
  localStorage.setItem(COMPUTED_DEGREE_KEY, String(value));
}

function getStoredDisplayDegree() {
  const raw = localStorage.getItem(DISPLAY_DEGREE_KEY);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function setStoredDisplayDegree(value) {
  localStorage.setItem(DISPLAY_DEGREE_KEY, String(value));
}

function formatDegree(value) {
  return Math.round(value).toString();
}

function conditionForDegree(value, total) {
  const seed = Math.round(value * 10) + total;
  if (total < 3) return pickCopy(COPY.condition.quiet, seed);
  if (value < 38) return pickCopy(COPY.condition.steady, seed);
  if (value < 60) return pickCopy(COPY.condition.balance, seed);
  if (value < 74) return pickCopy(COPY.condition.gathering, seed);
  return pickCopy(COPY.condition.dense, seed);
}

function getSharedMoments(moments) {
  return moments.filter((m) => m.shared && !m.hidden).reverse();
}

function renderMomentItems(targetElement, items) {
  targetElement.innerHTML = "";
  items.forEach((m) => {
    const li = document.createElement("li");
    li.className = "moment-item";
    const note = m.note ? m.note : "(no note)";
    const left = `${m.type} · ${m.mood} · ${note}`;
    const right = new Date(m.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    li.innerHTML = `<span>${escapeHtml(left)}</span><span>${escapeHtml(right)}</span>`;
    targetElement.appendChild(li);
  });
}

function renderRecent(sharedMoments) {
  recentMoments.innerHTML = "";
  const list = sharedMoments.slice(0, RENDER_LIMIT);

  if (list.length === 0) {
    const empty = document.createElement("li");
    empty.className = "moment-item";
    empty.textContent = "No shared moments yet.";
    recentMoments.appendChild(empty);
    return;
  }

  renderMomentItems(recentMoments, list);
}

function renderSharedSheetList(sharedMoments) {
  const list = sharedMoments.slice(0, SHARED_SHEET_MAX_ITEMS);
  sharedSheetList.innerHTML = "";

  if (list.length === 0) {
    sharedSheetList.classList.add("hidden");
    sharedSheetEmpty.classList.remove("hidden");
    return;
  }

  sharedSheetEmpty.classList.add("hidden");
  sharedSheetList.classList.remove("hidden");
  renderMomentItems(sharedSheetList, list);
}

function getSheetFocusableElements() {
  return Array.from(
    sharedSheet.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
}

function closeSharedSheet() {
  if (!isSharedSheetOpen) return;

  isSharedSheetOpen = false;
  sharedSheet.classList.remove("is-open");
  sheetBackdrop.classList.remove("is-open");
  document.body.classList.remove("sheet-open");
  document.removeEventListener("keydown", onSharedSheetKeydown);

  window.setTimeout(() => {
    sharedSheet.hidden = true;
    sheetBackdrop.hidden = true;
    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
      lastFocusedEl.focus();
    }
  }, SHEET_TRANSITION_MS);
}

function onSharedSheetKeydown(event) {
  if (!isSharedSheetOpen) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeSharedSheet();
    return;
  }

  if (event.key !== "Tab") return;
  const focusable = getSheetFocusableElements();
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function openSharedSheet(sharedMoments) {
  if (isSharedSheetOpen) return;
  isSharedSheetOpen = true;
  lastFocusedEl = document.activeElement;

  renderSharedSheetList(sharedMoments);

  sharedSheet.hidden = false;
  sheetBackdrop.hidden = false;
  document.body.classList.add("sheet-open");
  document.addEventListener("keydown", onSharedSheetKeydown);

  requestAnimationFrame(() => {
    sharedSheet.classList.add("is-open");
    sheetBackdrop.classList.add("is-open");
    sharedSheetCloseButton.focus();
  });
}

function renderHorizon(canonicalState, sharedMoments) {
  const total = sharedMoments.length;
  const seed = Math.round((canonicalState?.computedDegree || BASELINE) * 10) + total;
  horizonSecondary.classList.add("hidden");
  horizonMoreButton.classList.add("hidden");
  horizonSecondary.innerHTML = "";

  if (total === 0) {
    horizonPrimary.textContent = pickCopy(COPY.horizon.empty, seed);
    return;
  }

  if (total < 4) {
    horizonPrimary.textContent = pickCopy(COPY.horizon.early, seed);
    return;
  }

  const latest = sharedMoments.slice(0, 12);
  const countByType = latest.reduce(
    (acc, item) => {
      acc[item.type] += 1;
      return acc;
    },
    { avoidable: 0, fertile: 0, observed: 0 }
  );
  const dominant = Object.entries(countByType).sort((a, b) => b[1] - a[1])[0][0];
  const dominantTemplate = pickCopyFromState(COPY.horizon.dominant, seed);
  horizonPrimary.textContent = dominantTemplate(dominant);

  horizonMoreButton.classList.remove("hidden");
  horizonMoreButton.onclick = () => {
    horizonSecondary.classList.remove("hidden");
    const trend =
      canonicalState.stabilityIndex >= 0.55
        ? pickCopy(COPY.horizon.trendSteady, seed)
        : pickCopy(COPY.horizon.trendShift, seed);
    const drift =
      canonicalState.pressureMode === "condensing"
        ? pickCopy(COPY.horizon.driftCondensing, seed)
        : canonicalState.pressureMode === "clearing"
          ? pickCopy(COPY.horizon.driftClearing, seed)
          : pickCopy(COPY.horizon.driftStable, seed);
    horizonSecondary.innerHTML = `<p>${trend}</p><p>${drift}</p>`;
    horizonMoreButton.classList.add("hidden");
  };
}

function renderLocalClimate(localState) {
  const pressureMode = localState?.pressureMode || "stabilizing";
  const seed = Math.round((localState?.computedDegree || BASELINE) * 10) + (localState?.total || 0);
  const pressureText =
    pressureMode === "condensing"
      ? pickCopy(COPY.local.condensing, seed)
      : pressureMode === "clearing"
        ? pickCopy(COPY.local.clearing, seed)
        : pickCopy(COPY.local.stable, seed);

  localClimatePrimary.textContent = pressureText;
  if (localState?.source === "global_fallback") {
    localClimateSecondary.textContent = pickCopy(COPY.local.fallback, seed);
    return;
  }
  localClimateSecondary.textContent = pickCopy(COPY.local.regional, seed);
}

function getLongWindow(moments, days = 30) {
  const now = Date.now();
  const windowMs = days * 24 * 60 * 60 * 1000;
  return moments.filter((m) => now - new Date(m.timestamp).getTime() <= windowMs && !m.hidden);
}

function buildStrataLines(longWindowMoments, canonicalState) {
  const total = longWindowMoments.length;
  if (total === 0) {
    return [pickCopy(COPY.strataEarly, 0)];
  }

  const counts = { avoidable: 0, fertile: 0, observed: 0 };
  const moods = { calm: 0, focus: 0, stressed: 0, curious: 0, tired: 0 };

  longWindowMoments.forEach((m) => {
    if (counts[m.type] !== undefined) counts[m.type] += 1;
    if (moods[m.mood] !== undefined) moods[m.mood] += 1;
  });

  const lines = [];
  if (canonicalState.pressureMode === "condensing") {
    lines.push("A compacted band continues sinking into deeper layers.");
  } else if (canonicalState.pressureMode === "clearing") {
    lines.push("A lighter seam opens between settled moments.");
  } else {
    lines.push("Deep layers hold steady, without abrupt shifts.");
  }

  if (counts.avoidable >= 5 && moods.stressed >= 3) {
    lines.push("A denser seam forms where friction keeps returning.");
  }
  if (counts.fertile >= 4 && moods.calm >= 3) {
    lines.push("Calm fertile moments leave lighter veins below.");
  }
  if (counts.observed >= 4) {
    lines.push("Observation compacts the layer into a clearer reading.");
  }

  const moodDiversity = Object.values(moods).filter((count) => count > 0).length;
  if (moodDiversity >= 4) {
    lines.push("Multiple currents spread across deeper layers.");
  }

  const avoidableRatio = counts.avoidable / total;
  const fertileRatio = counts.fertile / total;
  if (avoidableRatio > 0.42 && fertileRatio > 0.22) {
    lines.push("Rough and open moments settle together into mixed sediment.");
  } else if (fertileRatio > 0.38) {
    lines.push("A clearer imprint remains where openings repeat.");
  }

  if (total >= 24) {
    lines.push("Deeper bedrock is forming, slower and steadier over time.");
  }

  if (lines.length < 2) {
    lines.push("The deep layer is taking shape from recurring moments.");
    lines.push(pickCopy(COPY.strataFallback, total + lines.length));
  }

  if (total < 12) {
    return [lines[0], pickCopy(COPY.strataEarly, total)];
  }

  return lines.slice(0, 5);
}

function renderStrata(moments, canonicalState) {
  const longWindow = getLongWindow(moments, 30);
  const lines = buildStrataLines(longWindow, canonicalState);
  if (!lines.length) {
    groundStrata.classList.remove("is-active");
    groundStrata.hidden = true;
    strataLines.innerHTML = "";
    return;
  }

  strataLines.innerHTML = "";
  lines.forEach((line) => {
    const li = document.createElement("li");
    li.className = "strata-line";
    li.textContent = line;
    strataLines.appendChild(li);
  });

  groundStrata.hidden = false;
  groundStrata.classList.add("is-active");
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function animateDegree(from, to, ms) {
  if (prefersReducedMotion || ms <= 0) {
    degreeValue.textContent = formatDegree(to);
    return;
  }
  const start = performance.now();
  function frame(now) {
    const t = clamp((now - start) / ms, 0, 1);
    const eased = 1 - (1 - t) * (1 - t);
    const current = from + (to - from) * eased;
    degreeValue.textContent = formatDegree(current);
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function showTransientReading() {
  transientReadingLine.textContent = "The reading adjusts.";
  transientReadingLine.classList.remove("hidden");
  transientReadingLine.classList.add("is-visible");

  window.setTimeout(() => {
    transientReadingLine.classList.remove("is-visible");
    window.setTimeout(() => {
      transientReadingLine.classList.add("hidden");
      transientReadingLine.textContent = "";
    }, 550);
  }, 2300);
}

function renderPatternLayer(canonicalState) {
  const repetition = canonicalState?.repetition || { hasPattern: false, tag: "", strength: 0 };
  heroEl.classList.toggle("observatory--pattern", Boolean(repetition?.hasPattern));

  const seed = lineSeed(canonicalState, canonicalState?.total || 0);
  const dominant = canonicalState?.dominantMix || "";
  const patternLines = repetition?.hasPattern ? PATTERN_LINES[repetition.tag] || [] : [];
  const comboLines = COMBINATION_LINES[dominant] || [];
  const line = patternLines.length ? pickLine(patternLines, seed) : pickLine(comboLines, seed);

  if (!line) {
    atmospherePatternLine.textContent = "";
    atmospherePatternLine.classList.add("hidden");
    return;
  }

  atmospherePatternLine.textContent = line;
  atmospherePatternLine.classList.remove("hidden");
}

async function loadSharedMoments(localMoments) {
  try {
    const remoteItems = await fetchSharedMomentsRemote(SHARED_SHEET_MAX_ITEMS, 48);
    return {
      items: remoteItems.filter((m) => m.shared && !m.hidden),
      source: "remote",
    };
  } catch {
    return {
      items: getSharedMoments(localMoments),
      source: "local",
    };
  }
}

function normalizeRepetition(repetition) {
  return {
    hasPattern: Boolean(repetition?.hasPattern),
    tag: repetition?.tag || "",
    strength: Number.isFinite(repetition?.strength) ? repetition.strength : 0,
  };
}

async function loadClimateTruth(localMoments) {
  const localSharedMoments = getSharedMoments(localMoments);
  try {
    const remoteClimate = await fetchClimateRemote(48);
    const computedDegree = Number(remoteClimate?.computedDegree);
    if (!Number.isFinite(computedDegree)) throw new Error("REMOTE_CLIMATE_INVALID");
    return {
      source: "remote",
      computedDegree: clamp(computedDegree, 0, SCALE),
      total: Number.isFinite(remoteClimate?.total) ? remoteClimate.total : 0,
      condition:
        typeof remoteClimate?.condition === "string" && remoteClimate.condition.length > 0
          ? remoteClimate.condition
          : conditionForDegree(computedDegree, Number(remoteClimate?.total) || 0),
      repetition: normalizeRepetition(remoteClimate?.repetition),
      pressureMode: remoteClimate?.pressureMode || "",
      dominantMix: remoteClimate?.dominantMix || "",
      stabilityIndex: Number.isFinite(remoteClimate?.stabilityIndex) ? remoteClimate.stabilityIndex : null,
      groundIndex: Number.isFinite(remoteClimate?.groundIndex) ? remoteClimate.groundIndex : null,
    };
  } catch {
    const localClimate = calculateClimate(localSharedMoments);
    return {
      source: "local",
      computedDegree: localClimate.computedDegree,
      total: localClimate.total,
      condition: conditionForDegree(localClimate.computedDegree, localClimate.total),
      repetition: localClimate.repetition,
      pressureMode: "",
      dominantMix: "",
      stabilityIndex: null,
      groundIndex: null,
    };
  }
}

function sanitizeBucketPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function guessGeoBucketFromTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (!tz) return "";
    const segments = tz.split("/").map(sanitizeBucketPart).filter(Boolean);
    if (!segments.length) return "";
    return `tz.${segments.join(".")}`.slice(0, 64);
  } catch {
    return "";
  }
}

async function loadLocalClimateTruth(globalClimate) {
  const geoBucket = guessGeoBucketFromTimezone();
  if (!geoBucket) {
    return { source: "global_fallback", ...globalClimate };
  }

  try {
    const remoteLocalClimate = await fetchClimateRemote(48, "", "local", geoBucket);
    const computedDegree = Number(remoteLocalClimate?.computedDegree);
    if (!Number.isFinite(computedDegree)) throw new Error("REMOTE_LOCAL_CLIMATE_INVALID");
    return {
      source: remoteLocalClimate?.source === "local" ? "local" : "global_fallback",
      computedDegree: clamp(computedDegree, 0, SCALE),
      total: Number.isFinite(remoteLocalClimate?.total) ? remoteLocalClimate.total : 0,
      condition:
        typeof remoteLocalClimate?.condition === "string" && remoteLocalClimate.condition.length > 0
          ? remoteLocalClimate.condition
          : globalClimate.condition,
      repetition: normalizeRepetition(remoteLocalClimate?.repetition),
      pressureMode: remoteLocalClimate?.pressureMode || globalClimate.pressureMode || "",
      dominantMix: remoteLocalClimate?.dominantMix || "",
      stabilityIndex: Number.isFinite(remoteLocalClimate?.stabilityIndex)
        ? remoteLocalClimate.stabilityIndex
        : null,
      groundIndex: Number.isFinite(remoteLocalClimate?.groundIndex) ? remoteLocalClimate.groundIndex : null,
    };
  } catch {
    return { source: "global_fallback", ...globalClimate };
  }
}

async function boot() {
  const moments = loadMoments();
  const previousComputed = getStoredComputedDegree();
  const previousDisplay = getStoredDisplayDegree();
  const hasStoredDisplay = Number.isFinite(previousDisplay) || Number.isFinite(previousComputed);
  const optimisticStartDisplay = Number.isFinite(previousDisplay)
    ? previousDisplay
    : Number.isFinite(previousComputed)
      ? previousComputed
      : BASELINE;
  if (hasStoredDisplay) {
    degreeValue.textContent = formatDegree(optimisticStartDisplay);
    document.body.style.setProperty("--atmo", String(optimisticStartDisplay));
  } else {
    // First load with no stored state: avoid flashing a temporary fixed number.
    degreeValue.textContent = "";
    degreeValue.classList.add("is-pending");
    document.body.style.setProperty("--atmo", String(BASELINE));
  }

  const [sharedResult, climateTruth] = await Promise.all([loadSharedMoments(moments), loadClimateTruth(moments)]);
  const sharedMoments = sharedResult.items;
  const canonicalState = deriveClimateState(climateTruth, sharedMoments, moments);
  const localClimateTruth = await loadLocalClimateTruth(canonicalState);
  const localClimate = calculateClimate(getSharedMoments(moments));
  const computedDegree = climateTruth.computedDegree;
  const startDisplay = Number.isFinite(previousDisplay)
    ? previousDisplay
    : Number.isFinite(previousComputed)
      ? previousComputed
      : computedDegree;
  degreeValue.classList.remove("is-pending");

  let firstPhaseTarget = computedDegree;
  let settleDuration = 400;
  const patternVolatilityMs = climateTruth.repetition.hasPattern
    ? Math.round(clamp(climateTruth.repetition.strength * 550, 120, 330))
    : 0;

  if (contributed) {
    const delta = computedDegree - startDisplay;
    firstPhaseTarget = startDisplay + delta * 0.32;
    if (climateTruth.source === "remote" && Math.abs(delta) < 0.6) {
      const localDirection = Math.sign(localClimate.computedDegree - startDisplay) || 1;
      firstPhaseTarget = clamp(startDisplay + localDirection * 1.2, 0, SCALE);
    }
    settleDuration = clamp(3000 + Math.abs(delta) * 70 + patternVolatilityMs, 3000, 8000);
    showTransientReading();
    if (prefersReducedMotion) {
      animateDegree(startDisplay, computedDegree, 0);
      document.body.style.setProperty("--atmo", String(computedDegree));
    } else {
      animateDegree(startDisplay, firstPhaseTarget, 700);
      document.body.style.setProperty("--atmo", String(firstPhaseTarget));
      setTimeout(() => {
        animateDegree(firstPhaseTarget, computedDegree, settleDuration);
        document.body.style.setProperty("--atmo", String(computedDegree));
      }, 720);
    }
    window.history.replaceState({}, "", "./index.html");
  } else {
    animateDegree(startDisplay, computedDegree, 500);
    document.body.style.setProperty("--atmo", String(computedDegree));
  }

  setStoredComputedDegree(computedDegree);
  setStoredDisplayDegree(computedDegree);
  conditionLine.textContent = canonicalState.condition;
  renderPatternLayer(canonicalState);
  renderRecent(sharedMoments);
  renderHorizon(canonicalState, sharedMoments);
  renderLocalClimate(localClimateTruth);
  renderStrata(moments, canonicalState);

  viewMoreButton.onclick = () => openSharedSheet(sharedMoments);
  sheetBackdrop.onclick = closeSharedSheet;
  sharedSheetCloseButton.onclick = closeSharedSheet;
}

boot();

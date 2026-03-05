import { fetchClimateRemote, fetchGeoIndexRemote, fetchSharedMomentsRemote } from "./remote.js";

const STORAGE_KEY = "slipup_v2_moments";
const RENDER_LIMIT = 6;
const CENTER = 50;
const BASELINE = 28;
const SCALE = 100;
const RECENCY_HALFLIFE_HOURS = 18;
const RESPONSE_AMPLITUDE = 20;
const NOTE_SIGNAL_CAP = 0.16;
const COMPUTED_DEGREE_KEY = "slipup_v2_computed_degree";
const DISPLAY_DEGREE_KEY = "slipup_v2_display_degree";
const FIELD_SCOPE_KEY = "slipup_v2_field_scope";
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
        "Low shared volume.",
        "Global signal still early.",
        "Read pending more input.",
      ],
      steady: [
        "Global signal stable.",
        "Rhythm remains even.",
        "Pressure stays contained.",
      ],
      balance: [
        "Signal re-centering.",
        "Pressure and stability balancing.",
        "Read near equilibrium.",
      ],
      gathering: [
        "Global pressure increasing.",
        "Repetition lifting score.",
        "Shared density rising.",
      ],
      dense: [
        "High global density active.",
        "Pressure remains elevated.",
        "Score in dense band.",
      ],
    },
    horizon: {
      empty: [
        "No shared entries yet for horizon metrics.",
        "Horizon metrics are still waiting for input.",
        "There is no dominant short-window signal yet.",
        "Horizon read is pending first shared entries.",
        "Not enough data yet for horizon trend.",
      ],
      early: [
        "Horizon metrics are still in early formation.",
        "Dominant mix is still weakly defined.",
        "This horizon read is based on low volume.",
        "Trend is visible but still fragile.",
        "Short-window structure is still forming.",
      ],
      dominant: [
        (kind) => `Dominant mix in recent entries: ${kind}.`,
        (kind) => `Horizon read is currently led by ${kind}.`,
        (kind) => `Most frequent recent combination is ${kind}.`,
        (kind) => `Recent shared entries are skewing toward ${kind}.`,
        (kind) => `Horizon metrics show ${kind} as dominant.`,
        (kind) => `Primary short-window mix is ${kind}.`,
        (kind) => `This window is mostly driven by ${kind}.`,
        (kind) => `Horizon signal currently favors ${kind}.`,
      ],
      trendSteady: [
        "Stability index remains in steady range.",
        "Recent-entry rhythm is holding evenly.",
        "Horizon trend is stable across the window.",
        "Variation is low in short-window metrics.",
        "No major shift in current horizon pattern.",
        "Recent behavior remains consistently balanced.",
      ],
      trendShift: [
        "Stability index is showing active change.",
        "Recent-entry rhythm is still shifting.",
        "Horizon trend is reordering in this window.",
        "Short-window variation is still elevated.",
        "Current pattern has not stabilized yet.",
        "Recent behavior is changing between intervals.",
      ],
      driftCondensing: [
        "Pressure mode: condensing.",
        "Computed score is moving above baseline.",
        "Recent repetition is increasing pressure.",
        "Density remains high in short-window input.",
        "Horizon pressure is still tightening.",
        "Condensing behavior persists in this interval.",
      ],
      driftClearing: [
        "Pressure mode: clearing.",
        "Computed score is moving toward lower pressure.",
        "Recent repetition is easing in this window.",
        "Density is relaxing in short-window input.",
        "Horizon pressure is opening out.",
        "Clearing behavior persists in this interval.",
      ],
      driftStable: [
        "Pressure mode: stabilizing.",
        "Computed score is holding near baseline.",
        "Repetition pressure is currently contained.",
        "Horizon metrics remain in balanced range.",
        "No strong drift in this short window.",
        "Stabilizing behavior remains consistent.",
      ],
    },
    local: {
      condensing: [
        "Local entries are clustering into denser patterns.",
        "Local score is moving above its baseline band.",
        "Local repetition is adding pressure.",
        "Local density is tightening in this window.",
        "Nearby signal is trending condensing.",
        "This region is in a higher-pressure local phase.",
      ],
      clearing: [
        "Local entries are spreading into lighter patterns.",
        "Local score is easing toward lower pressure.",
        "Local repetition pressure is decreasing.",
        "Local density is opening in this window.",
        "Nearby signal is trending clearing.",
        "This region is in a lower-pressure local phase.",
      ],
      stable: [
        "Local entries keep a balanced rhythm.",
        "Local score stays near its baseline band.",
        "Local stability remains in steady range.",
        "Local variation is currently low.",
        "Nearby signal remains balanced.",
        "This region is holding a stable local phase.",
      ],
      fallback: [
        "Local sample is still low; using wider signal.",
        "Not enough local mass yet; mirroring wider read.",
        "Local density is early; fallback uses broader data.",
        "Local inputs are sparse; wider baseline is applied.",
        "Local signal is still forming; wider scope is used.",
        "Local mass is under threshold; global fallback active.",
      ],
      regional: [
        "Reading from shared entries in this selected region.",
        "Regional score is computed from local geo inputs.",
        "This local read uses shared entries from this scope.",
        "Selected regional data is shaping this result.",
        "Regional mass and pressure define this local line.",
        "This read reflects the current selected geo scope.",
      ],
    },
    strataFallback: [
      "Your private and shared moments settle below the surface.",
      "Your private and shared moments rest together in deeper layers.",
      "Below the surface, your moments settle side by side.",
      "Deeper layers hold your shared and private moments together.",
      "Your shared and private moments keep settling in deep record.",
      "Your deeper layers keep gathering settled moments.",
      "Your record below keeps compacting over time.",
    ],
    strataEarly: [
      "Your deep record is still forming.",
      "Only a light layer has settled in your deep record.",
      "Your deep record is beginning to gather moments.",
      "Your deeper record is just beginning to settle.",
      "Only first sediments are visible in your deep record.",
    ],
  },
  poetic: {
    condition: {
      quiet: [
        "Low shared volume.",
        "Global signal still early.",
        "Read pending more input.",
      ],
      steady: [
        "Global signal stable.",
        "Rhythm remains even.",
        "Pressure stays contained.",
      ],
      balance: [
        "Signal re-centering.",
        "Pressure and stability balancing.",
        "Read near equilibrium.",
      ],
      gathering: [
        "Global pressure increasing.",
        "Repetition lifting score.",
        "Shared density rising.",
      ],
      dense: [
        "High global density active.",
        "Pressure remains elevated.",
        "Score in dense band.",
      ],
    },
    horizon: {
      empty: [
        "Horizon metrics still have no shared entries.",
        "No dominant short-window signal is visible yet.",
        "Horizon read is waiting for first usable volume.",
        "Trend and mix are still undefined here.",
        "Not enough recent input for a horizon line.",
      ],
      early: [
        "Horizon metrics are still in early formation.",
        "Dominant mix is emerging but still light.",
        "Short-window structure is beginning to appear.",
        "Trend is visible but not yet firm.",
        "Current horizon line remains low-confidence.",
      ],
      dominant: [
        (kind) => `Dominant recent combination: ${kind}.`,
        (kind) => `Horizon read is currently led by ${kind}.`,
        (kind) => `Most repeated short-window mix is ${kind}.`,
        (kind) => `Recent entries now lean toward ${kind}.`,
        (kind) => `Horizon metrics currently favor ${kind}.`,
        (kind) => `This interval is mostly driven by ${kind}.`,
        (kind) => `Primary short-window behavior is ${kind}.`,
        (kind) => `Current horizon signal skews to ${kind}.`,
      ],
      trendSteady: [
        "Stability index remains in steady range.",
        "Recent-entry rhythm stays consistent.",
        "Horizon trend is stable across intervals.",
        "Short-window variation remains low.",
        "No major shift in current pattern.",
        "Recent behavior remains balanced.",
      ],
      trendShift: [
        "Stability index is showing active change.",
        "Recent-entry rhythm is still shifting.",
        "Horizon trend is reordering now.",
        "Short-window variation remains elevated.",
        "Current pattern has not stabilized yet.",
        "Recent behavior still changes by interval.",
      ],
      driftCondensing: [
        "Pressure mode is condensing.",
        "Score is moving above baseline band.",
        "Repetition pressure is still rising.",
        "Short-window density remains high.",
        "Horizon pressure is tightening now.",
        "Condensing behavior persists in this interval.",
      ],
      driftClearing: [
        "Pressure mode is clearing.",
        "Score is easing toward lower pressure.",
        "Repetition pressure is reducing now.",
        "Short-window density is relaxing.",
        "Horizon pressure is opening out.",
        "Clearing behavior persists in this interval.",
      ],
      driftStable: [
        "Pressure mode is stabilizing.",
        "Score remains near baseline.",
        "Repetition pressure is contained.",
        "Horizon metrics remain balanced.",
        "No strong drift in this interval.",
        "Stabilizing behavior remains consistent.",
      ],
    },
    local: {
      condensing: [
        "Local entries are drawing into denser clusters.",
        "Local score is moving above baseline.",
        "Local repetition is increasing pressure.",
        "This local window is tightening in density.",
        "Nearby signal is in condensing behavior.",
        "Local pressure remains elevated.",
      ],
      clearing: [
        "Local entries are spreading into lighter clusters.",
        "Local score is easing toward lower pressure.",
        "Local repetition pressure is decreasing.",
        "This local window is opening in density.",
        "Nearby signal is in clearing behavior.",
        "Local pressure is easing now.",
      ],
      stable: [
        "Local entries keep a balanced rhythm.",
        "Local score stays near baseline.",
        "Local stability remains steady.",
        "Local variation is currently low.",
        "Nearby signal remains in balanced range.",
        "Local behavior is stable across intervals.",
      ],
      fallback: [
        "Local sample is still low; using wider signal.",
        "Not enough local mass yet; wider scope is applied.",
        "Local density is still thin; fallback is active.",
        "Sparse local inputs; mirroring broader baseline.",
        "Local read is early; using wider shared data.",
        "Local threshold not reached; global fallback in use.",
      ],
      regional: [
        "Reading from shared entries in the selected region.",
        "Regional score is computed from selected geo inputs.",
        "This local read uses shared entries from this scope.",
        "Selected regional mass is shaping this result.",
        "Regional pressure and stability define this line.",
        "This read reflects the active geo selection.",
      ],
    },
    strataFallback: [
      "Shared and private moments settle into your deeper record.",
      "Shared and private moments rest in your deeper record.",
      "In deeper layers, your moments settle side by side.",
      "Your deeper record gathers shared and private moments together.",
      "Shared and private moments keep settling in your deeper layers.",
      "Your deeper layers keep settling shared and private moments.",
      "Your record below keeps compacting in quiet layers.",
    ],
    strataEarly: [
      "Your deep record is still taking shape.",
      "Only a thin layer has settled in your deep record.",
      "Your deep record is beginning to gather moments.",
      "Your deeper record is still in first sediment.",
      "Only first layers are visible in your deep record.",
    ],
  },
};
const COPY = COPY_VARIANTS[COPY_MODE] || COPY_VARIANTS.clear;
// FUTURE: Keep scaffold switches explicit for non-active UI lines.
const FUTURE_UI = {
  readingConfidenceLine: false,
};
const SIGNAL_VARIANTS = {
  clear: {
    confidence: {
      early: [
        "Read confidence: early.",
        "Confidence still forming from low volume.",
      ],
      building: [
        "Read confidence: building.",
        "Confidence increasing with added volume.",
      ],
      firm: [
        "Read confidence: firm.",
        "Confidence stable at current volume.",
      ],
    },
    pulse: {
      early: [
        "Recent signal is still early in this window.",
        "There are still few shared entries in this window.",
        "Not enough recent entries to define a clear pace.",
        "This line is still forming from recent entries.",
      ],
      rising: [
        "Recent entry pace is rising.",
        "More entries arrived in the last 15 minutes.",
        "Short-window activity is increasing.",
        "This line shows acceleration in recent entries.",
      ],
      easing: [
        "Recent entry pace is easing.",
        "Fewer entries arrived in the last 15 minutes.",
        "Short-window activity is slowing down.",
        "This line shows deceleration in recent entries.",
      ],
      steady: [
        "Recent entry pace is steady.",
        "Entry rhythm is stable across this window.",
        "Last and prior 15-minute windows are balanced.",
        "This line shows stable short-window activity.",
      ],
    },
    echo: {
      fallback: [
        "Nearby echo follows the wider field for now.",
        "Nearby echo is using the wider field for now.",
      ],
      aligned: [
        "Nearby echo is closely aligned with the wider field.",
        "Nearby echo tracks the wider field closely.",
      ],
      near: [
        "Nearby echo is close to the wider field.",
        "Nearby echo keeps a similar line to the wider field.",
      ],
      offset: [
        "Nearby echo is moving on a distinct local line.",
        "Nearby echo shows a distinct local contour.",
      ],
    },
  },
  poetic: {
    confidence: {
      early: [
        "Read confidence: early.",
        "Confidence still forming from low volume.",
      ],
      building: [
        "Read confidence: building.",
        "Confidence increasing with added volume.",
      ],
      firm: [
        "Read confidence: firm.",
        "Confidence stable at current volume.",
      ],
    },
    pulse: {
      early: [
        "Recent signal is still in first formation.",
        "Only a few shared entries are visible in this window.",
        "This line is still gathering enough recent signal.",
        "Not enough recent entries to trace a firm pace.",
      ],
      rising: [
        "Recent entry rhythm is rising.",
        "The last 15 minutes carry more shared entries.",
        "Short-window signal is gaining pace.",
        "This line traces acceleration in recent entries.",
      ],
      easing: [
        "Recent entry rhythm is easing.",
        "The last 15 minutes carry fewer shared entries.",
        "Short-window signal is softening.",
        "This line traces deceleration in recent entries.",
      ],
      steady: [
        "Recent entry rhythm keeps a steady line.",
        "Short-window signal holds a quiet balance.",
        "Last and prior 15-minute windows stay close.",
        "This line reflects stable recent activity.",
      ],
    },
    echo: {
      fallback: [
        "Nearby echo follows the wider field for now.",
        "Nearby echo is still borrowing the wider line.",
      ],
      aligned: [
        "Nearby echo stays close to the wider field.",
        "Nearby echo moves in step with the wider field.",
      ],
      near: [
        "Nearby echo remains near the wider line.",
        "Nearby echo keeps close to the wider field.",
      ],
      offset: [
        "Nearby echo draws a distinct local contour.",
        "Nearby echo diverges into its own local line.",
      ],
    },
  },
};
const SIGNALS = SIGNAL_VARIANTS[COPY_MODE] || SIGNAL_VARIANTS.clear;
const REGIONAL_LOCAL_COPY = {
  common: {
    condensing: [
      "Local density is tightening in this scope.",
      "Local score is rising above baseline.",
      "Local repetition is adding pressure.",
    ],
    clearing: [
      "Local density is easing in this scope.",
      "Local score is moving toward lower pressure.",
      "Local repetition pressure is decreasing.",
    ],
    stable: [
      "Local score remains near baseline.",
      "Local variation stays in stable range.",
      "Local rhythm remains balanced.",
    ],
    fallback: [
      "Local signal is still light. It follows the wider field.",
      "Local signal is still forming from the wider field.",
      "Local signal is still emerging from shared flow.",
    ],
    regional: [
      "Local reading is shaped by shared moments in this zone.",
      "Shared moments in this zone shape this local line.",
      "This local read follows shared signal from this zone.",
    ],
  },
  continents: {
    america: {
      condensing: [
        "American scope shows rising local density.",
        "American local score is in condensing mode.",
      ],
      clearing: [
        "American scope shows easing local density.",
        "American local score is in clearing mode.",
      ],
      stable: [
        "American scope stays in stable local range.",
        "American local rhythm remains balanced.",
      ],
    },
    europe: {
      condensing: [
        "European scope shows rising local density.",
        "European local score is in condensing mode.",
      ],
      clearing: [
        "European scope shows easing local density.",
        "European local score is in clearing mode.",
      ],
      stable: [
        "European scope stays in stable local range.",
        "European local rhythm remains balanced.",
      ],
    },
    africa: {
      condensing: [
        "African scope shows rising local density.",
        "African local score is in condensing mode.",
      ],
      clearing: [
        "African scope shows easing local density.",
        "African local score is in clearing mode.",
      ],
      stable: [
        "African scope stays in stable local range.",
        "African local rhythm remains balanced.",
      ],
    },
    asia: {
      condensing: [
        "Asian scope shows rising local density.",
        "Asian local score is in condensing mode.",
      ],
      clearing: [
        "Asian scope shows easing local density.",
        "Asian local score is in clearing mode.",
      ],
      stable: [
        "Asian scope stays in stable local range.",
        "Asian local rhythm remains balanced.",
      ],
    },
    australia: {
      condensing: [
        "Oceanian scope shows rising local density.",
        "Oceanian local score is in condensing mode.",
      ],
      clearing: [
        "Oceanian scope shows easing local density.",
        "Oceanian local score is in clearing mode.",
      ],
      stable: [
        "Oceanian scope stays in stable local range.",
        "Oceanian local rhythm remains balanced.",
      ],
    },
  },
};

function pickCopy(entry, seed) {
  if (Array.isArray(entry)) {
    if (!entry.length) return "";
    return entry[Math.abs(seed) % entry.length];
  }
  return entry;
}

function scopeContinent(fieldScope) {
  const geo = String(fieldScope?.geo || "");
  const parts = geo.split(".").filter(Boolean);
  return parts[1] || "";
}

function pickRegionalLocalCopy(mode, fieldScope, seed) {
  const continent = scopeContinent(fieldScope);
  const common = REGIONAL_LOCAL_COPY.common[mode] || [];
  const regional = REGIONAL_LOCAL_COPY.continents[continent]?.[mode] || [];
  const merged = [...regional, ...common];
  if (merged.length) return pickCopy(merged, seed);
  return "";
}

function pickCopyFromState(entry, numericSeed) {
  const chosen = pickCopy(entry, numericSeed);
  if (typeof chosen === "function") return chosen;
  return () => String(chosen || "");
}

const degreeValue = document.getElementById("degreeValue");
const conditionLine = document.getElementById("conditionLine");
// FUTURE: kept as scaffold for a possible hero confidence line return.
const readingConfidenceLine = document.getElementById("readingConfidenceLine");
const observatoryPanel = document.getElementById("observatory");
const recentMoments = document.getElementById("recentMoments");
const viewMoreButton = document.getElementById("viewMoreButton");
const horizonPrimary = document.getElementById("horizonPrimary");
const horizonPulseLine = document.getElementById("horizonPulseLine");
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
const fieldScopeSelect = document.getElementById("fieldScopeSelect");
const localClimateDegree = document.getElementById("localClimateDegree");
const localClimateMass = document.getElementById("localClimateMass");
const localClimatePrimary = document.getElementById("localClimatePrimary");
const localClimateSecondary = document.getElementById("localClimateSecondary");
const localClimateEcho = document.getElementById("localClimateEcho");
const groundStrata = document.getElementById("ground-strata");
const strataLines = document.getElementById("strataLines");

const query = new URLSearchParams(window.location.search);
const contributed = query.get("contributed") === "1";
const SHARED_SHEET_MAX_ITEMS = 50;
const SHEET_TRANSITION_MS = 280;
const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

let isSharedSheetOpen = false;
let lastFocusedEl = null;
let infiniteScrollReady = false;

function renderFutureConfidenceLine(canonicalState, pipeline) {
  if (!FUTURE_UI.readingConfidenceLine || !readingConfidenceLine) return;
  const confidenceMode = pipeline?.signalModes?.confidence || classifyConfidence(canonicalState?.total || 0);
  const seed = Math.round((canonicalState?.computedDegree || BASELINE) * 10) + (canonicalState?.total || 0);
  const variants = SIGNALS?.confidence?.[confidenceMode] || SIGNALS?.confidence?.early || [];
  readingConfidenceLine.textContent = pickCopy(variants, seed);
}

function renderScopeInstrument(canonicalState) {
  if (!observatoryPanel) return;
  const total = Number(canonicalState?.total) || 0;
  const degree = Number(canonicalState?.computedDegree) || BASELINE;
  const repetition = canonicalState?.repetition || { hasPattern: false };

  let tone = "steady";
  if (total < 3 || degree < 38) tone = "quiet";
  else if (degree >= 74) tone = "dense";
  else if (degree >= 60) tone = "active";

  observatoryPanel.dataset.scopeTone = tone;
  observatoryPanel.classList.toggle("is-target-lock", Boolean(repetition?.hasPattern));
}

function initSilentDescentTransitions() {
  const sections = [
    document.querySelector(".panel-recent"),
    document.getElementById("horizon"),
    document.getElementById("local-climate"),
  ].filter(Boolean);

  if (!sections.length) return;

  sections.forEach((section, index) => {
    section.classList.add("silent-descent");
    if (index === 0) section.classList.add("is-revealed");
  });

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    sections.forEach((section) => section.classList.add("is-revealed"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
  );

  sections.slice(1).forEach((section) => observer.observe(section));
}

function initInfiniteObservatoryScroll() {
  if (infiniteScrollReady) return;
  infiniteScrollReady = true;

  const scroller = document.scrollingElement || document.documentElement;
  if (!scroller) return;

  let wrapLockUntil = 0;
  let touchStartY = null;
  const threshold = 18;
  const minDelta = 26;
  const lockMs = 380;

  const canWrap = () => {
    if (Date.now() < wrapLockUntil) return false;
    if (document.body.classList.contains("sheet-open")) return false;
    const active = document.activeElement;
    if (!active) return true;
    const tag = active.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;
    return true;
  };

  const wrapTo = (targetTop, direction) => {
    wrapLockUntil = Date.now() + lockMs;
    document.body.classList.add("loop-warp", direction === "up" ? "loop-warp-up" : "loop-warp-down");
    window.scrollTo({ top: targetTop, behavior: "auto" });
    window.setTimeout(() => {
      document.body.classList.remove("loop-warp", "loop-warp-up", "loop-warp-down");
    }, 220);
  };

  const onWheel = (event) => {
    if (!canWrap()) return;
    const max = Math.max(0, scroller.scrollHeight - window.innerHeight);
    const y = window.scrollY || scroller.scrollTop || 0;
    if (max <= threshold * 2) return;

    if (y <= threshold && event.deltaY < -minDelta) {
      event.preventDefault();
      const carry = clamp(Math.abs(event.deltaY), 0, 120);
      wrapTo(Math.max(threshold, max - threshold - carry), "up");
      return;
    }
    if (y >= max - threshold && event.deltaY > minDelta) {
      event.preventDefault();
      const carry = clamp(Math.abs(event.deltaY), 0, 120);
      wrapTo(Math.min(max - threshold, threshold + carry), "down");
    }
  };

  const onTouchStart = (event) => {
    if (!event.touches?.length) return;
    touchStartY = event.touches[0].clientY;
  };

  const onTouchMove = (event) => {
    if (!canWrap() || touchStartY === null || !event.touches?.length) return;
    const currentY = event.touches[0].clientY;
    const delta = touchStartY - currentY;
    const max = Math.max(0, scroller.scrollHeight - window.innerHeight);
    const y = window.scrollY || scroller.scrollTop || 0;
    if (max <= threshold * 2) return;

    if (y <= threshold && delta < -minDelta) {
      const carry = clamp(Math.abs(delta), 0, 120);
      wrapTo(Math.max(threshold, max - threshold - carry), "up");
      touchStartY = currentY;
      return;
    }
    if (y >= max - threshold && delta > minDelta) {
      const carry = clamp(Math.abs(delta), 0, 120);
      wrapTo(Math.min(max - threshold, threshold + carry), "down");
      touchStartY = currentY;
    }
  };

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
}

function applyDeepLinkIfPresent() {
  const hash = window.location.hash || "";
  if (!hash) return;
  const target = document.querySelector(hash);
  if (!target) return;
  window.setTimeout(() => {
    target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  }, 40);
}

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
    "Pattern A detected: avoidable + stressed repeats.",
    "Repeated stressed avoidable entries are increasing pressure.",
    "Short-window score rises with avoidable-stressed recurrence.",
    "The same avoidable-stressed mix is returning often.",
    "Pattern A remains active in this interval.",
  ],
  pattern_b: [
    "Pattern B detected: same avoidable mood repeats.",
    "A repeated avoidable mood loop is present.",
    "Short-window repetition is clustering by one mood.",
    "The same avoidable mood reappears across intervals.",
    "Pattern B remains active in recent entries.",
  ],
  pattern_c: [
    "Pattern C detected: close-time avoidable clustering.",
    "Multiple entries arrived in a short avoidable cluster.",
    "Recent events are grouped in short time pockets.",
    "Short-window clustering is increasing local pressure.",
    "Pattern C remains visible in current timing.",
  ],
};

const COMBINATION_LINES = {
  "avoidable|calm": [
    "Avoidable + calm is leading the recent mix.",
    "Low-intensity avoidable entries are recurring.",
    "Avoidable-calm shows repeated but contained pressure.",
    "Recent entries favor avoidable behavior with calm mood.",
    "This window is dominated by avoidable-calm events.",
  ],
  "avoidable|focus": [
    "Avoidable + focus is leading the recent mix.",
    "Focused avoidable entries are recurring in sequence.",
    "Avoidable-focus shows persistent directional repetition.",
    "Recent entries favor avoidable behavior with focus mood.",
    "This window is dominated by avoidable-focus events.",
  ],
  "avoidable|stressed": [
    "Avoidable + stressed is leading the recent mix.",
    "Stressed avoidable entries are recurring frequently.",
    "Avoidable-stressed is driving pressure increase.",
    "Recent entries favor avoidable behavior with stress mood.",
    "This window is dominated by avoidable-stressed events.",
  ],
  "avoidable|curious": [
    "Avoidable + curious is leading the recent mix.",
    "Curious avoidable entries are recurring in short loops.",
    "Avoidable-curious shows exploratory but repeated behavior.",
    "Recent entries favor avoidable behavior with curious mood.",
    "This window is dominated by avoidable-curious events.",
  ],
  "avoidable|tired": [
    "Avoidable + tired is leading the recent mix.",
    "Tired avoidable entries are repeating with persistence.",
    "Avoidable-tired shows low-energy recurrent pressure.",
    "Recent entries favor avoidable behavior with tired mood.",
    "This window is dominated by avoidable-tired events.",
  ],
  "fertile|calm": [
    "Fertile + calm is leading the recent mix.",
    "Calm fertile entries are recurring in this window.",
    "Fertile-calm is associated with lower pressure drift.",
    "Recent entries favor fertile behavior with calm mood.",
    "This window is dominated by fertile-calm events.",
  ],
  "fertile|focus": [
    "Fertile + focus is leading the recent mix.",
    "Focused fertile entries are recurring in sequence.",
    "Fertile-focus is associated with stable clearing drift.",
    "Recent entries favor fertile behavior with focus mood.",
    "This window is dominated by fertile-focus events.",
  ],
  "fertile|stressed": [
    "Fertile + stressed is leading the recent mix.",
    "Stressed fertile entries are recurring in this window.",
    "Fertile-stressed moderates pressure without full reversal.",
    "Recent entries favor fertile behavior with stress mood.",
    "This window is dominated by fertile-stressed events.",
  ],
  "fertile|curious": [
    "Fertile + curious is leading the recent mix.",
    "Curious fertile entries are recurring in short loops.",
    "Fertile-curious supports exploratory lower-pressure drift.",
    "Recent entries favor fertile behavior with curious mood.",
    "This window is dominated by fertile-curious events.",
  ],
  "fertile|tired": [
    "Fertile + tired is leading the recent mix.",
    "Tired fertile entries are recurring at lower pace.",
    "Fertile-tired keeps slight clearing pressure active.",
    "Recent entries favor fertile behavior with tired mood.",
    "This window is dominated by fertile-tired events.",
  ],
  "observed|calm": [
    "Observed + calm is leading the recent mix.",
    "Calm observed entries are recurring in this window.",
    "Observed-calm supports stabilization in the score.",
    "Recent entries favor observed behavior with calm mood.",
    "This window is dominated by observed-calm events.",
  ],
  "observed|focus": [
    "Observed + focus is leading the recent mix.",
    "Focused observed entries are recurring in sequence.",
    "Observed-focus supports stable low-variance behavior.",
    "Recent entries favor observed behavior with focus mood.",
    "This window is dominated by observed-focus events.",
  ],
  "observed|stressed": [
    "Observed + stressed is leading the recent mix.",
    "Stressed observed entries are recurring in this window.",
    "Observed-stressed contains pressure variation.",
    "Recent entries favor observed behavior with stress mood.",
    "This window is dominated by observed-stressed events.",
  ],
  "observed|curious": [
    "Observed + curious is leading the recent mix.",
    "Curious observed entries are recurring in short loops.",
    "Observed-curious supports adaptive stable behavior.",
    "Recent entries favor observed behavior with curious mood.",
    "This window is dominated by observed-curious events.",
  ],
  "observed|tired": [
    "Observed + tired is leading the recent mix.",
    "Tired observed entries are recurring at lower pace.",
    "Observed-tired keeps baseline orientation stable.",
    "Recent entries favor observed behavior with tired mood.",
    "This window is dominated by observed-tired events.",
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

function classifyConfidence(total) {
  if (total < 8) return "early";
  if (total < 24) return "building";
  return "firm";
}

function countInWindow(items, minMinutes, maxMinutes) {
  const now = Date.now();
  return items.filter((m) => {
    const ageMinutes = (now - new Date(m.timestamp).getTime()) / 60000;
    return ageMinutes >= minMinutes && ageMinutes < maxMinutes;
  }).length;
}

function classifyPulse(sharedMoments) {
  if (!Array.isArray(sharedMoments) || sharedMoments.length < 3) return "early";
  const recent15 = countInWindow(sharedMoments, 0, 15);
  const prior15 = countInWindow(sharedMoments, 15, 30);
  if (recent15 >= 2 && recent15 >= prior15 + 1) return "rising";
  if (prior15 >= 2 && recent15 + 1 <= prior15) return "easing";
  return "steady";
}

function classifyEcho(localState, globalState) {
  if (localState?.source === "global_fallback") return "fallback";
  const local = Number(localState?.computedDegree);
  const global = Number(globalState?.computedDegree);
  if (!Number.isFinite(local) || !Number.isFinite(global)) return "fallback";
  const delta = Math.abs(local - global);
  if (delta < 3) return "aligned";
  if (delta < 7) return "near";
  return "offset";
}

function deriveMomentContribution(moment, nowMs = Date.now()) {
  const ageHours = Math.max(0, (nowMs - new Date(moment.timestamp).getTime()) / 3600_000);
  const mass = recencyMass(ageHours);
  const influence = getInfluenceCell(moment.type, moment.mood);
  const signal = noteSignal(moment.note || "");
  const semanticPressure = signal.reactive - signal.reflective;
  const semanticStabilize = signal.reflective * 0.75;
  const basePressure = signedPressure(influence.mode, influence.strength);
  const weightedPressure = (basePressure + semanticPressure) * mass;
  const weightedStabilize =
    (influence.mode === "stabilize" ? influence.strength * mass : 0) + semanticStabilize * mass;
  return {
    id: moment.id || "",
    mass,
    weightedPressure,
    weightedStabilize,
  };
}

// Observatory pipeline: each contributed moment becomes weighted signal,
// then aggregate signals feed confidence, pulse, and echo layers.
function buildObservatoryPipeline(sharedMoments, canonicalState, localState, activeFieldScope) {
  const entries = Array.isArray(sharedMoments) ? sharedMoments : [];
  const contributions = entries.slice(0, 180).map((moment) => deriveMomentContribution(moment));
  const totals = contributions.reduce(
    (acc, item) => {
      acc.mass += item.mass;
      acc.pressure += item.weightedPressure;
      acc.stabilize += item.weightedStabilize;
      return acc;
    },
    { mass: 0, pressure: 0, stabilize: 0 }
  );
  return {
    sourceCount: entries.length,
    contributionMass: totals.mass,
    contributionPressure: totals.pressure,
    contributionStabilize: totals.stabilize,
    signalModes: {
      confidence: classifyConfidence(Number(localState?.total) || 0),
      pulse: classifyPulse(entries),
      echo: classifyEcho(localState, canonicalState),
    },
    fieldScope: {
      id: activeFieldScope?.id || "nearby",
      label: activeFieldScope?.label || "Nearby",
    },
  };
}

function getStoredFieldScope() {
  try {
    return localStorage.getItem(FIELD_SCOPE_KEY) || "nearby";
  } catch {
    return "nearby";
  }
}

function setStoredFieldScope(value) {
  try {
    localStorage.setItem(FIELD_SCOPE_KEY, value);
  } catch {
    // Ignore write errors in private mode.
  }
}

function toTitlePart(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildCountryIndex(countries) {
  const byContinent = new Map();
  (Array.isArray(countries) ? countries : []).forEach((item) => {
    const continent = String(item?.continent || "").toLowerCase();
    const country = String(item?.country || "").toLowerCase();
    if (!continent || !country) return;
    if (!byContinent.has(continent)) byContinent.set(continent, []);
    byContinent.get(continent).push({
      continent,
      country,
      count: Number(item?.count) || 0,
    });
  });
  byContinent.forEach((list) => {
    list.sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
  });
  return byContinent;
}

function buildFieldLensModel(fieldScopes, countryIndex) {
  const groups = [
    { label: "Home lens", items: [] },
    { label: "Continents", items: [] },
    { label: "Countries with signal", items: [] },
  ];
  const byValue = new Map();

  const pushItem = (groupIdx, value, label, scope) => {
    groups[groupIdx].items.push({ value, label });
    byValue.set(value, scope);
  };

  (Array.isArray(fieldScopes) ? fieldScopes : []).forEach((scope) => {
    const value = `scope:${scope.id}`;
    const isHome = scope.id === "nearby" || scope.id === "regional-home" || scope.id === "wider-home";
    const isGlobal = scope.id === "global";
    pushItem(isHome ? 0 : isGlobal ? 1 : 1, value, scope.label, scope);
  });

  const continentOrder = ["america", "europe", "africa", "asia", "australia"];
  continentOrder.forEach((continent) => {
    const list = countryIndex.get(continent) || [];
    list.slice(0, 20).forEach((entry) => {
      const value = `country:${entry.continent}:${entry.country}`;
      const label = `${toTitlePart(entry.continent)} · ${toTitlePart(entry.country)} (${entry.count})`;
      const scope = {
        id: `country-${entry.continent}-${entry.country}`,
        label: `${toTitlePart(entry.country)} field`,
        scope: "local",
        geo: `tz.${entry.continent}.${entry.country}`,
      };
      pushItem(2, value, label, scope);
    });
  });

  if (!groups[2].items.length) {
    groups[2].items.push({
      value: "",
      label: "No country signal available yet",
    });
  }

  return { groups, byValue };
}

function normalizeStoredFieldScopeValue(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return "scope:nearby";
  if (value.startsWith("scope:") || value.startsWith("country:")) return value;
  return `scope:${value}`;
}

function renderFieldLensSelect(model, preferredValue) {
  if (!fieldScopeSelect) return "";
  fieldScopeSelect.innerHTML = "";
  model.groups.forEach((group) => {
    if (!group.items.length) return;
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    group.items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      optgroup.appendChild(option);
    });
    fieldScopeSelect.appendChild(optgroup);
  });
  const fallbackValue =
    model.groups.flatMap((group) => group.items).find((item) => model.byValue.has(item.value))?.value || "";
  const selectedValue = model.byValue.has(preferredValue) ? preferredValue : fallbackValue;
  fieldScopeSelect.value = selectedValue;
  return selectedValue;
}

function buildFieldScopeOptions() {
  const nearbyGeo = guessGeoBucketFromTimezone();
  const options = [];
  const seen = new Set();
  const pushOption = (option) => {
    const dedupeKey = `${option.id}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    options.push(option);
  };
  const segments = nearbyGeo ? nearbyGeo.split(".").filter(Boolean) : [];

  pushOption({ id: "nearby", label: "Nearby", scope: "local", geo: nearbyGeo });

  if (segments.length >= 3) {
    const regionalGeo = segments.slice(0, 3).join(".");
    pushOption({
      id: "regional-home",
      label: "Regional (home)",
      scope: "local",
      geo: regionalGeo,
    });
  }

  if (segments.length >= 2) {
    const broadGeo = segments.slice(0, 2).join(".");
    pushOption({
      id: "wider-home",
      label: "Wider field (home)",
      scope: "local",
      geo: broadGeo,
    });
  }

  [
    { id: "zone-americas", label: "Americas field", geo: "tz.america" },
    { id: "zone-europe", label: "Europe field", geo: "tz.europe" },
    { id: "zone-africa", label: "Africa field", geo: "tz.africa" },
    { id: "zone-asia", label: "Asia field", geo: "tz.asia" },
    { id: "zone-oceania", label: "Oceania field", geo: "tz.australia" },
  ].forEach((zone) => {
    pushOption({ id: zone.id, label: zone.label, scope: "local", geo: zone.geo });
  });

  pushOption({ id: "global", label: "Global", scope: "global", geo: "" });
  return options;
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

function renderHorizon(canonicalState, sharedMoments, pipeline = null) {
  const total = sharedMoments.length;
  const seed = Math.round((canonicalState?.computedDegree || BASELINE) * 10) + total;
  const pulseMode = pipeline?.signalModes?.pulse || classifyPulse(sharedMoments);
  horizonPulseLine.textContent = pickCopy(SIGNALS.pulse[pulseMode], seed + total);
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

function renderLocalClimate(localState, canonicalState, scopeLabel = "Nearby", pipeline = null, fieldScope = null) {
  const pressureMode = localState?.pressureMode || "stabilizing";
  const seed = Math.round((localState?.computedDegree || BASELINE) * 10) + (localState?.total || 0);
  const pressureText = pickRegionalLocalCopy(
    pressureMode === "condensing" ? "condensing" : pressureMode === "clearing" ? "clearing" : "stable",
    fieldScope,
    seed
  ) ||
    (pressureMode === "condensing"
      ? pickCopy(COPY.local.condensing, seed)
      : pressureMode === "clearing"
        ? pickCopy(COPY.local.clearing, seed)
        : pickCopy(COPY.local.stable, seed));

  localClimatePrimary.textContent = pressureText;
  const roundedDegree = Math.round(Number(localState?.computedDegree) || BASELINE);
  const total = Number(localState?.total) || 0;
  const confidenceMode = pipeline?.signalModes?.confidence || classifyConfidence(total);
  if (localClimateDegree) {
    localClimateDegree.textContent = `${roundedDegree}° ${scopeLabel.toLowerCase()}`;
  }
  if (localClimateMass) {
    localClimateMass.textContent = `${total} shared · ${confidenceMode}`;
  }
  if (localState?.source === "global_view") {
    localClimateSecondary.textContent = "Reading shared moments across the wider field.";
    localClimateEcho.textContent = "Wider field lens selected.";
    return;
  }
  const echoMode = pipeline?.signalModes?.echo || classifyEcho(localState, canonicalState);
  localClimateEcho.textContent = pickCopy(SIGNALS.echo[echoMode], seed + 5);
  if (localState?.source === "global_fallback") {
    localClimateSecondary.textContent =
      pickRegionalLocalCopy("fallback", fieldScope, seed + 3) || pickCopy(COPY.local.fallback, seed);
    return;
  }
  localClimateSecondary.textContent =
    pickRegionalLocalCopy("regional", fieldScope, seed + 7) || pickCopy(COPY.local.regional, seed);
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
    lines.push("30-day pressure trend: condensing.");
  } else if (canonicalState.pressureMode === "clearing") {
    lines.push("30-day pressure trend: clearing.");
  } else {
    lines.push("30-day pressure trend: stabilizing.");
  }

  if (counts.avoidable >= 5 && moods.stressed >= 3) {
    lines.push("Avoidable + stressed recurrence is high in 30-day data.");
  }
  if (counts.fertile >= 4 && moods.calm >= 3) {
    lines.push("Fertile + calm recurrence is visible in 30-day data.");
  }
  if (counts.observed >= 4) {
    lines.push("Observed entries are adding stability to the deep read.");
  }

  const moodDiversity = Object.values(moods).filter((count) => count > 0).length;
  if (moodDiversity >= 4) {
    lines.push("Mood diversity is high across the 30-day window.");
  }

  const avoidableRatio = counts.avoidable / total;
  const fertileRatio = counts.fertile / total;
  if (avoidableRatio > 0.42 && fertileRatio > 0.22) {
    lines.push("Avoidable and fertile ratios are both significant (mixed signal).");
  } else if (fertileRatio > 0.38) {
    lines.push("Fertile ratio is dominant in the 30-day mix.");
  }

  if (total >= 24) {
    lines.push("Deep confidence is stronger with sustained 30-day volume.");
  }

  if (lines.length < 2) {
    lines.push("Deep read is still building from recurring entries.");
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
  renderScopeInstrument(canonicalState);
  const total = Number(canonicalState?.total) || 0;
  if (total < 6) {
    atmospherePatternLine.textContent = "";
    atmospherePatternLine.classList.add("hidden");
    return;
  }

  const dominant = canonicalState?.dominantMix || "";
  const tagMap = {
    pattern_a: "Pattern A: avoidable|stressed repeating.",
    pattern_b: "Pattern B: repeated avoidable mood.",
    pattern_c: "Pattern C: short-time clustering.",
  };
  const line = repetition?.hasPattern
    ? tagMap[repetition.tag] || "Pattern signal active."
    : dominant
      ? `Dominant mix: ${dominant}.`
      : "";

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

async function loadFieldClimateTruth(globalClimate, fieldScope) {
  const scope = fieldScope?.scope || "local";
  if (scope === "global") {
    return { source: "global_view", ...globalClimate };
  }

  const geoBucket = fieldScope?.geo || guessGeoBucketFromTimezone();
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
  const fieldScopes = buildFieldScopeOptions();
  const preferredScopeValue = normalizeStoredFieldScopeValue(getStoredFieldScope());
  let countryIndex = new Map();
  try {
    const geoIndex = await fetchGeoIndexRemote(8760, "", 4000);
    countryIndex = buildCountryIndex(geoIndex?.countries);
  } catch {
    countryIndex = new Map();
  }
  const fieldLensModel = buildFieldLensModel(fieldScopes, countryIndex);
  let selectedScopeValue = renderFieldLensSelect(fieldLensModel, preferredScopeValue);
  let activeFieldScope =
    fieldLensModel.byValue.get(selectedScopeValue) ||
    fieldScopes[0] || {
      id: "nearby",
      label: "Nearby",
      scope: "local",
      geo: "",
    };
  setStoredFieldScope(selectedScopeValue);
  let localClimateTruth = await loadFieldClimateTruth(canonicalState, activeFieldScope);
  let observatoryPipeline = buildObservatoryPipeline(
    sharedMoments,
    canonicalState,
    localClimateTruth,
    activeFieldScope
  );
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
  renderFutureConfidenceLine(canonicalState, observatoryPipeline);
  renderPatternLayer(canonicalState);
  renderRecent(sharedMoments);
  renderHorizon(canonicalState, sharedMoments, observatoryPipeline);
  renderLocalClimate(
    localClimateTruth,
    canonicalState,
    activeFieldScope.label || "Nearby",
    observatoryPipeline,
    activeFieldScope
  );
  renderStrata(moments, canonicalState);
  initSilentDescentTransitions();
  initInfiniteObservatoryScroll();
  applyDeepLinkIfPresent();

  viewMoreButton.onclick = () => openSharedSheet(sharedMoments);
  sheetBackdrop.onclick = closeSharedSheet;
  sharedSheetCloseButton.onclick = closeSharedSheet;

  if (fieldScopeSelect) {
    let requestToken = 0;
    fieldScopeSelect.onchange = async () => {
      const nextScope = fieldLensModel.byValue.get(fieldScopeSelect.value) || activeFieldScope;
      activeFieldScope = nextScope;
      selectedScopeValue = fieldScopeSelect.value;
      setStoredFieldScope(selectedScopeValue);
      const token = ++requestToken;
      fieldScopeSelect.disabled = true;
      try {
        const nextClimate = await loadFieldClimateTruth(canonicalState, nextScope);
        if (token !== requestToken) return;
        localClimateTruth = nextClimate;
        observatoryPipeline = buildObservatoryPipeline(
          sharedMoments,
          canonicalState,
          localClimateTruth,
          activeFieldScope
        );
        renderFutureConfidenceLine(canonicalState, observatoryPipeline);
        renderHorizon(canonicalState, sharedMoments, observatoryPipeline);
        renderLocalClimate(
          localClimateTruth,
          canonicalState,
          activeFieldScope.label || "Nearby",
          observatoryPipeline,
          activeFieldScope
        );
      } finally {
        fieldScopeSelect.disabled = false;
      }
    };
  }
}

boot();

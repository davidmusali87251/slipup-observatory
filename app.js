import {
  fetchClimateRemote,
  fetchGeoIndexRemote,
  fetchSharedMomentsRemote,
  isRemoteReady,
  postRelateMoment,
} from "./remote.js";
import {
  BASELINE,
  SCALE,
  DEGREE_SCALE_BANDS,
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
  MASS_INERTIA_REF,
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
  INFLUENCE,
  INFLUENCE_DEFAULT_STRENGTH,
  chooseAlpha,
  REFLECTIVE_SEMANTIC_STABILIZE_FACTOR,
  noteSignal,
} from "./modelConstants.js";

const STORAGE_KEY = "slipup_v2_moments";
const RENDER_LIMIT = 6;
const COMPUTED_DEGREE_KEY = "slipup_v2_computed_degree";
const DISPLAY_DEGREE_KEY = "slipup_v2_display_degree";
const FIELD_SCOPE_KEY = "slipup_v2_field_scope";
const RELATE_STORAGE_KEY = "slipup_v2_relate";

// Tone selector for key narrative lines:
// Modo de copy: clear | poetic | narrative (narrative usa LANG: en | es)
const COPY_MODE = "narrative";
if (typeof document !== "undefined" && !document.documentElement.hasAttribute("lang")) {
  document.documentElement.lang = navigator.language?.startsWith("es") ? "es" : "en";
}
const LANG = (typeof document !== "undefined" && document.documentElement?.lang?.startsWith("es")) ? "es" : "en";

/**
 * Frases cortas observatory por combinación type|mood para #climateSummaryLine.
 * Varias variantes por combo; se elige una con seed para variedad sutil.
 */
const MIX_LINE_OBSERVATORY = {
  en: {
    "observed|calm": ["A quiet line in the field.", "The read holds steady.", "Calm observation in the window.", "Calm in the mix.", "The reading holds steady."],
    "observed|focus": ["Focused sight on the line.", "The field shows steady focus.", "A clear, focused read.", "Steady focus in the reading.", "The read stays clear."],
    "observed|stressed": ["Observation under strain.", "The line carries tension.", "Stressed but still watching.", "Tension in the reading.", "Watching under strain."],
    "observed|curious": ["The line tilts curious.", "Curiosity in the reading.", "A curious, steady watch.", "The read tilts toward curiosity.", "Curious watch in the mix."],
    "observed|tired": ["A weary but steady read.", "The field rests.", "Tired observation holds the line.", "Steady despite fatigue.", "The reading rests."],
    "avoidable|calm": ["Calm acknowledgment in the mix.", "The field notes what could shift.", "Quiet note on the avoidable.", "The mix acknowledges the avoidable.", "Quiet read on what could shift."],
    "avoidable|focus": ["Focus on what might have been otherwise.", "A sharp read on avoidable weight.", "Sharp read on what might have shifted.", "Focus on the avoidable band.", "The read stays sharp on the avoidable."],
    "avoidable|stressed": ["Pressure in the avoidable band.", "The line bears repeated strain.", "Strain and recurrence.", "Recurrence and strain in the read.", "The reading bears repeated weight."],
    "avoidable|curious": ["Curiosity around the avoidable.", "The read questions the pattern.", "The pattern questioned.", "Curiosity around recurrence.", "The mix questions the avoidable."],
    "avoidable|tired": ["Tired recurrence in the field.", "The line sags under repetition.", "Repetition and fatigue in the mix.", "The read sags with recurrence."],
    "fertile|calm": ["Calm fertility in the read.", "The field opens quietly.", "A quiet opening.", "Quiet opening in the read.", "The mix opens calmly."],
    "fertile|focus": ["Focused growth in the mix.", "The line leans into possibility.", "Fertile focus in the window.", "Possibility in focus.", "The reading leans into growth."],
    "fertile|stressed": ["Tension and opening share the read.", "Moments mix tension and openness.", "Opening under tension.", "Tension and openness in the mix.", "The read holds tension and opening."],
    "fertile|curious": ["Curiosity and opening.", "The field tilts toward discovery.", "Fertile curiosity.", "Discovery in the mix.", "Opening and curiosity."],
    "fertile|tired": ["Weary but open.", "The read holds space despite fatigue.", "Tired and opening.", "Open despite weariness.", "Fatigue and opening share the read."],
  },
  es: {
    "observed|calm": ["Una línea quieta en el campo.", "La lectura se mantiene estable.", "Observación calmada en la ventana.", "Calma en la mezcla.", "La lectura se sostiene estable."],
    "observed|focus": ["Mirada enfocada en la línea.", "El campo muestra un foco estable.", "Una lectura clara y atenta.", "Foco estable en la lectura.", "La lectura se mantiene clara."],
    "observed|stressed": ["Observación bajo tensión.", "La línea lleva carga.", "Atento aunque con tensión.", "Tensión en la lectura.", "Atento bajo la carga."],
    "observed|curious": ["La línea se inclina curiosa.", "Curiosidad en la lectura.", "Una mirada curiosa y estable.", "La lectura se inclina a la curiosidad.", "Mirada curiosa en la mezcla."],
    "observed|tired": ["Una lectura cansada pero estable.", "El campo descansa.", "Observación cansada sostiene la línea.", "Estable pese al cansancio.", "La lectura descansa."],
    "avoidable|calm": ["Reconocimiento calmado en la mezcla.", "El campo anota lo que podría cambiar.", "Nota tranquila sobre lo evitable.", "La mezcla reconoce lo evitable.", "Lectura tranquila sobre lo que podría cambiar."],
    "avoidable|focus": ["Foco en lo que pudo ser distinto.", "Una lectura aguda del peso evitable.", "Lectura aguda de lo que pudo cambiar.", "Foco en la banda evitable.", "La lectura se mantiene enfocada en lo evitable."],
    "avoidable|stressed": ["Presión en la banda evitable.", "La línea soporta repetición.", "Tensión y recurrencia.", "Recurrencia y tensión en la lectura.", "La lectura soporta peso repetido."],
    "avoidable|curious": ["Curiosidad en torno a lo evitable.", "La lectura cuestiona el patrón.", "El patrón cuestionado.", "Curiosidad en torno a la recurrencia.", "La mezcla cuestiona lo evitable."],
    "avoidable|tired": ["Recurrencia cansada en el campo.", "La línea cede bajo la repetición.", "Repetición y cansancio en la mezcla.", "La lectura cede con la recurrencia."],
    "fertile|calm": ["Fertilidad calmada en la lectura.", "El campo se abre en silencio.", "Una apertura tranquila.", "Apertura tranquila en la lectura.", "La mezcla se abre con calma."],
    "fertile|focus": ["Crecimiento enfocado en la mezcla.", "La línea se inclina a la posibilidad.", "Foco fértil en la ventana.", "Posibilidad en foco.", "La lectura se inclina al crecimiento."],
    "fertile|stressed": ["Tensión y apertura comparten la lectura.", "Los momentos mezclan tensión y apertura.", "Apertura bajo tensión.", "Tensión y apertura en la mezcla.", "La lectura sostiene tensión y apertura."],
    "fertile|curious": ["Curiosidad y apertura.", "El campo se inclina al descubrimiento.", "Curiosidad fértil.", "Descubrimiento en la mezcla.", "Apertura y curiosidad."],
    "fertile|tired": ["Cansado pero abierto.", "La lectura guarda espacio pese al cansancio.", "Cansancio y apertura.", "Abierto pese al cansancio.", "Cansancio y apertura comparten la lectura."],
  },
};

function getMixLinePhrase(lang, type, mood, seed) {
  const key = `${String(type).toLowerCase()}|${String(mood).toLowerCase()}`;
  const variants = MIX_LINE_OBSERVATORY[lang]?.[key];
  if (!Array.isArray(variants) || variants.length === 0) {
    const ui = UI_COPY[lang] || UI_COPY.en;
    return ui.mixLine(type, mood);
  }
  const index = Math.abs(seed) % variants.length;
  return variants[index];
}

/**
 * Línea de lectura neutral para el hero: fenómeno, no telemetría.
 * total < 3 → cielo quieto; total >= 3 → movimiento estable / atmósfera estable.
 * Solo para la línea visible bajo el grado; la telemetría va a console.debug o panel "i".
 */
function getReadingStatusLine(lang, total, seed = 0) {
  const lines = lang === "es"
    ? { quiet: "Calma.", steady: ["Estable.", "Se mantiene."] }
    : { quiet: "Quiet.", steady: ["Steady.", "Holds."] };
  if (total < 3) return lines.quiet;
  const idx = Math.abs(seed) % lines.steady.length;
  return lines.steady[idx];
}

/** Hook opcional para métricas/servicio externo (Sentry, Analytics). Si window.__observatoryReportEvent es una función, se llama con el nombre del evento; sin payload de usuario. */
function reportObservatoryEvent(eventName) {
  try {
    if (typeof window !== "undefined" && typeof window.__observatoryReportEvent === "function") {
      window.__observatoryReportEvent(eventName);
    }
  } catch (_) {}
}

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
  narrative_en: {
    condition: {
      quiet: ["The atmosphere is still gathering.", "First signals only.", "Still gathering."],
      steady: ["The reading holds steady.", "Steady. Calm field.", "The field is calm."],
      balance: ["The mix is rebalancing.", "Settling into balance.", "Re-centering."],
      gathering: ["Pressure is rising.", "The reading is tightening.", "Density building."],
      dense: ["The atmosphere is full.", "Dense with signal.", "Strong reading."],
    },
    horizon: {
      empty: ["No horizon yet.", "Horizon open.", "Open."],
      early: ["Forming.", "Light.", "Almost there."],
      dominant: [
        (k) => `Leans to ${k}.`,
        (k) => `Mostly ${k}.`,
        (k) => `Reads ${k}.`,
      ],
      trendSteady: ["Holds.", "Steady.", "No shift."],
      trendShift: ["Shifting.", "Moving.", "Changing."],
      driftCondensing: ["Tightening.", "Condensing.", "Rising."],
      driftClearing: ["Easing.", "Opening.", "Clearing."],
      driftStable: ["Steady.", "No drift.", "Holding."],
    },
    local: {
      condensing: ["This field is tightening.", "Local pressure rising.", "Denser here."],
      clearing: ["This field is opening.", "Local pressure easing.", "Lighter here."],
      stable: ["The local field remains near baseline.", "The local field holds steady.", "Calm in this scope."],
      fallback: ["The local signal remains light within the wider field.", "Reading from the wider field."],
      regional: ["Reading from this region.", "This scope shapes the line."],
    },
    strataFallback: ["Moments settle into deeper layers.", "Your record deepens.", "Layers keep settling."],
    strataEarly: ["Your deep record is still forming.", "First layers only.", "The deep is still open."],
  },
  narrative_es: {
    condition: {
      quiet: ["La atmósfera sigue reuniendo.", "Solo las primeras señales.", "Aún reuniendo."],
      steady: ["La lectura se mantiene estable.", "Estable. Campo en calma.", "El campo está en calma."],
      balance: ["La mezcla se reequilibra.", "Asentándose en balance.", "Recentrando."],
      gathering: ["La presión sube.", "La lectura se condensa.", "La densidad crece."],
      dense: ["La atmósfera está llena.", "Denso de señal.", "Lectura fuerte."],
    },
    horizon: {
      empty: ["Aún no hay horizonte.", "Horizonte abierto.", "Abierto."],
      early: ["Formándose.", "Liviano.", "Casi ahí."],
      dominant: [
        (k) => `Tiende a ${k}.`,
        (k) => `Predomina ${k}.`,
        (k) => `Lee ${k}.`,
      ],
      trendSteady: ["Se mantiene.", "Estable.", "Sin cambio."],
      trendShift: ["Cambiando.", "En movimiento.", "Se mueve."],
      driftCondensing: ["Condensando.", "Cerrando.", "Sube."],
      driftClearing: ["Abriendo.", "Alivianando.", "Aclarando."],
      driftStable: ["Estable.", "Sin deriva.", "Mantiene."],
    },
    local: {
      condensing: ["Este campo se condensa.", "Sube la presión local.", "Más denso aquí."],
      clearing: ["Este campo se abre.", "Baja la presión local.", "Más liviano aquí."],
      stable: ["El campo local se mantiene cerca del baseline.", "El campo local se mantiene estable.", "Calma en este alcance."],
      fallback: ["La señal local sigue liviana dentro del campo amplio.", "Leyendo desde el campo amplio."],
      regional: ["Leyendo esta región.", "Este alcance da forma a la línea."],
    },
    strataFallback: ["Los momentos se asientan en capas profundas.", "Tu registro se profundiza.", "Las capas siguen asentándose."],
    strataEarly: ["Tu registro profundo sigue formándose.", "Solo las primeras capas.", "Lo profundo sigue abierto."],
  },
};
const COPY = COPY_VARIANTS[COPY_MODE === "narrative" ? "narrative_" + LANG : COPY_MODE] || COPY_VARIANTS.poetic;

const UI_COPY = {
  en: {
    orientation: "",
    valueProp: "Collective reading from shared moments",
    cta: "Let it rise into the atmosphere.",
    trust: "No account. No exact pin. Just shared moments.",
    scopeLabel: "48h",
    recentFromRemote: "Across the atmosphere.",
    recentFromLocal: "Moments from this device only.",
    conditionPending: "Global signal pending.",
    conditionError: "Something went wrong. Refresh the page.",
    conditionOffline: "Reading from this device only.",
    mixLine: (type, mood) => `Mostly ${type}, ${mood}.`,
    eyebrowLayer: "Atmosphere",
    eyebrowContext: "Moments",
    horizonTitle: "Horizon",
    horizonMoreLabel: "Deeper",
    nearbyTitle: "Nearby",
    instrumentAriaLabel: "Reading metrics",
    instrumentLayerLabel: "Atmosphere",
    instrumentScopeLabel: "Global",
    scopeRangeLine: (n) => (n === 1 ? "1 moment" : `${n} moments`),
    instrumentMetricsAriaNearby: "Nearby field metrics",
    instrumentMetricsAriaStrata: "Deep record metrics",
    instrumentInfoCopy: "Type, mood, note, recency — what shapes each moment.",
    degreeScaleLabel: "0–100 scale",
    readingPrefix: "Reading:",
    strata: {
      mixLow: "low",
      mixModerate: "moderate",
      mixHigh: "high",
      deepMix: (mixLabel) => `Deep mix: ${mixLabel}.`,
      pressureTrendCondensing: "30-day pressure trend: condensing.",
      pressureTrendClearing: "30-day pressure trend: clearing.",
      pressureTrendStabilizing: "30-day pressure trend: stabilizing.",
      avoidableStressed: "Avoidable + stressed recurrence is high in 30-day data.",
      fertileCalm: "Fertile + calm recurrence is visible in 30-day data.",
      observedStability: "Observed entries are adding stability to the deep read.",
      moodDiversity: "Mood diversity is high across the 30-day window.",
      mixedSignal: "Avoidable and fertile ratios are both significant (mixed signal).",
      fertileDominant: "Fertile ratio is dominant in the 30-day mix.",
      deepConfidence: "Deep confidence is stronger with sustained 30-day volume.",
      stillBuilding: "Deep read is still building from recurring entries.",
    },
    viewMore: "View more",
    close: "Close",
    sheetEmpty: "No shared moments yet.",
    momentRelateLabel: "Not alone",
    momentRelateLabelYou: "Not alone · you",
    momentRelateAria: "Mark that this resonates with you too",
    nearbyRelateLabel: (count) => (count === 1 ? "1 nearby" : `${count} nearby`),
    sheetCount: (n) => (n === 1 ? "Showing 1 moment." : `Showing ${n} moments.`),
    loading: "Loading…",
    localFieldMomentsLabel: "In the nearby field",
    localFieldMomentsEmpty: "No shared moments in this scope yet.",
    metrics: {
      pressureCondensing: "condensing",
      pressureClearing: "clearing",
      pressureStable: "stable",
      pressureLabel: "tone",
      pressureUnit: "",
      stability: "stability",
      stabilityUnit: "%",
      density: "density",
      densityUnit: "",
      sharedUnit: "shared",
      sharedCount: (n) => `${n} shared`,
    },
  },
  es: {
    orientation: "",
    valueProp: "Lectura colectiva de momentos compartidos",
    cta: "Que suba a la atmósfera.",
    trust: "Sin cuenta. Sin pin exacto. Solo momentos compartidos.",
    scopeLabel: "48 h",
    recentFromRemote: "En la atmósfera.",
    recentFromLocal: "Solo momentos de este dispositivo.",
    conditionPending: "Señal global pendiente.",
    conditionError: "Algo ha fallado. Recarga la página.",
    conditionOffline: "Leyendo solo desde este dispositivo.",
    mixLine: (type, mood) => `Sobre todo ${type}, ${mood}.`,
    eyebrowLayer: "Atmósfera",
    eyebrowContext: "Momentos",
    horizonTitle: "Horizonte",
    horizonMoreLabel: "Más",
    nearbyTitle: "Cercano",
    instrumentAriaLabel: "Métricas de lectura",
    instrumentLayerLabel: "Atmósfera",
    instrumentScopeLabel: "Global",
    scopeRangeLine: (n) => (n === 1 ? "1 momento" : `${n} momentos`),
    instrumentMetricsAriaNearby: "Métricas del campo cercano",
    instrumentMetricsAriaStrata: "Métricas del registro profundo",
    instrumentInfoCopy: "Tipo, humor, nota, recencia: lo que da forma a cada momento.",
    degreeScaleLabel: "0–100 escala",
    readingPrefix: "Lectura:",
    strata: {
      mixLow: "bajo",
      mixModerate: "moderado",
      mixHigh: "alto",
      deepMix: (mixLabel) => `Mezcla profunda: ${mixLabel}.`,
      pressureTrendCondensing: "Tendencia de presión 30 días: condensando.",
      pressureTrendClearing: "Tendencia de presión 30 días: abriendo.",
      pressureTrendStabilizing: "Tendencia de presión 30 días: estabilizando.",
      avoidableStressed: "Evitable + estresado recurrente alto en datos de 30 días.",
      fertileCalm: "Fértil + calm recurrente visible en datos de 30 días.",
      observedStability: "Entradas observadas aportan estabilidad a la lectura profunda.",
      moodDiversity: "Diversidad de humor alta en la ventana de 30 días.",
      mixedSignal: "Ratios evitable y fértil significativos (señal mixta).",
      fertileDominant: "El ratio fértil domina en la mezcla de 30 días.",
      deepConfidence: "Confianza profunda mayor con volumen sostenido de 30 días.",
      stillBuilding: "La lectura profunda sigue construyéndose con entradas recurrentes.",
    },
    viewMore: "Ver más",
    close: "Cerrar",
    sheetEmpty: "Aún no hay momentos compartidos.",
    localFieldMomentsLabel: "En el campo cercano",
    localFieldMomentsEmpty: "Aún no hay momentos compartidos en este ámbito.",
    momentRelateLabel: "No estás solo",
    momentRelateLabelYou: "No estás solo · tú",
    momentRelateAria: "Señalar que esto también resuena contigo",
    nearbyRelateLabel: (count) => (count === 1 ? "1 en el campo" : `${count} en el campo`),
    sheetCount: (n) => (n === 1 ? "Se muestra 1 momento." : `Se muestran ${n} momentos.`),
    loading: "Cargando…",
    metrics: {
      pressureCondensing: "condensando",
      pressureClearing: "abriendo",
      pressureStable: "estable",
      pressureLabel: "tono",
      pressureUnit: "",
      stability: "estabilidad",
      stabilityUnit: "%",
      density: "densidad",
      densityUnit: "",
      sharedUnit: "compartidos",
      sharedCount: (n) => `${n} compartidos`,
    },
  },
};

function applyUICopy() {
  const ui = UI_COPY[LANG] || UI_COPY.en;
  const orientationEl = document.querySelector(".atmosphere-orientation");
  if (orientationEl) orientationEl.textContent = ui.orientation;
  const valuePropEl = document.querySelector(".atmosphere-value-prop");
  if (valuePropEl) valuePropEl.textContent = ui.valueProp || "";
  const ctaEl = document.querySelector(".cta-microcopy");
  if (ctaEl) ctaEl.textContent = ui.cta;
  const trustEl = document.querySelector(".trust-microcopy");
  if (trustEl) trustEl.textContent = ui.trust;
  const degreeScaleEl = document.getElementById("degreeScaleLabel");
  if (degreeScaleEl && ui.degreeScaleLabel) degreeScaleEl.textContent = ui.degreeScaleLabel;
  const instrumentEl = document.getElementById("climateInstrument");
  if (instrumentEl && ui.instrumentAriaLabel) instrumentEl.setAttribute("aria-label", ui.instrumentAriaLabel);
  const eyebrowLayerEl = document.querySelector(".eyebrow-layer");
  if (eyebrowLayerEl) eyebrowLayerEl.textContent = ui.eyebrowLayer;
  const eyebrowContextEl = document.querySelector(".eyebrow-context");
  if (eyebrowContextEl) eyebrowContextEl.textContent = ui.eyebrowContext;
  const horizonTitleEl = document.querySelector(".horizon-line");
  if (horizonTitleEl) horizonTitleEl.textContent = ui.horizonTitle;
  const horizonMoreBtn = document.getElementById("horizonMoreButton");
  if (horizonMoreBtn && ui.horizonMoreLabel) horizonMoreBtn.textContent = ui.horizonMoreLabel;
  const nearbyTitleEl = document.querySelector(".local-climate-line");
  if (nearbyTitleEl) nearbyTitleEl.textContent = ui.nearbyTitle;
  if (conditionLine) conditionLine.textContent = ui.conditionPending;
  if (viewMoreButton) viewMoreButton.textContent = ui.viewMore;
  const closeBtn = document.getElementById("shared-sheet-close");
  if (closeBtn) closeBtn.textContent = ui.close;
  const sheetEmptyEl = document.getElementById("shared-sheet-empty");
  if (sheetEmptyEl) sheetEmptyEl.textContent = ui.sheetEmpty || "No shared moments yet.";
  const instrumentInfoText = document.getElementById("instrumentInfoText");
  if (instrumentInfoText && ui.instrumentInfoCopy) instrumentInfoText.textContent = ui.instrumentInfoCopy;
  const instrumentInfoBtn = document.getElementById("instrumentInfoBtn");
  if (instrumentInfoBtn) {
    instrumentInfoBtn.setAttribute("aria-label", LANG === "es" ? "Información sobre estos valores" : "About these values");
  }
}
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
  narrative_en: {
    confidence: { early: ["Early."], building: ["Building."], firm: ["Firm."] },
    pulse: {
      early: ["Still gathering.", "First formation.", "Not enough to trace yet."],
      rising: ["Pace rising.", "More in the last stretch.", "Gaining."],
      easing: ["Pace easing.", "Quieter lately.", "Softening."],
      steady: ["Steady pace.", "The line holds.", "Stable."],
    },
    echo: {
      fallback: ["Echo follows the wider field."],
      aligned: ["Echo in step with the field."],
      near: ["Echo near the field."],
      offset: ["Echo on its own line."],
    },
  },
  narrative_es: {
    confidence: { early: ["Temprano."], building: ["Construyendo."], firm: ["Firme."] },
    pulse: {
      early: ["Aún reuniendo.", "Primera formación.", "Aún no basta para trazar."],
      rising: ["El ritmo sube.", "Más en el último tramo.", "Ganando."],
      easing: ["El ritmo baja.", "Más tranquilo últimamente.", "Suavizando."],
      steady: ["Ritmo estable.", "La línea se mantiene.", "Estable."],
    },
    echo: {
      fallback: ["El eco sigue al campo amplio."],
      aligned: ["El eco acompasado con el campo."],
      near: ["El eco cerca del campo."],
      offset: ["El eco en su propia línea."],
    },
  },
};
const SIGNALS = SIGNAL_VARIANTS[COPY_MODE === "narrative" ? "narrative_" + LANG : COPY_MODE] || SIGNAL_VARIANTS.poetic;
const REGIONAL_LOCAL_COPY = {
  common: {
    condensing: [
      "Local density is tightening in this scope.",
      "The local field is rising above baseline.",
      "Local repetition is adding pressure.",
    ],
    clearing: [
      "Local density is easing in this scope.",
      "The local field is moving toward lower pressure.",
      "Local repetition pressure is decreasing.",
    ],
    stable: [
      "The local field remains near baseline.",
      "The local field stays close to baseline.",
      "Local rhythm remains balanced.",
    ],
    fallback: [
      "The local signal remains light within the wider field.",
      "The local signal remains light.",
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
let lastDisplayedDegreeStr = null;

/** Inercia del instrumento: micro-desplazamiento vertical cuando el número cambia. Respeta prefers-reduced-motion. */
function playDegreeSettle() {
  if (!degreeValue || prefersReducedMotion) return;
  degreeValue.classList.add("degree-settle-in");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      degreeValue.classList.remove("degree-settle-in");
    });
  });
}

/** Actualiza el display del grado y, si cambió, reproduce la inercia del indicador. */
function setDegreeDisplay(txt) {
  if (!degreeValue) return;
  if (txt !== lastDisplayedDegreeStr) {
    lastDisplayedDegreeStr = txt;
    degreeValue.textContent = txt;
    playDegreeSettle();
  } else {
    degreeValue.textContent = txt;
  }
}
const conditionLine = document.getElementById("conditionLine");
const climateSummaryLine = document.getElementById("climateSummaryLine");
const climateMetricsLine = document.getElementById("climateMetricsLine");
const climateInstrument = document.getElementById("climateInstrument");
const observatoryScopeRange = document.getElementById("observatoryScopeRange");
const instrumentInfoTechnical = document.getElementById("instrumentInfoTechnical");
// FUTURE: kept as scaffold for a possible hero confidence line return.
const readingConfidenceLine = document.getElementById("readingConfidenceLine");
const observatoryPanel = document.getElementById("observatory");
const recentMoments = document.getElementById("recentMoments");
const recentContext = document.getElementById("recentContext");
const viewMoreButton = document.getElementById("viewMoreButton");
const horizonPrimary = document.getElementById("horizonPrimary");
const horizonPulseLine = document.getElementById("horizonPulseLine");
const horizonSecondary = document.getElementById("horizonSecondary");
const horizonMoreButton = document.getElementById("horizonMoreButton");
const heroEl = document.getElementById("observatory-hero");
const atmospherePatternLine = document.getElementById("atmosphere-pattern-line");
const transientReadingLine = document.getElementById("transientReadingLine");
const atmosphereSemanticHint = document.getElementById("atmosphereSemanticHint");
const warmupHint = document.getElementById("warmupHint");
const sheetBackdrop = document.getElementById("sheet-backdrop");
const sharedSheet = document.getElementById("shared-sheet");
const sharedSheetList = document.getElementById("shared-sheet-list");
const sharedSheetEmpty = document.getElementById("shared-sheet-empty");
const sharedSheetCount = document.getElementById("shared-sheet-count");
const sharedSheetCloseButton = document.getElementById("shared-sheet-close");
const fieldScopeSelect = document.getElementById("fieldScopeSelect");
const localClimateDegree = document.getElementById("localClimateDegree");
const localClimateMass = document.getElementById("localClimateMass");
const localClimateMetricsLine = document.getElementById("localClimateMetricsLine");
const localClimatePrimary = document.getElementById("localClimatePrimary");
const localClimateSecondary = document.getElementById("localClimateSecondary");
const localClimateEcho = document.getElementById("localClimateEcho");
const localClimateMomentsLabel = document.getElementById("localClimateMomentsLabel");
const localClimateMoments = document.getElementById("localClimateMoments");
const groundStrata = document.getElementById("ground-strata");
const strataLines = document.getElementById("strataLines");
const strataMetricsLine = document.getElementById("strataMetricsLine");

const query = new URLSearchParams(window.location.search);
const contributed = query.get("contributed") === "1";
const SHARED_SHEET_MAX_ITEMS = 100;
/** Tamaño de cada "página" al hacer scroll infinito dentro del sheet (evita paginación, navegación fluida). */
const SHARED_SHEET_PAGE_SIZE = 25;
const SHEET_TRANSITION_MS = 280;

let sharedSheetFullList = [];
let sharedSheetVisibleCount = 0;
let sharedSheetSentinel = null;
let sharedSheetIncrementalObserver = null;
const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

/**
 * Variables reales del instrumento y condiciones para observarlas.
 * Pensado para escala: early (pocos), building (cientos), firm (miles/millones).
 *
 * VARIABLES REALES (mapeo observatorio → homónimo físico):
 * - Tendency (hPa): tendencia del grado respecto al baseline; necesita mezcla type/mood para que el grado sea significativo.
 * - Balance (%): proporción observed + calm/focus; necesita variedad en type y mood.
 * - Concentration (kg/m³): señal en ventana 48h; escala con el total de momentos (ref depende del volumen).
 *
 * CONDICIONES MÍNIMAS PARA OBSERVAR (por métrica):
 * - tendency: al menos OBSERVABILITY_MIN.tendency momentos (mezcla type/mood) para que el grado no sea ruido.
 * - balance: al menos OBSERVABILITY_MIN.balance para que los ratios no sean 0/1 puros.
 * - concentration: al menos OBSERVABILITY_MIN.concentration para mostrar valor (sino se oculta o se muestra "—").
 *
 * ESCALA (miles/millones de usuarios):
 * - early: total < SCALE_TIER_REF.building → ref = 50 (100% = 50 momentos).
 * - building: total < SCALE_TIER_REF.firm → ref = 500 (100% = 500 en ventana 48h).
 * - firm: total >= SCALE_TIER_REF.firm → ref = 5000 (100% = 5000 en ventana 48h).
 * Así la concentration no se satura al 100% con pocos cientos; miles/millones tienen headroom.
 */
const OBSERVABILITY_MIN = {
  tendency: 5,
  balance: 5,
  concentration: 3,
};

const SCALE_TIER_REF = {
  early: 50,
  building: 500,
  firm: 5000,
};

function getDensitySignalRef(total) {
  if (total < SCALE_TIER_REF.building) return SCALE_TIER_REF.early;
  if (total < SCALE_TIER_REF.firm) return SCALE_TIER_REF.building;
  return SCALE_TIER_REF.firm;
}

/**
 * Mapeo estable: variables internas del observatorio → unidades reales para el instrumento.
 * Relación con homónimos reales:
 * - pressureMode: tendencia del grado (derivePressureMode) → hPa nominal (sube=1018, estable=1015, baja=1012).
 * - stabilityIndex: índice 0-1 (observed + calm/focus) → mismo valor en % (estabilidad atmosférica adimensional).
 * - density: señal en ventana (total/REF = 100%) → kg/m³ (1.0–1.25, rango típico superficie).
 */
const INSTRUMENT_REAL = {
  pressureHpa: { condensing: 1018, clearing: 1012, stabilizing: 1015, stable: 1015 },
  densitySignalRef: 50,
  densityKgM3Min: 1.0,
  densityKgM3Max: 1.25,
};

function instrumentToPressureHpa(pressureMode) {
  return INSTRUMENT_REAL.pressureHpa[pressureMode] ?? INSTRUMENT_REAL.pressureHpa.stable;
}

function instrumentToStabilityPercent(stabilityIndex) {
  if (!Number.isFinite(stabilityIndex) || stabilityIndex < 0) return null;
  return Math.round(clamp(stabilityIndex, 0, 1) * 100);
}

function instrumentToDensitySignalPct(total, ref) {
  if (!total || total <= 0) return 0;
  const r = ref !== undefined ? ref : getDensitySignalRef(total);
  return Math.min(100, Math.round((total / r) * 100));
}

function instrumentToDensityKgM3(signalPct) {
  const { densityKgM3Min, densityKgM3Max } = INSTRUMENT_REAL;
  return densityKgM3Min + (clamp(signalPct, 0, 100) / 100) * (densityKgM3Max - densityKgM3Min);
}

/**
 * Construye los fragmentos HTML de la línea de métricas (tendency · balance · concentration)
 * para cualquier capa (atmosphere, horizon, nearby). state = { pressureMode, stabilityIndex }; total = número de momentos.
 * opts.includeDensity = false para no mostrar densidad en la vista principal (solo en panel "i").
 */
function buildMetricsLineParts(state, total, lang = "en", opts = {}) {
  const includeDensity = opts.includeDensity !== false;
  const ui = UI_COPY[lang] || UI_COPY.en;
  const m = ui.metrics || {};
  const pressureMode = state?.pressureMode || "";
  const stabilityIndex = state?.stabilityIndex;
  const toneReading = state?.toneReading != null && Number.isFinite(state.toneReading)
    ? Math.round(state.toneReading)
    : (total > 0 ? instrumentToPressureHpa(pressureMode) : null);
  const pressureLabel = m.pressureLabel || "tone";
  const pressureUnit = m.pressureUnit ?? "";
  const stabilityPct = instrumentToStabilityPercent(stabilityIndex);
  const densitySignalPct = instrumentToDensitySignalPct(total, getDensitySignalRef(total));
  const densityKgM3 = instrumentToDensityKgM3(densitySignalPct);
  const densityFormatted = densityKgM3.toFixed(2).replace(".", lang === "es" ? "," : ".");
  const densLabel = m.density || "density";
  const densUnit = m.densityUnit ?? "";
  const parts = [];
  const showTendency = total >= OBSERVABILITY_MIN.tendency && toneReading != null;
  const showBalance = total >= OBSERVABILITY_MIN.balance && stabilityPct != null;
  const showConcentration = includeDensity && total >= OBSERVABILITY_MIN.concentration && total > 0;
  if (showTendency) {
    const pressureVal = pressureUnit ? `${toneReading} ${pressureUnit}` : String(toneReading);
    parts.push({ type: "pressure", html: `<span class="metric metric-pressure"><span class="metric-label">${pressureLabel}</span> <span class="metric-value">${pressureVal}</span></span>` });
  }
  if (showBalance) {
    const stabLabel = m.stability || "stability";
    const stabUnit = m.stabilityUnit ?? "%";
    parts.push({ type: "stability", html: `<span class="metric metric-stability"><span class="metric-label">${stabLabel}</span> <span class="metric-value">${stabilityPct}${stabUnit}</span></span>` });
  }
  if (showConcentration) {
    const densityVal = densUnit ? `${densityFormatted} ${densUnit}` : densityFormatted;
    parts.push({ type: "density", html: `<span class="metric metric-density"><span class="metric-label">${densLabel}</span> <span class="metric-value">${densityVal}</span></span>` });
  }
  return parts;
}

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
  /** "up" = acabamos de hacer wrap hacia abajo (estábamos arriba, usuario subió); "down" = acabamos de hacer wrap hacia arriba */
  let lastWrapDirection = null;
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
    lastWrapDirection = direction;
    document.body.classList.add("loop-warp", direction === "up" ? "loop-warp-up" : "loop-warp-down");
    const html = document.documentElement;
    const prevScrollBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo({ top: targetTop, behavior: "auto" });
    requestAnimationFrame(() => {
      html.style.scrollBehavior = prevScrollBehavior;
      document.body.classList.remove("loop-warp", "loop-warp-up", "loop-warp-down");
    });
    setTimeout(() => { lastWrapDirection = null; }, lockMs + 50);
  };

  const onWheel = (event) => {
    const now = Date.now();
    const inLock = now < wrapLockUntil;

    if (inLock && lastWrapDirection != null) {
      const deltaY = event.deltaY;
      const wouldBounceBack = lastWrapDirection === "up" && deltaY < 0;
      if (wouldBounceBack) {
        event.preventDefault();
        return;
      }
    }

    if (!canWrap()) return;
    const max = Math.max(0, scroller.scrollHeight - window.innerHeight);
    const y = window.scrollY || scroller.scrollTop || 0;
    if (max <= threshold * 2) return;

    if (y <= threshold && event.deltaY < -minDelta) {
      event.preventDefault();
      const carry = clamp(Math.abs(event.deltaY), 0, 140);
      wrapTo(Math.max(threshold, max - threshold - carry), "up");
      return;
    }
    if (y >= max - threshold && event.deltaY > minDelta) {
      event.preventDefault();
      const carry = clamp(Math.abs(event.deltaY), 0, 140);
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
      const carry = clamp(Math.abs(delta), 0, 140);
      wrapTo(Math.max(threshold, max - threshold - carry), "up");
      touchStartY = currentY;
      return;
    }
    if (y >= max - threshold && delta > minDelta) {
      const carry = clamp(Math.abs(delta), 0, 140);
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
  const delay = hash === "#ground-strata" ? 180 : 60;
  window.setTimeout(() => {
    target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  }, delay);
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
    const strength = clamp(
      PATTERN_A_STRENGTH_BASE + (avoidableStressedCount - 2) * PATTERN_A_STRENGTH_RATE,
      PATTERN_A_STRENGTH_MIN,
      PATTERN_A_STRENGTH_MAX
    );
    return { hasPattern: true, tag: "pattern_a", strength };
  }

  // Pattern B: avoidable repeats with same mood >= 3
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
    return { hasPattern: true, tag: "pattern_c", strength: PATTERN_C_STRENGTH };
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

// Presión: tendencia del grado respecto al baseline (28). Condensando = sube; abriendo = baja; estable = cerca del baseline.
function derivePressureMode(computedDegree, repetition) {
  const delta = computedDegree - BASELINE;
  if (repetition?.hasPattern && repetition?.tag === "pattern_a") return "condensing";
  if (delta >= PRESSURE_MODE_CONDENSING_DELTA) return "condensing";
  if (delta <= PRESSURE_MODE_CLEARING_DELTA) return "clearing";
  return "stabilizing";
}

function deriveClimateState(climateTruth, sharedMoments, localMoments) {
  const shared = Array.isArray(sharedMoments) ? sharedMoments : [];
  const counts = compositionCounts(shared.slice(0, 60));
  const dominantMix = dominantCombination(shared);
  const total = Math.max(1, shared.length);
  const observedRatio = counts.byType.observed / total;
  const calmFocusRatio = (counts.byMood.calm + counts.byMood.focus) / total;
  // Estabilidad: mezcla de tipo "observed" (62%) y ánimo calm/focus (38%). Alto = mix más estable.
  const stabilityIndex = clamp(observedRatio * 0.62 + calmFocusRatio * 0.38, 0, 1);

  const longWindow = getLongWindow(localMoments, 30);
  const longCounts = compositionCounts(longWindow);
  const longTotal = Math.max(1, longWindow.length);
  const longAvoidable = longCounts.byType.avoidable / longTotal;
  const longFertile = longCounts.byType.fertile / longTotal;
  const groundIndex = clamp((longAvoidable * 0.55 + longFertile * 0.45) * Math.min(1, longTotal / 20), 0, 1);

  const pressureMode = derivePressureMode(climateTruth.computedDegree, climateTruth.repetition);
  const toneReading = climateTruth.toneReading != null && Number.isFinite(climateTruth.toneReading)
    ? climateTruth.toneReading
    : clamp(50 + (climateTruth.computedDegree - BASELINE) * 2.2, 0, 100);

  return {
    computedDegree: climateTruth.computedDegree,
    total: climateTruth.total,
    condition: climateTruth.condition,
    repetition: climateTruth.repetition,
    pressureMode,
    toneReading,
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
  return row[mood] || { mode: "stabilize", strength: INFLUENCE_DEFAULT_STRENGTH };
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
      toneReading: 50,
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
  const repetitionDamping = clamp(1 / Math.sqrt(1 + fieldMass / REPETITION_FIELD_MASS_DIVISOR), REPETITION_DAMPING_MIN, REPETITION_DAMPING_MAX);
  const repetitionNudge = clamp(repetition.strength * REPETITION_NUDGE_FACTOR * repetitionDamping, 0, REPETITION_NUDGE_MAX);
  let computedDegree = clamp(warmBase + repetitionNudge, 0, SCALE);
  if (total === 1) {
    computedDegree = Math.min(computedDegree, BASELINE + SINGLE_MOMENT_DEGREE_DELTA);
  }
  const deltaFromBaseline = computedDegree - BASELINE;
  const massInertiaFactor = 1 / (1 + Math.sqrt(total) / MASS_INERTIA_REF);
  computedDegree = clamp(BASELINE + deltaFromBaseline * massInertiaFactor, 0, SCALE);
  const toneReading = clamp(50 + 50 * Math.tanh(normalizedPressure * TANH_SENSITIVITY), 0, 100);

  return {
    computedDegree,
    total,
    latestTimestamp: latestInWindow ? latestInWindow.timestamp : null,
    repetition,
    toneReading,
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

function getRelateState(momentId) {
  try {
    const raw = localStorage.getItem(RELATE_STORAGE_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return Boolean(obj[momentId]);
  } catch {
    return false;
  }
}

function setRelateState(momentId, value) {
  try {
    const raw = localStorage.getItem(RELATE_STORAGE_KEY) || "{}";
    const obj = raw ? JSON.parse(raw) : {};
    if (value) obj[momentId] = true;
    else delete obj[momentId];
    localStorage.setItem(RELATE_STORAGE_KEY, JSON.stringify(obj));
  } catch (_) {}
}

function formatDegree(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(BASELINE) + "°";
  return Math.round(clamp(n, 0, SCALE)) + "°";
}

function conditionForDegree(value, total) {
  const seed = Math.round(value * 10) + total;
  if (total < 3) return pickCopy(COPY.condition.quiet, seed);
  if (value < DEGREE_BAND_STEADY) return pickCopy(COPY.condition.steady, seed);
  if (value < DEGREE_BAND_BALANCE) return pickCopy(COPY.condition.balance, seed);
  if (value < DEGREE_BAND_GATHERING) return pickCopy(COPY.condition.gathering, seed);
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

function formatGeoForDisplay(geo) {
  if (!geo || typeof geo !== "string") return "";
  const parts = geo.trim().split(".").filter(Boolean);
  if (!parts.length) return "";
  const last = parts[parts.length - 1].replace(/_/g, " ");
  if (!last) return "";
  return last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
}

function capitalizeForDisplay(str) {
  const s = String(str).trim();
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function capitalizeNoteForDisplay(str) {
  const s = String(str).trim();
  if (!s) return s;
  return s
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function createMomentItemElement(m, options = {}) {
  const inNearbyField = options.inNearbyField === true;
  const li = document.createElement("li");
  li.className = "moment-item";
  const note = m.note ? m.note.trim() : "(no note)";
  const typeLabel = capitalizeForDisplay(m.type);
  const moodLabel = capitalizeForDisplay(m.mood);
  const noteLabel = note === "(no note)" ? note : capitalizeNoteForDisplay(note);
  const left = `${typeLabel} · ${moodLabel} · ${noteLabel}`;
  const timeStr = new Date(m.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const regionLabel = formatGeoForDisplay(m.geo_bucket);
  const meta = regionLabel ? `${timeStr} · ${regionLabel}` : timeStr;
  const momentId = m.id || `${m.timestamp || ""}-${(m.note || "").slice(0, 10)}`;
  li.innerHTML = `<span>${escapeHtml(left)}</span><span class="moment-meta">${escapeHtml(meta)}</span>`;

  const ui = UI_COPY[LANG] || UI_COPY.en;
  const baseLabel = ui.momentRelateLabel || "Not alone";
  const relateBtn = document.createElement("button");
  relateBtn.type = "button";
  relateBtn.className = "moment-relate-btn";
  relateBtn.setAttribute("aria-label", ui.momentRelateAria || "Mark that this resonates with you too");
  relateBtn.dataset.relateCount = String(typeof m.relate_count === "number" ? m.relate_count : 0);

  function updateRelateLabel() {
    const count = parseInt(relateBtn.dataset.relateCount, 10) || 0;
    const you = getRelateState(momentId);
    let text;
    if (inNearbyField) {
      const nearbyLabel = typeof ui.nearbyRelateLabel === "function" ? ui.nearbyRelateLabel(count) : (count === 1 ? "1 nearby" : `${count} nearby`);
      text = count > 0 ? nearbyLabel : (LANG === "es" ? "en el campo" : "nearby");
      if (you) text += LANG === "es" ? " · tú" : " · you";
    } else {
      text = baseLabel;
      if (count > 0) text += ` · ${count}`;
      if (you) text += LANG === "es" ? " · tú" : " · you";
    }
    relateBtn.textContent = text;
    relateBtn.classList.toggle("is-active", you);
  }

  updateRelateLabel();
  relateBtn.addEventListener("click", async () => {
    if (getRelateState(momentId)) return;
    if (m.id && isRemoteReady()) {
      relateBtn.disabled = true;
      const res = await postRelateMoment(m.id);
      relateBtn.disabled = false;
      if (res.ok && typeof res.count === "number") {
        relateBtn.dataset.relateCount = String(res.count);
        relateBtn.removeAttribute("title");
      } else {
        const prev = parseInt(relateBtn.dataset.relateCount, 10) || 0;
        relateBtn.dataset.relateCount = String(Math.max(1, prev + 1));
        relateBtn.setAttribute("title", LANG === "es"
          ? "Guardado aquí. El total global aparecerá cuando el servicio esté disponible."
          : "Saved locally. Global count will appear when the service is available.");
      }
    } else {
      const prev = parseInt(relateBtn.dataset.relateCount, 10) || 0;
      relateBtn.dataset.relateCount = String(prev + 1);
    }
    setRelateState(momentId, true);
    updateRelateLabel();
  });
  li.appendChild(relateBtn);
  return li;
}

function renderMomentItems(targetElement, items) {
  targetElement.innerHTML = "";
  items.forEach((m) => targetElement.appendChild(createMomentItemElement(m)));
}

function renderRecent(sharedMoments) {
  recentMoments.innerHTML = "";
  const list = sharedMoments.slice(0, RENDER_LIMIT);

  if (list.length === 0) {
    const empty = document.createElement("li");
    empty.className = "moment-item";
    const ui = UI_COPY[LANG] || UI_COPY.en;
    empty.textContent = ui.sheetEmpty || "No shared moments yet.";
    recentMoments.appendChild(empty);
    return;
  }

  renderMomentItems(recentMoments, list);
}

function teardownSharedSheetIncrementalScroll() {
  if (sharedSheetIncrementalObserver && sharedSheetSentinel) {
    sharedSheetIncrementalObserver.disconnect();
    sharedSheetIncrementalObserver = null;
  }
  if (sharedSheetSentinel && sharedSheetSentinel.parentNode) {
    sharedSheetSentinel.remove();
  }
  sharedSheetSentinel = null;
  sharedSheetFullList = [];
  sharedSheetVisibleCount = 0;
}

function appendNextPageSharedSheet() {
  if (sharedSheetVisibleCount >= sharedSheetFullList.length || !sharedSheetSentinel) return;
  const nextEnd = Math.min(sharedSheetVisibleCount + SHARED_SHEET_PAGE_SIZE, sharedSheetFullList.length);
  const chunk = sharedSheetFullList.slice(sharedSheetVisibleCount, nextEnd);
  chunk.forEach((m) => {
    sharedSheetList.insertBefore(createMomentItemElement(m), sharedSheetSentinel);
  });
  sharedSheetVisibleCount = nextEnd;
  if (sharedSheetVisibleCount >= sharedSheetFullList.length) {
    teardownSharedSheetIncrementalScroll();
  }
}

function renderSharedSheetList(sharedMoments, countLabel = "") {
  teardownSharedSheetIncrementalScroll();
  const list = sharedMoments.slice(0, SHARED_SHEET_MAX_ITEMS);
  sharedSheetList.innerHTML = "";

  if (sharedSheetCount) {
    sharedSheetCount.textContent = countLabel;
    sharedSheetCount.classList.toggle("hidden", !countLabel);
  }

  const isLoading = list.length === 0 && countLabel.length > 0;
  if (list.length === 0 && !isLoading) {
    sharedSheetList.classList.add("hidden");
    sharedSheetEmpty.classList.remove("hidden");
    return;
  }

  sharedSheetEmpty.classList.add("hidden");
  sharedSheetList.classList.remove("hidden");

  if (list.length <= SHARED_SHEET_PAGE_SIZE) {
    renderMomentItems(sharedSheetList, list);
    return;
  }

  sharedSheetFullList = list;
  sharedSheetVisibleCount = Math.min(SHARED_SHEET_PAGE_SIZE, list.length);
  const firstChunk = list.slice(0, sharedSheetVisibleCount);
  renderMomentItems(sharedSheetList, firstChunk);

  sharedSheetSentinel = document.createElement("li");
  sharedSheetSentinel.className = "shared-sheet-sentinel";
  sharedSheetSentinel.setAttribute("aria-hidden", "true");
  sharedSheetSentinel.setAttribute("data-sentinel", "infinite");
  sharedSheetList.appendChild(sharedSheetSentinel);

  sharedSheetIncrementalObserver = new IntersectionObserver(
    (entries) => {
      if (!entries[0]?.isIntersecting) return;
      appendNextPageSharedSheet();
    },
    { root: sharedSheetList, rootMargin: "120px 0px", threshold: 0 }
  );
  sharedSheetIncrementalObserver.observe(sharedSheetSentinel);
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
  teardownSharedSheetIncrementalScroll();
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

async function openSharedSheet(sharedMoments) {
  if (isSharedSheetOpen) return;
  isSharedSheetOpen = true;
  lastFocusedEl = document.activeElement;

  sharedSheet.hidden = false;
  sheetBackdrop.hidden = false;
  document.body.classList.add("sheet-open");
  document.addEventListener("keydown", onSharedSheetKeydown);

  renderSharedSheetList([], (UI_COPY[LANG] || UI_COPY.en).loading || "Loading…");
  requestAnimationFrame(() => {
    sharedSheet.classList.add("is-open");
    sheetBackdrop.classList.add("is-open");
    sharedSheetCloseButton.focus();
  });

  let listToShow = sharedMoments;
  try {
    const fresh = await fetchSharedMomentsRemote(SHARED_SHEET_MAX_ITEMS, 48, { skipCache: true });
    listToShow = fresh.filter((m) => m.shared && !m.hidden);
  } catch {
    listToShow = sharedMoments;
  }

  if (observatoryState) {
    observatoryState.sharedMoments = listToShow;
    refreshObservatoryLists(listToShow);
  }

  const n = listToShow.length;
  const ui = UI_COPY[LANG] || UI_COPY.en;
  const countLabel = n === 0 ? "" : (ui.sheetCount ? ui.sheetCount(n) : `Showing ${n} moments.`);
  renderSharedSheetList(listToShow, countLabel);

  sharedSheetCloseButton.focus();
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

const LOCAL_FIELD_MOMENTS_LIMIT = 6;

function filterMomentsByScope(sharedMoments, fieldScope) {
  if (!Array.isArray(sharedMoments) || !fieldScope?.geo) return [];
  const geo = String(fieldScope.geo).toLowerCase().trim();
  if (!geo) return [];
  return sharedMoments.filter((m) => {
    const bucket = (m.geo_bucket || "").toLowerCase().trim();
    if (!bucket) return false;
    return bucket === geo || bucket.startsWith(geo + ".");
  });
}

function renderRegionalMomentsList(sharedMoments, fieldScope) {
  if (!localClimateMoments) return;
  const ui = UI_COPY[LANG] || UI_COPY.en;
  const hasScope = fieldScope?.geo && fieldScope.scope !== "global";
  if (localClimateMomentsLabel) {
    localClimateMomentsLabel.textContent = ui.localFieldMomentsLabel || "In the nearby field";
    localClimateMomentsLabel.classList.toggle("visually-hidden", !hasScope);
  }
  localClimateMoments.classList.toggle("hidden", !hasScope);
  if (!hasScope) {
    localClimateMoments.innerHTML = "";
    return;
  }
  const list = filterMomentsByScope(sharedMoments || [], fieldScope).slice(0, LOCAL_FIELD_MOMENTS_LIMIT);
  localClimateMoments.innerHTML = "";
  localClimateMoments.classList.remove("hidden");
  if (list.length === 0) {
    const li = document.createElement("li");
    li.className = "moment-item";
    li.textContent = ui.localFieldMomentsEmpty || "No shared moments in this scope yet.";
    localClimateMoments.appendChild(li);
    return;
  }
  list.forEach((m) => localClimateMoments.appendChild(createMomentItemElement(m, { inNearbyField: true })));
}

function renderLocalClimate(localState, canonicalState, scopeLabel = "Nearby", pipeline = null, fieldScope = null, sharedMoments = null) {
  renderRegionalMomentsList(sharedMoments || [], fieldScope);
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
  const exactDegree = Number(localState?.computedDegree);
  const degreeStr = Number.isFinite(exactDegree) ? exactDegree.toFixed(1) : String(BASELINE);
  const total = Number(localState?.total) || 0;
  const confidenceMode = pipeline?.signalModes?.confidence || classifyConfidence(total);
  if (localClimateDegree) {
    localClimateDegree.textContent = `${degreeStr}° ${scopeLabel.toLowerCase()}`;
  }
  if (localClimateMass) {
    localClimateMass.textContent = `${total} shared · ${confidenceMode}`;
  }
  /* Echo line removed: repetía la línea anterior y no aportaba ontología clara. */
  if (localClimateEcho) {
    localClimateEcho.textContent = "";
    localClimateEcho.classList.add("hidden");
  }
  if (localState?.source === "global_view") {
    localClimateSecondary.textContent = "Reading shared moments across the wider field.";
    if (localClimateMetricsLine) {
      const parts = buildMetricsLineParts(localState, total, LANG);
      const uiAria = UI_COPY[LANG] || UI_COPY.en;
      if (parts.length > 0) {
        localClimateMetricsLine.innerHTML = parts.map((p) => p.html).join('<span class="metric-sep" aria-hidden="true"> · </span>');
        localClimateMetricsLine.setAttribute("aria-label", uiAria.instrumentMetricsAriaNearby || "Nearby field metrics");
        localClimateMetricsLine.classList.remove("hidden");
      } else {
        localClimateMetricsLine.textContent = "";
        localClimateMetricsLine.removeAttribute("aria-label");
        localClimateMetricsLine.classList.add("hidden");
      }
    }
    return;
  }
  const echoMode = pipeline?.signalModes?.echo || classifyEcho(localState, canonicalState);
  if (localClimateEcho) {
    localClimateEcho.textContent = "";
    localClimateEcho.classList.add("hidden");
  }
  if (localState?.source === "global_fallback") {
    localClimateSecondary.textContent =
      pickRegionalLocalCopy("fallback", fieldScope, seed + 3) || pickCopy(COPY.local.fallback, seed);
    if (localClimateMetricsLine) {
      const parts = buildMetricsLineParts(localState, total, LANG);
      const uiAria = UI_COPY[LANG] || UI_COPY.en;
      if (parts.length > 0) {
        localClimateMetricsLine.innerHTML = parts.map((p) => p.html).join('<span class="metric-sep" aria-hidden="true"> · </span>');
        localClimateMetricsLine.setAttribute("aria-label", uiAria.instrumentMetricsAriaNearby || "Nearby field metrics");
        localClimateMetricsLine.classList.remove("hidden");
      } else {
        localClimateMetricsLine.textContent = "";
        localClimateMetricsLine.removeAttribute("aria-label");
        localClimateMetricsLine.classList.add("hidden");
      }
    }
    return;
  }
  localClimateSecondary.textContent =
    pickRegionalLocalCopy("regional", fieldScope, seed + 7) || pickCopy(COPY.local.regional, seed);
  // Nearby: incorporar tendency · balance · concentration en la capa (texto e idioma coherentes con la capa).
  if (localClimateMetricsLine) {
    const parts = buildMetricsLineParts(localState, total, LANG);
    const uiAria = UI_COPY[LANG] || UI_COPY.en;
    if (parts.length > 0) {
      localClimateMetricsLine.innerHTML = parts.map((p) => p.html).join('<span class="metric-sep" aria-hidden="true"> · </span>');
      localClimateMetricsLine.setAttribute("aria-label", uiAria.instrumentMetricsAriaNearby || "Nearby field metrics");
      localClimateMetricsLine.classList.remove("hidden");
    } else {
      localClimateMetricsLine.textContent = "";
      localClimateMetricsLine.removeAttribute("aria-label");
      localClimateMetricsLine.classList.add("hidden");
    }
  }
}

function getLongWindow(moments, days = 30) {
  const now = Date.now();
  const windowMs = days * 24 * 60 * 60 * 1000;
  return moments.filter((m) => now - new Date(m.timestamp).getTime() <= windowMs && !m.hidden);
}

function buildStrataLines(longWindowMoments, canonicalState) {
  const total = longWindowMoments.length;
  const ui = UI_COPY[LANG] || UI_COPY.en;
  const s = ui.strata || {};
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
  const groundLevel = canonicalState.groundIndex ?? 0;
  const mixLabel = groundLevel < 0.33 ? (s.mixLow || "low") : groundLevel < 0.66 ? (s.mixModerate || "moderate") : (s.mixHigh || "high");
  lines.push(s.deepMix ? s.deepMix(mixLabel) : `Deep mix: ${mixLabel}.`);

  if (canonicalState.pressureMode === "condensing") {
    lines.push(s.pressureTrendCondensing || "30-day pressure trend: condensing.");
  } else if (canonicalState.pressureMode === "clearing") {
    lines.push(s.pressureTrendClearing || "30-day pressure trend: clearing.");
  } else {
    lines.push(s.pressureTrendStabilizing || "30-day pressure trend: stabilizing.");
  }

  if (counts.avoidable >= 5 && moods.stressed >= 3) {
    lines.push(s.avoidableStressed || "Avoidable + stressed recurrence is high in 30-day data.");
  }
  if (counts.fertile >= 4 && moods.calm >= 3) {
    lines.push(s.fertileCalm || "Fertile + calm recurrence is visible in 30-day data.");
  }
  if (counts.observed >= 4) {
    lines.push(s.observedStability || "Observed entries are adding stability to the deep read.");
  }

  const moodDiversity = Object.values(moods).filter((count) => count > 0).length;
  if (moodDiversity >= 4) {
    lines.push(s.moodDiversity || "Mood diversity is high across the 30-day window.");
  }

  const avoidableRatio = counts.avoidable / total;
  const fertileRatio = counts.fertile / total;
  if (avoidableRatio > 0.42 && fertileRatio > 0.22) {
    lines.push(s.mixedSignal || "Avoidable and fertile ratios are both significant (mixed signal).");
  } else if (fertileRatio > 0.38) {
    lines.push(s.fertileDominant || "Fertile ratio is dominant in the 30-day mix.");
  }

  if (total >= 24) {
    lines.push(s.deepConfidence || "Deep confidence is stronger with sustained 30-day volume.");
  }

  if (lines.length < 2) {
    lines.push(s.stillBuilding || "Deep read is still building from recurring entries.");
    lines.push(pickCopy(COPY.strataFallback, total + lines.length));
  }

  if (total < 12) {
    return [lines[1], lines[0]];
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

  // Clima en capa strata: tendency · balance · concentration (canonicalState; total = ventana 30 días). Texto e idioma coherentes.
  if (strataMetricsLine) {
    const total = longWindow.length;
    const parts = buildMetricsLineParts(canonicalState, total, LANG);
    const uiAria = UI_COPY[LANG] || UI_COPY.en;
    if (parts.length > 0) {
      strataMetricsLine.innerHTML = parts.map((p) => p.html).join('<span class="metric-sep" aria-hidden="true"> · </span>');
      strataMetricsLine.setAttribute("aria-label", uiAria.instrumentMetricsAriaStrata || "Deep record metrics");
      strataMetricsLine.classList.remove("hidden");
    } else {
      strataMetricsLine.textContent = "";
      strataMetricsLine.removeAttribute("aria-label");
      strataMetricsLine.classList.add("hidden");
    }
  }

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
    setDegreeDisplay(formatDegree(to));
    return;
  }
  const start = performance.now();
  const finalTxt = formatDegree(to);
  function frame(now) {
    const t = clamp((now - start) / ms, 0, 1);
    const eased = 1 - (1 - t) * (1 - t);
    const current = from + (to - from) * eased;
    const txt = formatDegree(current);
    degreeValue.textContent = txt;
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      lastDisplayedDegreeStr = finalTxt;
      playDegreeSettle();
    }
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
    pattern_a: "Repeated strain in the read.",
    pattern_b: "Repeated mood in the field.",
    pattern_c: "Clustering in the window.",
  };
  const line = repetition?.hasPattern
    ? tagMap[repetition.tag] || "Pattern in the reading."
    : dominant
      ? dominant.split("|").map((s) => capitalizeForDisplay(s.trim())).join(" · ")
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
  } catch (e) {
    reportObservatoryEvent("remote_fallback_moments");
    if (typeof window !== "undefined" && /[?&]debug=1/.test(window.location.search) && typeof console !== "undefined" && console.warn) {
      console.warn("[Observatory] REMOTE_GET_FAILED; using local.", e?.message || "");
    }
    return {
      items: getSharedMoments(localMoments),
      source: "local",
    };
  }
}

/** Estado actual del observatorio para re-renderizar listas (Across the atmosphere + Nearby) con datos frescos sin recargar. */
let observatoryState = null;

/** Actualiza solo las listas de momentos (recent + nearby) con el array indicado. */
function refreshObservatoryLists(sharedMoments) {
  if (!observatoryState || !Array.isArray(sharedMoments)) return;
  renderRecent(sharedMoments);
  renderLocalClimate(
    observatoryState.localClimateTruth,
    observatoryState.canonicalState,
    observatoryState.activeFieldScope?.label || "Nearby",
    observatoryState.observatoryPipeline,
    observatoryState.activeFieldScope,
    sharedMoments
  );
}

function normalizeRepetition(repetition) {
  return {
    hasPattern: Boolean(repetition?.hasPattern),
    tag: repetition?.tag || "",
    strength: Number.isFinite(repetition?.strength) ? repetition.strength : 0,
  };
}

async function loadClimateTruth(localMoments) {
  // Server is canonical truth for computedDegree when remote is available; client only animates displayDegree.
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
  } catch (e) {
    reportObservatoryEvent("remote_fallback_climate");
    if (typeof window !== "undefined" && /[?&]debug=1/.test(window.location.search) && typeof console !== "undefined" && console.warn) {
      console.warn("[Observatory] REMOTE_CLIMATE_GET_FAILED; using local.", e?.message || "");
    }
    const localClimate = calculateClimate(localSharedMoments);
    return {
      source: "local",
      computedDegree: localClimate.computedDegree,
      total: localClimate.total,
      condition: conditionForDegree(localClimate.computedDegree, localClimate.total),
      repetition: localClimate.repetition,
      pressureMode: "",
      toneReading: localClimate.toneReading ?? 50,
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
    const tone = remoteLocalClimate?.toneReading;
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
      toneReading: tone != null && Number.isFinite(tone) ? tone : (globalClimate.toneReading ?? clamp(50 + (computedDegree - BASELINE) * 2.2, 0, 100)),
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
  applyUICopy();

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
    const d = formatDegree(optimisticStartDisplay);
    degreeValue.textContent = d;
    lastDisplayedDegreeStr = d;
    document.body.style.setProperty("--atmo", String(optimisticStartDisplay));
  } else {
    // First load with no stored state: avoid flashing a temporary fixed number.
    degreeValue.textContent = String(BASELINE) + "°";
    lastDisplayedDegreeStr = String(BASELINE) + "°";
    degreeValue.classList.add("is-pending");
    document.body.style.setProperty("--atmo", String(BASELINE));
    if (observatoryPanel) observatoryPanel.setAttribute("aria-busy", "true");
  }

  const [sharedResult, climateTruth, geoIndexResult] = await Promise.all([
    loadSharedMoments(moments),
    loadClimateTruth(moments),
    fetchGeoIndexRemote(8760, "", 4000).then((g) => g).catch(() => null),
  ]);
  const sharedMoments = sharedResult.items;
  if (recentContext) {
    const ui = UI_COPY[LANG] || UI_COPY.en;
    recentContext.textContent = sharedResult.source === "remote"
      ? ui.recentFromRemote
      : ui.recentFromLocal;
  }
  const canonicalState = deriveClimateState(climateTruth, sharedMoments, moments);
  const fieldScopes = buildFieldScopeOptions();
  const preferredScopeValue = normalizeStoredFieldScopeValue(getStoredFieldScope());
  let countryIndex = new Map();
  if (geoIndexResult?.countries) {
    countryIndex = buildCountryIndex(geoIndexResult.countries);
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
  // Pintar la UI en cuanto tengamos momentos y clima global; clima del campo (Nearby) se carga en segundo plano.
  let localClimateTruth = { source: "global_fallback", ...canonicalState };
  loadFieldClimateTruth(canonicalState, activeFieldScope)
    .then((truth) => {
      localClimateTruth = truth;
      const pipeline = buildObservatoryPipeline(sharedMoments, canonicalState, localClimateTruth, activeFieldScope);
      renderLocalClimate(
        localClimateTruth,
        canonicalState,
        activeFieldScope.label || "Nearby",
        pipeline,
        activeFieldScope,
        sharedMoments
      );
      if (observatoryState) {
        observatoryState.localClimateTruth = localClimateTruth;
        observatoryState.observatoryPipeline = pipeline;
      }
    })
    .catch(() => {
      reportObservatoryEvent("remote_fallback_nearby");
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[Observatory] Nearby field data could not be loaded; using wider field.");
      }
    });
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
  if (conditionLine) {
    const ui = UI_COPY[LANG] || UI_COPY.en;
    if (isRemoteReady() && sharedResult.source === "local" && climateTruth.source === "local") {
      conditionLine.textContent = ui.conditionOffline || "Reading from this device only.";
    } else {
      conditionLine.textContent = canonicalState.condition;
    }
  }

  // Instrumento observatorio: usa INSTRUMENT_REAL y helpers para traducir a unidades reales.
  // Clasificación por capa: data-layer="atmosphere", data-scope="global" (si en el futuro hay lectura por zona, se podría data-scope="local").
  if (climateInstrument) {
    climateInstrument.setAttribute("data-layer", "atmosphere");
    climateInstrument.setAttribute("data-scope", canonicalState?.source === "local" ? "local" : "global");
  }
  if (climateMetricsLine) {
    const total = Number(canonicalState?.total) || 0;
    const parts = buildMetricsLineParts(canonicalState, total, LANG, { includeDensity: false });
    if (parts.length > 0) {
      climateMetricsLine.innerHTML = parts.map((p) => p.html).join('<span class="metric-sep" aria-hidden="true"> · </span>');
      climateMetricsLine.classList.remove("hidden");
      if (climateInstrument) climateInstrument.classList.remove("hidden");
      if (observatoryScopeRange) {
        const ui = UI_COPY[LANG] || UI_COPY.en;
        const layerLabel = ui.instrumentLayerLabel || "Atmosphere";
        const scopeLabel = ui.instrumentScopeLabel || "Global";
        const rangeText = ui.scopeRangeLine ? ui.scopeRangeLine(total) : `${total} moments`;
        observatoryScopeRange.textContent = `${layerLabel} · ${scopeLabel} · ${rangeText}`;
        observatoryScopeRange.classList.add("hidden");
      }
      if (instrumentInfoTechnical) {
        const ui = UI_COPY[LANG] || UI_COPY.en;
        const m = ui.metrics || {};
        const windowLabel = LANG === "es" ? "Ventana: 48 h" : "Window: 48h";
        const signalsLabel = LANG === "es" ? (total === 1 ? "1 señal" : `${total} señales`) : (total === 1 ? "1 signal" : `${total} signals`);
        const densityPct = instrumentToDensitySignalPct(total, getDensitySignalRef(total));
        const densityKgM3 = instrumentToDensityKgM3(densityPct);
        const densityFormatted = densityKgM3.toFixed(2).replace(".", LANG === "es" ? "," : ".");
        const densLabel = m.density || (LANG === "es" ? "densidad" : "density");
        const techParts = [`${windowLabel} · ${signalsLabel} · ${densLabel} ${densityFormatted}`];
        const toneReading = canonicalState?.toneReading != null && Number.isFinite(canonicalState.toneReading)
          ? Math.round(canonicalState.toneReading)
          : (total > 0 ? instrumentToPressureHpa(canonicalState?.pressureMode || "") : null);
        const stabilityPct = instrumentToStabilityPercent(canonicalState?.stabilityIndex);
        if (total >= OBSERVABILITY_MIN.tendency && toneReading != null) {
          const pressureUnit = m.pressureUnit ?? "";
          const toneVal = pressureUnit ? `${toneReading} ${pressureUnit}` : String(toneReading);
          techParts.push(`${m.pressureLabel || "tone"} ${toneVal}`);
        }
        if (total >= OBSERVABILITY_MIN.balance && stabilityPct != null) {
          const stabUnit = m.stabilityUnit ?? "%";
          techParts.push(`${m.stability || "stability"} ${stabilityPct}${stabUnit}`);
        }
        instrumentInfoTechnical.textContent = techParts.join(" · ");
        // Telemetría para calibración: no en el hero, solo consola y panel "i"
        const scopeLabel = ui.instrumentScopeLabel || "Global";
        const rangeText = ui.scopeRangeLine ? ui.scopeRangeLine(total) : `${total} moments`;
        console.debug("[observatory]", { scope: `${ui.instrumentLayerLabel || "Atmosphere"} · ${scopeLabel} · ${rangeText}`, density: densityFormatted });
      }
    } else {
      climateMetricsLine.textContent = "";
      climateMetricsLine.classList.add("hidden");
      if (climateInstrument) climateInstrument.classList.add("hidden");
      if (observatoryScopeRange) {
        observatoryScopeRange.textContent = "";
        observatoryScopeRange.classList.add("hidden");
      }
      if (instrumentInfoTechnical) instrumentInfoTechnical.textContent = "";
    }
  }

  if (climateSummaryLine) {
    const total = Number(canonicalState?.total) || 0;
    const degree = Number(canonicalState?.computedDegree) || BASELINE;
    const seed = (total * 7 + Math.round(degree)) | 0;
    if (total > 0) {
      const ui = UI_COPY[LANG] || UI_COPY.en;
      const prefix = ui.readingPrefix || "Reading:";
      climateSummaryLine.textContent = `${prefix} ${getReadingStatusLine(LANG, total, seed)}`;
      climateSummaryLine.classList.remove("hidden");
    } else {
      climateSummaryLine.textContent = "";
      climateSummaryLine.classList.add("hidden");
    }
  }

  const hasSemanticSignal = sharedMoments.slice(0, 48).some((m) => {
    const s = noteSignal(m.note || "");
    return s.reflective > 0 || s.reactive > 0;
  });
  if (atmosphereSemanticHint) {
    atmosphereSemanticHint.textContent = hasSemanticSignal
      ? "Wording in shared moments can nudge the reading."
      : "";
    atmosphereSemanticHint.classList.toggle("hidden", !hasSemanticSignal);
  }
  const totalForWarmup = canonicalState.total || 0;
  if (warmupHint) {
    warmupHint.textContent = "";
    warmupHint.classList.add("hidden");
  }
  renderFutureConfidenceLine(canonicalState, observatoryPipeline);
  renderPatternLayer(canonicalState);
  renderRecent(sharedMoments);
  renderHorizon(canonicalState, sharedMoments, observatoryPipeline);
  renderLocalClimate(
    localClimateTruth,
    canonicalState,
    activeFieldScope.label || "Nearby",
    observatoryPipeline,
    activeFieldScope,
    sharedMoments
  );
  renderStrata(moments, canonicalState);
  initSilentDescentTransitions();
  applyDeepLinkIfPresent();
  if (observatoryPanel) observatoryPanel.removeAttribute("aria-busy");

  observatoryState = {
    sharedMoments,
    canonicalState,
    activeFieldScope,
    localClimateTruth,
    observatoryPipeline,
  };

  viewMoreButton.onclick = () => openSharedSheet(observatoryState?.sharedMoments ?? []);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !observatoryState) return;
    fetchSharedMomentsRemote(SHARED_SHEET_MAX_ITEMS, 48, { skipCache: true })
      .then((raw) => {
        const list = raw.filter((m) => m.shared && !m.hidden);
        observatoryState.sharedMoments = list;
        refreshObservatoryLists(list);
      })
      .catch(() => {});
  });
  sheetBackdrop.onclick = closeSharedSheet;
  sharedSheetCloseButton.onclick = closeSharedSheet;

  const instrumentInfoBtn = document.getElementById("instrumentInfoBtn");
  const instrumentInfoTextEl = document.getElementById("instrumentInfoText");
  const instrumentInfoTechnicalEl = document.getElementById("instrumentInfoTechnical");
  if (instrumentInfoBtn && instrumentInfoTextEl) {
    instrumentInfoBtn.addEventListener("click", () => {
      instrumentInfoTextEl.classList.toggle("hidden");
      if (instrumentInfoTechnicalEl) instrumentInfoTechnicalEl.classList.toggle("hidden");
      instrumentInfoBtn.setAttribute("aria-expanded", String(!instrumentInfoTextEl.classList.contains("hidden")));
    });
  }

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
          activeFieldScope,
          sharedMoments
        );
        if (observatoryState) {
          observatoryState.activeFieldScope = activeFieldScope;
          observatoryState.localClimateTruth = localClimateTruth;
          observatoryState.observatoryPipeline = observatoryPipeline;
        }
      } finally {
        fieldScopeSelect.disabled = false;
      }
    };
  }
}

boot().catch((err) => {
  reportObservatoryEvent("boot_error");
  if (observatoryPanel) observatoryPanel.removeAttribute("aria-busy");
  if (degreeValue) degreeValue.classList.remove("is-pending");
  if (conditionLine) {
    const ui = UI_COPY[LANG] || UI_COPY.en;
    conditionLine.textContent = ui.conditionError || "Something went wrong. Refresh the page.";
  }
  if (typeof console !== "undefined" && console.error) console.error("[Observatory] boot error", err);
});

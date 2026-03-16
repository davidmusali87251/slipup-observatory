/**
 * SlipUp™ Observatory
 */
import {
  fetchClimateRemote,
  fetchGeoIndexRemote,
  fetchSharedMomentsRemote,
  isRemoteReady,
  postRelateMoment,
} from "./remote.js";
import { getReadingStatusLine } from "./uiCopy.js";
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
  ACTIVITY_WEIGHT,
  SPREAD_WEIGHT,
  PERSISTENCE_WEIGHT,
  INERTIA_ALPHA,
  MAX_DEGREE_DELTA,
  ACTIVITY_MAX_MASS_REF,
  PERSISTENCE_MIN_MASS,
  CONDITION_BANDS_V1,
} from "./modelConstants.js";

const STORAGE_KEY = "slipup_v2_moments";
const RENDER_LIMIT = 6; // No es lista: ventana al aire. Pocas partículas visibles. 6–8 ideal, nunca >10. Ver docs/OBSERVATORY_GROWTH_PITFALLS.md.
/** Si true, Horizon puede mostrar una línea por franja del día (morning/afternoon/evening) cuando hay suficientes momentos. */
const ENABLE_TIME_OF_DAY_HINT = true;
const COMPUTED_DEGREE_KEY = "slipup_v2_computed_degree";
const DISPLAY_DEGREE_KEY = "slipup_v2_display_degree";
const FIELD_SCOPE_KEY = "slipup_v2_field_scope";
const RELATE_STORAGE_KEY = "slipup_v2_relate";
const HIDDEN_MOMENT_IDS_KEY = "slipup_v2_hidden_moment_ids";

function getHiddenMomentIds() {
  try {
    const raw = localStorage.getItem(HIDDEN_MOMENT_IDS_KEY);
    if (!raw) return new Set();
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return new Set(data);
    if (data && Array.isArray(data.ids)) return new Set(data.ids);
    return new Set();
  } catch {
    return new Set();
  }
}

/** Devuelve la lista de momentos ocultos con etiqueta (nota o fallback) para mostrar en "Hidden from view". */
function getHiddenMoments() {
  try {
    const raw = localStorage.getItem(HIDDEN_MOMENT_IDS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data.map((id) => ({ id: String(id), label: "" }));
    if (data && Array.isArray(data.ids)) {
      const labels = data.labels || {};
      return data.ids.map((id) => ({ id: String(id), label: labels[id] || "" }));
    }
    return [];
  } catch {
    return [];
  }
}

function addHiddenMomentId(id, label) {
  if (!id) return;
  const entries = getHiddenMoments();
  const ids = entries.map((e) => e.id);
  const labelsMap = {};
  entries.forEach((e) => { labelsMap[e.id] = e.label; });
  if (!ids.includes(id)) ids.push(id);
  labelsMap[id] = typeof label === "string" ? label.trim().slice(0, 80) : "";
  try {
    localStorage.setItem(HIDDEN_MOMENT_IDS_KEY, JSON.stringify({ ids, labels: labelsMap }));
  } catch (_) {}
}

function removeHiddenMomentId(id) {
  if (!id) return;
  const entries = getHiddenMoments();
  const next = entries.filter((e) => e.id !== id);
  try {
    if (next.length === 0) {
      localStorage.removeItem(HIDDEN_MOMENT_IDS_KEY);
      return;
    }
    localStorage.setItem(HIDDEN_MOMENT_IDS_KEY, JSON.stringify({
      ids: next.map((e) => e.id),
      labels: Object.fromEntries(next.map((e) => [e.id, e.label])),
    }));
  } catch (_) {}
}

function filterHiddenMoments(items) {
  const hidden = getHiddenMomentIds();
  return items.filter((m) => !hidden.has(m.id));
}

// Tone selector for key narrative lines:
// narrative = copy observacional (Forming., Leans to X., Holds.); coherente con docs/OBSERVATORY_VISUAL_ARCHITECTURE_AT_SCALE.md (reglas de lenguaje).
// clear/poetic exponen "metrics", "score", "trend" en Horizon/condition; evitar si se respeta arquitectura a escala.
// Diseño a escala: más datos → menos ruido visual. Instrumento, no app. Listas acotadas; sin dashboards en hero. Ver docs/OBSERVATORY_AT_SCALE_VISION.md.
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

/** Gramática generativa: estructuras para producir frases desde type+mood (evolución futura). mood en forma sustantivo: calm, focus, stress, curiosity, fatigue. */
const READING_STRUCTURES = {
  en: [
    (type, mood) => `The reading holds ${type} moments in ${mood}.`,
    (type, mood) => `${type} moments move through ${mood}.`,
    (type, mood) => `A layer of ${type} moments appears in ${mood}.`,
    (type, mood) => `${mood} carries ${type} signals.`,
    (type, mood) => `The field shows ${type} moments in ${mood}.`,
    (type, mood) => `${type} moments settle into ${mood}.`,
  ],
  es: [
    (type, mood) => `La lectura sostiene momentos ${type} en ${mood}.`,
    (type, mood) => `Los momentos ${type} se mueven a través de ${mood}.`,
    (type, mood) => `Una capa de momentos ${type} aparece en ${mood}.`,
    (type, mood) => `El ${mood} lleva señales ${type}.`,
    (type, mood) => `El campo muestra momentos ${type} en ${mood}.`,
    (type, mood) => `Los momentos ${type} se asientan en ${mood}.`,
  ],
};
const MOOD_NOUN = { en: { calm: "calm", focus: "focus", stressed: "stress", curious: "curiosity", tired: "fatigue" }, es: { calm: "calma", focus: "foco", stressed: "estrés", curious: "curiosidad", tired: "cansancio" } };

/** Motor atmosférico de lenguaje: sujeto + verbo + objeto. Generación combinatoria determinista por seed (mismo momento → misma frase). Fases: gathering < 50, forming < 300, breathing >= 300. */
const ATMOSPHERE_LINE = {
  subject: {
    en: ["The atmosphere", "The field", "The reading", "The air", "The sky", "The layer", "The signal field", "The shared air"],
    es: ["La atmósfera", "El campo", "La lectura", "El aire", "El cielo", "La capa", "El campo de señales", "El aire compartido"],
  },
  verb: {
    gathering: { en: ["gathers", "receives", "notes", "records", "collects", "holds", "takes in", "acknowledges"], es: ["reúne", "recibe", "anota", "registra", "recolecta", "sostiene", "acoge", "reconoce"] },
    forming: { en: ["shifts", "adjusts", "records", "notes", "carries", "registers", "moves", "responds"], es: ["se mueve", "se ajusta", "registra", "anota", "lleva", "inscribe", "responde", "reacciona"] },
    breathing: { en: ["receives", "holds", "carries", "registers", "absorbs", "responds", "settles", "acknowledges"], es: ["recibe", "sostiene", "lleva", "registra", "absorbe", "responde", "se asienta", "reconoce"] },
  },
  object: {
    en: ["a moment", "a signal", "a trace", "this moment", "the signal", "a new trace", "a human moment", "a small signal"],
    es: ["un momento", "una señal", "una traza", "este momento", "la señal", "una nueva traza", "un momento humano", "una señal pequeña"],
  },
};

const TRANSIENT_PHASE_THRESHOLDS = { forming: 50, breathing: 300 };

function getAtmospherePhase(total) {
  if (total < TRANSIENT_PHASE_THRESHOLDS.forming) return "gathering";
  if (total < TRANSIENT_PHASE_THRESHOLDS.breathing) return "forming";
  return "breathing";
}

/** Genera una frase atmosférica determinista: mismo seed → misma frase. */
function getAtmosphereLine(seed, lang, total) {
  const phase = getAtmospherePhase(total);
  const L = ATMOSPHERE_LINE;
  const subjects = L.subject[lang] || L.subject.en;
  const verbs = L.verb[phase][lang] || L.verb[phase].en;
  const objects = L.object[lang] || L.object.en;
  const s = subjects[Math.abs(seed) % subjects.length];
  const v = verbs[Math.abs((seed >>> 8) || seed) % verbs.length];
  const o = objects[Math.abs((seed >>> 16) || seed + 1) % objects.length];
  return `${s} ${v} ${o}.`;
}

/** Umbral para compatibilidad con showTransientReading (ya no se usa para elegir pool, sino getAtmospherePhase). */
const TRANSIENT_BREATHING_THRESHOLD = TRANSIENT_PHASE_THRESHOLDS.forming;

/** Frases post-contribute: aparecen 2–3 s debajo del grado cuando el usuario vuelve al Observatory. Tono: breve, atmosférico, presente. 24 frases en dos pools (gathering = campo formándose; breathing = campo con masa). */
const TRANSIENT_PHRASES = {
  gathering: {
    en: [
      "The atmosphere gathers signals.",
      "A moment enters the air.",
      "Still forming.",
      "The field receives a signal.",
      "Moment registered.",
      "Signal recorded.",
      "The field notes a signal.",
      "The reading registers a moment.",
      "The atmosphere receives the moment.",
      "A trace enters the sky.",
      "The air holds a new trace.",
      "The field grows.",
      "Every moment leaves a trace.",
      "Registered in the atmosphere.",
      "A trace has settled.",
      "The reading has shifted.",
    ],
    es: [
      "La atmósfera reúne señales.",
      "Un momento entra en el aire.",
      "Aún formándose.",
      "El campo recibe una señal.",
      "Momento registrado.",
      "Señal registrada.",
      "El campo anota una señal.",
      "La lectura registra un momento.",
      "La atmósfera recibe el momento.",
      "Una traza entra en el cielo.",
      "El aire guarda una nueva traza.",
      "El campo crece.",
      "Cada momento deja una traza.",
      "Registrado en la atmósfera.",
      "Una traza se ha asentado.",
      "La lectura se ha movido.",
    ],
  },
  breathing: {
    en: [
      "The atmosphere shifts.",
      "The reading adjusts.",
      "A signal enters the air.",
      "The field receives a moment.",
      "A moment rises into the atmosphere.",
      "The atmosphere carries the signal.",
      "The air moves slightly.",
      "A small shift in the field.",
      "The atmosphere tilts.",
      "The field responds.",
      "Signal registered.",
      "The sky notices.",
      "Every moment leaves a trace.",
      "Registered in the atmosphere.",
      "A trace has settled.",
      "The reading has shifted.",
    ],
    es: [
      "La atmósfera se mueve.",
      "La lectura se ajusta.",
      "Una señal entra en el aire.",
      "El campo recibe un momento.",
      "Un momento sube a la atmósfera.",
      "La atmósfera lleva la señal.",
      "El aire se mueve un poco.",
      "Un pequeño movimiento en el campo.",
      "La atmósfera se inclina.",
      "El campo responde.",
      "Señal registrada.",
      "El cielo lo nota.",
      "Cada momento deja una traza.",
      "Registrado en la atmósfera.",
      "Una traza se ha asentado.",
      "La lectura se ha movido.",
    ],
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

/** Hook opcional para métricas/servicio externo (Sentry, Analytics). Si window.__observatoryReportEvent es una función, se llama con el nombre del evento; sin payload de usuario. Eventos: observatory_view (boot), contribute_view/contribute_done (contribute.js). Ver docs/SLIPUP_METRICS_AND_SIGNALS.md. */
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
      stable: ["Near baseline.", "Holds.", "Steady."],
      fallback: ["Light signal.", "Wider field."],
      regional: ["Reading from this zone.", "This scope shapes the line."],
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
      stable: ["Cerca del baseline.", "Se mantiene.", "Estable."],
      fallback: ["Señal liviana.", "Campo amplio."],
      regional: ["Leyendo esta zona.", "Este alcance da forma a la línea."],
    },
    strataFallback: ["Los momentos se asientan en capas profundas.", "Tu registro se profundiza.", "Las capas siguen asentándose."],
    strataEarly: ["Tu registro profundo sigue formándose.", "Solo las primeras capas.", "Lo profundo sigue abierto."],
  },
};
const COPY = COPY_VARIANTS[COPY_MODE === "narrative" ? "narrative_" + LANG : COPY_MODE] || COPY_VARIANTS.poetic;

/** Atmospheric Weather: lectura 48h. Lenguaje simple y juvenil, estados de la materia. */
const ATMOSPHERIC_WEATHER_LABELS = {
  en: {
    calm: ["All calm.", "Light and easy.", "Nothing heavy.", "Clear and still.", "Easy drift."],
    reflective: ["Taking it in.", "Inside weather.", "Long echoes.", "Waiting.", "Quiet signal."],
    tension: ["Restless.", "Heavy in the air.", "A lot going on.", "Things are tight.", "Weight."],
    release: ["Clear sky.", "Light is back.", "Open air.", "Letting go.", "Ease."],
  },
  es: {
    calm: ["Todo en calma.", "Ligero y suave.", "Nada pesado.", "Claro y quieto.", "Deriva tranquila."],
    reflective: ["Se está procesando.", "Clima adentro.", "Ecos largos.", "En espera.", "Señal baja."],
    tension: ["Inquieto.", "Pesado en el aire.", "Hay mucho.", "Todo apretado.", "Peso."],
    release: ["Cielo claro.", "Vuelve la luz.", "Aire abierto.", "Soltando.", "Alivio."],
  },
};

const UI_COPY = {
  en: {
    orientation: "",
    valueProp: "Collective reading from shared moments",
    cta: "Let the atmosphere read it.",
    emptyStateQuiet: "The atmosphere is quiet.",
    emptyStateSignal: "What settles here becomes signal.",
    momentLeavesTrace: "Every moment leaves a trace.",
    supportObservatoryTooltip: "Your support keeps the observatory ad-free and the field alive.",
    supportObservatoryCaption: "Keep the field alive.",
    contributeInvite: "A shared atmosphere of human moments.\nLet one moment rise.",
    ctaObservatoryLabel: "Contribute",
    contributeFooterLine: "Let one moment rise.",
    trust: "No account. Region only. Shared moments.",
    scopeLabel: "48h",
    recentFromRemote: "Across the atmosphere.",
    recentFromLocal: "Moments from this device only.",
    conditionPending: "Global signal pending.",
    conditionError: "Something went wrong. Refresh the page.",
    conditionOffline: "Reading from this device only.",
    mixLine: (type, mood) => `Mostly ${type}, ${mood}.`,
    eyebrowLayer: "Atmosphere",
    eyebrowContext: "Moments",
    heroIdentityLine: "Where human moments meet",
    sharedFieldLine: "Shared field — last 48h",
    horizonTitle: "Horizon",
    horizonMoreLabel: "Deeper",
    timeOfDayMorningLabel: "Morning",
    timeOfDayAfternoonLabel: "Afternoon",
    timeOfDayEveningLabel: "Evening",
    nearbyTitle: "Nearby",
    nearbySignalsLine: "Signals nearby",
    instrumentAriaLabel: "Reading metrics",
    instrumentLayerLabel: "Atmosphere",
    instrumentScopeLabel: "Global",
    scopeRangeLine: (n) => (n === 1 ? "1 moment" : `${n} moments`),
    instrumentMetricsAriaNearby: "Nearby field metrics",
    instrumentMetricsAriaStrata: "Deep record metrics",
    instrumentInfoCopy: "Type, mood, note, recency — what shapes each moment.",
    degreeScaleLabel: "0–100 scale",
    readingPrefix: "",
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
      sedimentObservedCalmAfterStress: "Observed calm appears often after stress.",
      sedimentAvoidableTensionLate: "Avoidable tension repeats late in the day.",
      sedimentFertileAfterFatigue: "Fertile moments follow fatigue.",
      sedimentObservedStability: "Observed calm appears often under stress.",
      sedimentAvoidableReturnsLate: "Avoidable tension returns late.",
      sedimentFertileDominant: "Fertile moments show up in the mix.",
      sedimentStillForming: "Your deep record is still forming.",
      sedimentFirstLayers: "First layers only.",
      sedimentPatternBeginning: "A pattern is beginning to settle.",
      sedimentTentativePatternForming: "A line begins to appear.",
      sedimentTentativeObservedCalm: "Observed calm appears after stress.",
      sedimentTentativeTensionGathers: "Some tension gathers late.",
      sedimentRecurrenceObservedCalm: "Observed calm often follows stress.",
      sedimentRecurrenceAvoidableLate: "Avoidable tension returns late.",
      sedimentRecurrenceFertileAfterFatigue: "Fertile moments appear after fatigue.",
      sedimentMatureObservedCalm: "Observed calm returns after stress.",
      sedimentMatureAvoidableLate: "Avoidable tension gathers late in the day.",
      sedimentMatureFertileAfterFatigue: "Fertile openings follow fatigue.",
      sedimentMatureOpeningsAfterDense: "Openings appear after dense periods.",
      sedimentCollectiveEcho: "The field echoes.",
    },
    strataContextLine: "Below the surface, your moments settle into deeper record.",
    strataSeedsLabel: "Your seeds",
    strataShareLine: "Share this trace",
    strataShareCopied: "Copied",
    viewMore: "View more",
    close: "Close",
    sheetEmpty: "No shared moments yet.",
    sheetTitle: "Shared moments",
    sheetTitleNearby: "Moments nearby",
    sheetCountNearby: "Showing nearby.",
    momentRelateLabel: "Not alone",
    momentRelateLabelYou: "Not alone · you",
    momentRelateAria: "Mark that this resonates with you too",
    momentRelateInfoTitle: "Not alone",
    resonanceFeedback: ["Signal shared.", "You are not alone.", "Another observer.", "Field expanded."],
    atmosphericWeatherCaption: "The atmosphere reflects the last 48 hours of moments.",
    orbitalTransitionLine: "Entering orbital view",
    momentConstellationLine: "This moment is part of a constellation.",
    momentConstellationRelatedLabel: "Connected moments",
    momentRemoveLabel: "Remove",
    momentRemoveAria: "Remove this moment from your view",
    momentReportLabel: "Report",
    momentReportAria: "Report this moment to moderators",
    hiddenFromViewTitle: "Hidden from view",
    hiddenFromViewDescription: "Moments you hid from this view. You can show them again below.",
    showAgainLabel: "Show again",
    nearbyRelateLabel: (count) => (count === 1 ? "1 nearby" : `${count} nearby`),
    sheetCount: () => "Showing recent.",
    loading: "Loading…",
    localFieldMomentsLabel: "In the nearby field",
    nearbyIntroLine: "Reading nearby.",
    nearbyMomentsLabel: "Moments",
    nearbyReadingStable: ["Quiet.", "Steady.", "Holds."],
    nearbyReadingClearing: ["Light movement.", "Easing.", "Opening."],
    nearbyReadingCondensing: ["Forming.", "Tightening.", "Rising."],
    nearbyReadingFallback: ["Quiet.", "Light signal."],
    localFieldMomentsEmpty: "No shared moments in this scope yet.",
    localFieldEmptyQuiet: "The field is quiet.",
    nearbyEmptyExamples: ["The field gathers here.", "Signals will rise.", "Reading forms in the scope."],
    nearbySignalsTitle: "Nearby signals",
    nearbyViewMoreLabel: "View more",
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
    cta: "Deja que la atmósfera lo lea.",
    emptyStateQuiet: "La atmósfera está en calma.",
    emptyStateSignal: "Lo que se asienta aquí se vuelve señal.",
    momentLeavesTrace: "Cada momento deja una traza.",
    supportObservatoryTooltip: "Tu apoyo mantiene el observatorio sin anuncios y el campo vivo.",
    supportObservatoryCaption: "Mantené el campo vivo.",
    contributeInvite: "Una atmósfera compartida de momentos humanos.\nDejá subir un momento.",
    ctaObservatoryLabel: "Contribuir",
    contributeFooterLine: "Dejá subir un momento.",
    trust: "Sin cuenta. Solo región. Momentos compartidos.",
    scopeLabel: "48 h",
    recentFromRemote: "En la atmósfera.",
    recentFromLocal: "Solo momentos de este dispositivo.",
    conditionPending: "Señal global pendiente.",
    conditionError: "Algo ha fallado. Recarga la página.",
    conditionOffline: "Leyendo solo desde este dispositivo.",
    mixLine: (type, mood) => `Sobre todo ${type}, ${mood}.`,
    eyebrowLayer: "Atmósfera",
    eyebrowContext: "Momentos",
    heroIdentityLine: "Donde se encuentran los momentos humanos",
    sharedFieldLine: "Campo compartido — últimas 48 h",
    horizonTitle: "Horizonte",
    horizonMoreLabel: "Más",
    timeOfDayMorningLabel: "Mañana",
    timeOfDayAfternoonLabel: "Tarde",
    timeOfDayEveningLabel: "Noche",
    nearbyTitle: "Cercano",
    instrumentAriaLabel: "Métricas de lectura",
    instrumentLayerLabel: "Atmósfera",
    instrumentScopeLabel: "Global",
    scopeRangeLine: (n) => (n === 1 ? "1 momento" : `${n} momentos`),
    instrumentMetricsAriaNearby: "Métricas del campo cercano",
    instrumentMetricsAriaStrata: "Métricas del registro profundo",
    instrumentInfoCopy: "Tipo, humor, nota, recencia: lo que da forma a cada momento.",
    degreeScaleLabel: "0–100 escala",
    readingPrefix: "",
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
      sedimentObservedCalmAfterStress: "La calma observada aparece a menudo tras el estrés.",
      sedimentAvoidableTensionLate: "La tensión evitable se repite al final del día.",
      sedimentFertileAfterFatigue: "Los momentos fértiles siguen al cansancio.",
      sedimentObservedStability: "La calma observada aparece a menudo bajo estrés.",
      sedimentAvoidableReturnsLate: "La tensión evitable vuelve tarde.",
      sedimentFertileDominant: "Los momentos fértiles aparecen en la mezcla.",
      sedimentStillForming: "Tu registro profundo sigue formándose.",
      sedimentFirstLayers: "Solo las primeras capas.",
      sedimentPatternBeginning: "Un patrón empieza a asentarse.",
      sedimentTentativePatternForming: "Una línea empieza a aparecer.",
      sedimentTentativeObservedCalm: "La calma observada aparece tras el estrés.",
      sedimentTentativeTensionGathers: "Algo de tensión se acumula tarde.",
      sedimentRecurrenceObservedCalm: "La calma observada sigue a menudo al estrés.",
      sedimentRecurrenceAvoidableLate: "La tensión evitable vuelve tarde.",
      sedimentRecurrenceFertileAfterFatigue: "Los momentos fértiles aparecen tras el cansancio.",
      sedimentMatureObservedCalm: "La calma observada vuelve tras el estrés.",
      sedimentMatureAvoidableLate: "La tensión evitable se acumula al final del día.",
      sedimentMatureFertileAfterFatigue: "Las aperturas fértiles siguen al cansancio.",
      sedimentMatureOpeningsAfterDense: "Las aperturas aparecen tras periodos densos.",
      sedimentCollectiveEcho: "El campo hace eco.",
    },
    strataContextLine: "Bajo la superficie, tus momentos se asientan en un registro más profundo.",
    strataSeedsLabel: "Tus semillas",
    strataShareLine: "Compartir esta traza",
    strataShareCopied: "Copiado",
    viewMore: "Ver más",
    close: "Cerrar",
    sheetEmpty: "Aún no hay momentos compartidos.",
    sheetTitle: "Momentos compartidos",
    sheetTitleNearby: "Moments cercanos",
    sheetCountNearby: "Se muestran cercanos.",
    localFieldMomentsLabel: "En el campo cercano",
    nearbyIntroLine: "Lectura cercana.",
    nearbyMomentsLabel: "Momentos",
    nearbyReadingStable: ["Tranquilo.", "Estable.", "Se mantiene."],
    nearbyReadingClearing: ["Movimiento suave.", "Aflojando.", "Abriendo."],
    nearbyReadingCondensing: ["Formando.", "Apretando.", "Subiendo."],
    nearbyReadingFallback: ["Tranquilo.", "Señal ligera."],
    localFieldMomentsEmpty: "Aún no hay momentos compartidos en este ámbito.",
    localFieldEmptyQuiet: "El campo está quieto.",
    nearbyEmptyExamples: ["El campo se reúne aquí.", "Las señales subirán.", "La lectura se forma en el ámbito."],
    nearbySignalsTitle: "Señales cercanas",
    nearbySignalsLine: "Señales cercanas",
    nearbyViewMoreLabel: "Ver más",
    momentRelateLabel: "No estás solo",
    momentRelateLabelYou: "No estás solo · tú",
    momentRelateAria: "Señalar que esto también resuena contigo",
    momentRelateInfoTitle: "No estás solo",
    resonanceFeedback: ["Señal compartida.", "No estás solo.", "Otro observador.", "Campo expandido."],
    atmosphericWeatherCaption: "La atmósfera refleja las últimas 48 horas de momentos.",
    orbitalTransitionLine: "Entrando a vista orbital",
    momentConstellationLine: "Este momento forma parte de una constelación.",
    momentConstellationRelatedLabel: "Momentos conectados",
    momentRemoveLabel: "Quitar",
    momentRemoveAria: "Quitar este momento de tu vista",
    momentReportLabel: "Denunciar",
    momentReportAria: "Denunciar este momento ante moderación",
    hiddenFromViewTitle: "Ocultos de tu vista",
    hiddenFromViewDescription: "Momentos que ocultaste de tu vista. Puedes volver a mostrarlos abajo.",
    showAgainLabel: "Mostrar de nuevo",
    nearbyRelateLabel: (count) => (count === 1 ? "1 en el campo" : `${count} en el campo`),
    sheetCount: () => "Se muestran recientes.",
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
  const heroIdentityEl = document.getElementById("heroIdentityLine");
  if (heroIdentityEl && ui.heroIdentityLine) heroIdentityEl.textContent = ui.heroIdentityLine;
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
  const contributeFooterLink = document.getElementById("contributeFooterLink");
  if (contributeFooterLink && ui.contributeFooterLine) contributeFooterLink.textContent = ui.contributeFooterLine;
  const ctaObservatory = document.getElementById("ctaObservatory");
  if (ctaObservatory && ui.ctaObservatoryLabel) ctaObservatory.textContent = ui.ctaObservatoryLabel;
  const ctaObservatoryTooltip = document.getElementById("ctaObservatoryTooltip");
  if (ctaObservatoryTooltip && ui.momentLeavesTrace) ctaObservatoryTooltip.textContent = ui.momentLeavesTrace;
  const viewMoreTooltip = document.getElementById("viewMoreTooltip");
  if (viewMoreTooltip && ui.momentLeavesTrace) viewMoreTooltip.textContent = ui.momentLeavesTrace;
  const supportObservatoryTooltip = document.getElementById("supportObservatoryTooltip");
  if (supportObservatoryTooltip && ui.supportObservatoryTooltip) supportObservatoryTooltip.textContent = ui.supportObservatoryTooltip;
  const supportObservatoryCaption = document.getElementById("supportObservatoryCaption");
  if (supportObservatoryCaption && ui.supportObservatoryCaption) supportObservatoryCaption.textContent = ui.supportObservatoryCaption;
  const strataSeedsEl = document.getElementById("strataSeedsBtn");
  if (strataSeedsEl && ui.strataSeedsLabel) strataSeedsEl.textContent = ui.strataSeedsLabel;
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
      "Tightening.",
      "Rising.",
      "Denser here.",
    ],
    clearing: [
      "Easing.",
      "Opening.",
      "Lighter here.",
    ],
    stable: [
      "Near baseline.",
      "Holds.",
      "Steady.",
    ],
    fallback: [
      "Light signal.",
      "Wider field.",
      "Reading wider.",
    ],
    regional: [
      "Reading from this zone.",
      "Local read.",
      "This zone.",
    ],
  },
  continents: {
    america: {
      condensing: ["Tightening.", "Rising."],
      clearing: ["Easing.", "Opening."],
      stable: ["Near baseline.", "Steady."],
    },
    europe: {
      condensing: ["Tightening.", "Rising."],
      clearing: ["Easing.", "Opening."],
      stable: ["Near baseline.", "Steady."],
    },
    africa: {
      condensing: ["Tightening.", "Rising."],
      clearing: ["Easing.", "Opening."],
      stable: ["Near baseline.", "Steady."],
    },
    asia: {
      condensing: ["Tightening.", "Rising."],
      clearing: ["Easing.", "Opening."],
      stable: ["Near baseline.", "Steady."],
    },
    australia: {
      condensing: ["Tightening.", "Rising."],
      clearing: ["Easing.", "Opening."],
      stable: ["Near baseline.", "Steady."],
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

/** Actualiza el display del grado y, si cambió, reproduce la inercia del indicador. Soporta estructura con .degree-num + .degree-unit. */
function setDegreeDisplay(txt) {
  if (!degreeValue) return;
  const numEl = degreeValue.querySelector(".degree-num");
  const str = String(txt);
  const numMatch = str.match(/^([\d.]+)/);
  const numStr = numMatch ? numMatch[1] : str.replace(/°$/, "");
  if (numStr !== lastDisplayedDegreeStr) {
    lastDisplayedDegreeStr = numStr;
    if (numEl) numEl.textContent = numStr; else degreeValue.textContent = txt;
    playDegreeSettle();
  } else {
    if (numEl) numEl.textContent = numStr; else degreeValue.textContent = txt;
  }
}
const conditionLine = document.getElementById("conditionLine");
const atmosphericWeatherLine = document.getElementById("atmosphericWeatherLine");
const atmosphericWeatherCaption = document.getElementById("atmosphericWeatherCaption");
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
const horizonTimeOfDayLine = document.getElementById("horizonTimeOfDayLine");
const horizonMoreButton = document.getElementById("horizonMoreButton");
const heroEl = document.getElementById("observatory-hero");
const atmospherePatternLine = document.getElementById("atmosphere-pattern-line");
const transientReadingLine = document.getElementById("transientReadingLine");
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
const localClimateIntro = document.getElementById("localClimateIntro");
const localClimatePrimary = document.getElementById("localClimatePrimary");
const localClimateSecondary = document.getElementById("localClimateSecondary");
const localClimateEcho = document.getElementById("localClimateEcho");
const localClimateMomentsLabel = document.getElementById("localClimateMomentsLabel");
const localClimateMoments = document.getElementById("localClimateMoments");
const groundStrata = document.getElementById("ground-strata");
const strataLines = document.getElementById("strataLines");
const strataMetricsLine = document.getElementById("strataMetricsLine");
const hiddenFromViewWrap = document.getElementById("hidden-from-view-wrap");
const hiddenFromViewList = document.getElementById("hiddenFromViewList");

const query = new URLSearchParams(window.location.search);
const contributed = query.get("contributed") === "1";
const SHARED_SHEET_MAX_ITEMS = 100;
/** Tamaño de cada "página" al hacer scroll infinito dentro del sheet (evita paginación, navegación fluida). */
const SHARED_SHEET_PAGE_SIZE = 25;
const SHEET_TRANSITION_MS = 280;

let sharedSheetFullList = [];
let sharedSheetConstellations = null;
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

  const out = {
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
  if (climateTruth.activity != null) out.activity = climateTruth.activity;
  if (climateTruth.spread != null) out.spread = climateTruth.spread;
  if (climateTruth.persistence != null) out.persistence = climateTruth.persistence;
  return out;
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

/** Atmospheric Weather: lectura poética del estado del campo (últimas 48h). No analytics. */
function getAtmosphericWeather(moments48h) {
  if (!Array.isArray(moments48h) || moments48h.length < 3) return null;
  const { byType } = compositionCounts(moments48h);
  const total = moments48h.length;
  const avoidableRatio = byType.avoidable / total;
  const fertileRatio = byType.fertile / total;
  const observedRatio = byType.observed / total;
  const seed = total + Math.round(avoidableRatio * 10 + fertileRatio * 10);
  const lang = LANG === "es" ? "es" : "en";
  const lib = ATMOSPHERIC_WEATHER_LABELS[lang];
  let state;
  let labels;
  if (avoidableRatio >= 0.4) {
    state = "tension";
    labels = lib.tension;
  } else if (fertileRatio >= 0.4) {
    state = "release";
    labels = lib.release;
  } else if (observedRatio >= 0.5) {
    state = "reflective";
    labels = lib.reflective;
  } else {
    state = "calm";
    labels = lib.calm;
  }
  const label = labels[Math.abs(seed) % labels.length];
  return { state, label };
}

const WINDOW_HOURS = 48;

/** Agrega momentos de la ventana 48h en 48 buckets horarios. Cada bucket: { total, typeCounts, hourIndex }. */
function aggregateMomentsIntoBuckets(moments) {
  const now = Date.now();
  const buckets = Array.from({ length: WINDOW_HOURS }, (_, i) => ({
    total: 0,
    typeCounts: { avoidable: 0, fertile: 0, observed: 0 },
    hourIndex: i,
  }));
  for (const m of moments) {
    const ageHours = (now - new Date(m.timestamp).getTime()) / 3600_000;
    if (ageHours < 0 || ageHours >= WINDOW_HOURS) continue;
    const slot = Math.min(WINDOW_HOURS - 1, Math.max(0, Math.floor(WINDOW_HOURS - 1 - ageHours)));
    const b = buckets[slot];
    b.total += 1;
    const t = String(m.type || "observed").toLowerCase();
    if (b.typeCounts[t] != null) b.typeCounts[t] += 1;
    else b.typeCounts[t] = 1;
  }
  return buckets;
}

/** Activity normalizada [0,1]: log(1+mass)/log(1+ref). Evita que activity domine el raw degree. */
function normalizeActivity(mass, ref = ACTIVITY_MAX_MASS_REF) {
  return Math.min(1, Math.log(1 + mass) / Math.log(1 + ref));
}

/** Masa reciente = últimas 6 horas. Activity en [0,1]. */
function computeActivityV1(buckets) {
  const recent = buckets.slice(-6);
  const mass = recent.reduce((s, b) => s + b.total, 0);
  return normalizeActivity(mass);
}

/** Spread por type solamente: 1 - sum(p_c^2). Dispersión de la mezcla. */
function computeSpreadV1(buckets) {
  const total = buckets.reduce((s, b) => s + b.total, 0);
  if (total === 0) return 0;
  const combined = {};
  for (const b of buckets) {
    for (const [type, count] of Object.entries(b.typeCounts || {})) {
      combined[type] = (combined[type] || 0) + count;
    }
  }
  const p = Object.values(combined).map((c) => c / total);
  const concentration = p.reduce((s, x) => s + x * x, 0);
  return 1 - concentration;
}

/** Proporción de buckets con masa >= threshold (presencia sostenida, no ruido). */
function computePersistenceV1(buckets) {
  const active = buckets.filter((b) => b.total >= PERSISTENCE_MIN_MASS).length;
  return buckets.length ? active / buckets.length : 0;
}

function computeRawDegreeV1(activity, spread, persistence) {
  return (
    (ACTIVITY_WEIGHT * activity + SPREAD_WEIGHT * spread + PERSISTENCE_WEIGHT * persistence) * SCALE
  );
}

/** Inercia + cap de movimiento: el cielo se desplaza, no salta. */
function applyInertiaV1(prev, raw, totalMass) {
  const inertia = 1 / (1 + INERTIA_ALPHA * Math.log(1 + totalMass));
  const delta = inertia * (raw - prev);
  const capped = Math.max(-MAX_DEGREE_DELTA, Math.min(MAX_DEGREE_DELTA, delta));
  return prev + capped;
}

function conditionFromBandsV1(degree) {
  const band = CONDITION_BANDS_V1.find((b) => degree <= b.max);
  return band ? band.label : CONDITION_BANDS_V1[CONDITION_BANDS_V1.length - 1].label;
}

/** true = usar motor v1 (buckets + Activity/Spread/Persistence + inercia + bandas). */
const USE_V1_AGGREGATION = true;

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

  if (USE_V1_AGGREGATION) {
    const buckets = aggregateMomentsIntoBuckets(windowed);
    const totalMass = buckets.reduce((s, b) => s + b.total, 0);
    const activity = computeActivityV1(buckets);
    const spread = computeSpreadV1(buckets);
    const persistence = computePersistenceV1(buckets);
    const raw = computeRawDegreeV1(activity, spread, persistence);
    const prev = getStoredComputedDegree();
    const prevDegree = prev != null && Number.isFinite(prev) ? prev : BASELINE;
    const computedDegree = clamp(applyInertiaV1(prevDegree, raw, totalMass), 0, SCALE);
    const condition = conditionFromBandsV1(computedDegree);
    const toneReading = clamp(50 + (computedDegree - BASELINE) * 2.2, 0, 100);
    return {
      computedDegree,
      total: totalMass,
      latestTimestamp: latestInWindow ? latestInWindow.timestamp : null,
      repetition,
      toneReading,
      condition,
      activity,
      spread,
      persistence,
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
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Etiquetas observatory para type/mood en la lista de momentos: reflejo de la elección original, una palabra, estilo campo. */
const MOMENT_TYPE_MOOD_DISPLAY = {
  en: {
    type: { observed: "Noted", fertile: "Opening", avoidable: "Recurrence" },
    mood: { calm: "Calm", focus: "Focus", stressed: "Strain", curious: "Curious", tired: "Weary" },
  },
  es: {
    type: { observed: "Anotado", fertile: "Apertura", avoidable: "Recurrencia" },
    mood: { calm: "Calma", focus: "Foco", stressed: "Tensión", curious: "Curioso", tired: "Cansancio" },
  },
};

function getMomentTypeMoodLabels(lang, type, mood) {
  const l = (MOMENT_TYPE_MOOD_DISPLAY[lang] || MOMENT_TYPE_MOOD_DISPLAY.en);
  const t = String(type || "").toLowerCase();
  const m = String(mood || "").toLowerCase();
  return {
    typeLabel: (l.type && l.type[t]) || capitalizeForDisplay(type),
    moodLabel: (l.mood && l.mood[m]) || capitalizeForDisplay(mood),
  };
}

/** Id estable para un momento (debe coincidir con createMomentItemElement). */
function getMomentStableId(m) {
  return m.id || `${m.timestamp || ""}-${(m.note || "").slice(0, 10)}`;
}

/** Moment Constellations: detecta clusters de 4+ momentos con mismo mood en 48h. Devuelve mapa por id de momento. */
function getConstellations(moments) {
  const window48h = getRecentWindow(moments || []);
  if (window48h.length < 4) return { byMomentId: {} };
  const byMood = new Map();
  window48h.forEach((m) => {
    const mood = String(m.mood || "observed").toLowerCase();
    if (!byMood.has(mood)) byMood.set(mood, []);
    byMood.get(mood).push(m);
  });
  const byMomentId = Object.create(null);
  byMood.forEach((group, key) => {
    if (group.length < 4) return;
    group.forEach((m) => {
      const related = group.filter((other) => other !== m);
      byMomentId[getMomentStableId(m)] = { key, related };
    });
  });
  return { byMomentId };
}

/** Maps relate count to resonance tier for The Resonance Field (aura levels). */
function getResonanceTier(count) {
  if (count >= 15) return "15";
  if (count >= 7) return "7";
  if (count >= 3) return "3";
  if (count >= 1) return "1";
  return "0";
}

function createMomentItemElement(m, options = {}) {
  const inNearbyField = options.inNearbyField === true;
  const li = document.createElement("li");
  li.className = "moment-item" + (inNearbyField ? " moment-item-nearby" : "");
  const note = m.note ? m.note.trim() : "(no note)";
  const { typeLabel, moodLabel } = getMomentTypeMoodLabels(LANG, m.type, m.mood);
  const noteLabel = note === "(no note)" ? note : capitalizeNoteForDisplay(note);
  const timeStr = new Date(m.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const regionLabel = formatGeoForDisplay(m.geo_bucket);

  if (inNearbyField) {
    const context = regionLabel ? `${typeLabel} · ${moodLabel} · ${regionLabel}` : `${typeLabel} · ${moodLabel}`;
    li.innerHTML = `<span class="moment-note">${escapeHtml(noteLabel)}</span><span class="moment-context">${escapeHtml(context)}</span>`;
  } else {
    const meta = regionLabel || timeStr;
    li.innerHTML =
      `<span class="moment-note">${escapeHtml(noteLabel)}</span>` +
      `<span class="moment-type-mood">${escapeHtml(typeLabel + " · " + moodLabel)}</span>` +
      `<span class="moment-meta">${escapeHtml(meta)}</span>`;
  }

  const momentId = m.id || `${m.timestamp || ""}-${(m.note || "").slice(0, 10)}`;
  const localIds = new Set((loadMoments() || []).map((mom) => mom.id || `${mom.timestamp || ""}-${(mom.note || "").slice(0, 10)}`));
  const isOwnMoment = localIds.has(momentId);

  const ui = UI_COPY[LANG] || UI_COPY.en;
  const relateBtn = document.createElement("button");
  relateBtn.type = "button";
  relateBtn.className = "moment-relate-btn";
  relateBtn.setAttribute("aria-label", ui.momentRelateAria || "Mark that this resonates with you too");
  relateBtn.dataset.relateCount = String(typeof m.relate_count === "number" ? m.relate_count : 0);
  li.dataset.resonance = getResonanceTier(parseInt(relateBtn.dataset.relateCount, 10) || 0);

  const SIGNAL_IDLE = "\u2022))";
  const SIGNAL_ACTIVE = "\u2022)))";

  const resonanceFeedbackEl = document.createElement("span");
  resonanceFeedbackEl.className = "moment-resonance-feedback";
  resonanceFeedbackEl.setAttribute("aria-live", "polite");

  function updateRelateLabel() {
    const count = parseInt(relateBtn.dataset.relateCount, 10) || 0;
    li.dataset.resonance = getResonanceTier(count);
    const you = getRelateState(momentId);
    const symbol = you ? SIGNAL_ACTIVE : SIGNAL_IDLE;
    const text = count > 0 ? `${symbol} ${count}` : symbol;
    relateBtn.textContent = text;
    relateBtn.classList.toggle("is-active", you);
  }

  updateRelateLabel();
  relateBtn.addEventListener("click", async () => {
    if (getRelateState(momentId)) return;
    const card = relateBtn.closest(".moment-item");
    if (card) {
      card.classList.add("moment-item--resonance-pulse");
      setTimeout(() => card.classList.remove("moment-item--resonance-pulse"), 450);
    }
    relateBtn.classList.add("moment-relate-btn--pulse", "moment-relate-btn--ripple", "moment-relate-btn--glow");
    const pulseDuration = 180;
    const rippleDuration = 420;
    const glowDuration = 400;
    setTimeout(() => relateBtn.classList.remove("moment-relate-btn--pulse"), pulseDuration);
    setTimeout(() => relateBtn.classList.remove("moment-relate-btn--ripple"), rippleDuration);
    setTimeout(() => relateBtn.classList.remove("moment-relate-btn--glow"), glowDuration);
    const phrases = (ui.resonanceFeedback || (LANG === "es" ? ["Campo expandido."] : ["Field expanded."]));
    resonanceFeedbackEl.textContent = phrases[Math.floor(Math.random() * phrases.length)];
    resonanceFeedbackEl.classList.add("is-visible");
    setTimeout(() => resonanceFeedbackEl.classList.remove("is-visible"), 1000);
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

  const infoBtn = document.createElement("button");
  infoBtn.type = "button";
  infoBtn.className = "moment-relate-info-btn";
  infoBtn.setAttribute("aria-label", LANG === "es" ? "No estás solo" : "Not alone");
  infoBtn.textContent = "i";

  const infoTooltipText = ui.momentRelateInfoTitle || (LANG === "es" ? "No estás solo" : "Not alone");
  const infoTooltip = document.createElement("span");
  infoTooltip.className = "moment-relate-info-tooltip";
  infoTooltip.setAttribute("role", "status");
  infoTooltip.textContent = infoTooltipText;

  infoBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll(".moment-relate-info-tooltip.is-visible").forEach((el) => el.classList.remove("is-visible"));
    infoTooltip.classList.toggle("is-visible");
    if (infoTooltip.classList.contains("is-visible")) {
      const close = (e2) => {
        if (e2.target !== infoBtn && !infoTooltip.contains(e2.target)) {
          infoTooltip.classList.remove("is-visible");
          document.removeEventListener("click", close);
          document.removeEventListener("touchstart", close);
        }
      };
      setTimeout(() => {
        document.addEventListener("click", close);
        document.addEventListener("touchstart", close);
      }, 0);
    }
  });

  const removeLabel = ui.momentRemoveLabel || "Remove";
  const removeAria = ui.momentRemoveAria || "Remove this moment from your view";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "moment-remove-btn text-button moment-control-symbol";
  removeBtn.setAttribute("aria-label", removeAria);
  removeBtn.textContent = "\u00D7";
  const removeTooltip = document.createElement("span");
  removeTooltip.className = "moment-control-tooltip";
  removeTooltip.setAttribute("role", "tooltip");
  removeTooltip.textContent = removeLabel;
  const removeWrap = document.createElement("span");
  removeWrap.className = "moment-control-wrap";
  removeWrap.appendChild(removeBtn);
  removeWrap.appendChild(removeTooltip);
  removeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const hiddenLabel = (m.note || "").trim().slice(0, 80);
    addHiddenMomentId(momentId, hiddenLabel);
    const localMoments = loadMoments();
    if (momentId && localMoments.some((mom) => mom.id === momentId)) {
      saveMoments(localMoments.filter((mom) => mom.id !== momentId));
    }
    if (observatoryState?.sharedMoments) refreshObservatoryLists(observatoryState.sharedMoments);
  });

  const reportHref = (() => {
    const subject = LANG === "es"
      ? "[SlipUp Observatory] Denuncia de momento"
      : "[SlipUp Observatory] Report moment";
    const bodyLines = [
      LANG === "es" ? "Identificador del momento:" : "Moment identifier:",
      momentId,
      "",
      LANG === "es" ? "Motivo (opcional):" : "Reason (optional):",
      "",
    ];
    const body = bodyLines.join("\n");
    return (
      "mailto:slip@slipup.io?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(body)
    );
  })();
  const reportLabel = ui.momentReportLabel || "Report";
  const reportAria = ui.momentReportAria || "Report this moment to moderators";
  const reportLink = document.createElement("a");
  reportLink.href = reportHref;
  reportLink.className = "moment-report-btn text-button moment-control-symbol";
  reportLink.setAttribute("aria-label", reportAria);
  reportLink.rel = "noopener noreferrer";
  reportLink.textContent = "\u0021";
  const reportTooltip = document.createElement("span");
  reportTooltip.className = "moment-control-tooltip";
  reportTooltip.setAttribute("role", "tooltip");
  reportTooltip.textContent = reportLabel;
  const reportWrap = document.createElement("span");
  reportWrap.className = "moment-control-wrap";
  reportWrap.appendChild(reportLink);
  reportWrap.appendChild(reportTooltip);
  reportLink.addEventListener("click", (e) => {
    e.preventDefault();
    const hiddenLabel = (m.note || "").trim().slice(0, 80);
    addHiddenMomentId(momentId, hiddenLabel);
    if (observatoryState?.sharedMoments) {
      refreshObservatoryLists(observatoryState.sharedMoments);
    }
    window.location.href = reportHref;
  });

  const wrap = document.createElement("div");
  wrap.className = "moment-relate-controls";
  wrap.appendChild(relateBtn);
  wrap.appendChild(resonanceFeedbackEl);
  wrap.appendChild(infoBtn);
  wrap.appendChild(infoTooltip);
  if (isOwnMoment) wrap.appendChild(removeWrap);
  wrap.appendChild(reportWrap);

  const constellation = options.constellation;
  if (constellation && constellation.related && constellation.related.length > 0) {
    const wrapConst = document.createElement("div");
    wrapConst.className = "moment-constellation-wrap";
    const line = document.createElement("p");
    line.className = "moment-constellation-line";
    line.textContent = ui.momentConstellationLine || "This moment is part of a constellation.";
    wrapConst.appendChild(line);
    const maxRelated = 4;
    const related = constellation.related.slice(0, maxRelated);
    const ul = document.createElement("ul");
    ul.className = "moment-constellation-related";
    ul.setAttribute("aria-label", ui.momentConstellationRelatedLabel || "Connected moments");
    related.forEach((other) => {
      const liItem = document.createElement("li");
      const otherNote = (other.note || "").trim() || "(no note)";
      liItem.textContent = otherNote === "(no note)" ? otherNote : capitalizeNoteForDisplay(otherNote);
      ul.appendChild(liItem);
    });
    wrapConst.appendChild(ul);
    li.appendChild(wrapConst);
  }

  li.appendChild(wrap);
  return li;
}

function renderMomentItems(targetElement, items, constellations) {
  targetElement.innerHTML = "";
  const byId = constellations?.byMomentId || {};
  items.forEach((m) => {
    const constellation = byId[getMomentStableId(m)];
    targetElement.appendChild(createMomentItemElement(m, { constellation }));
  });
}

function renderRecent(sharedMoments, constellations) {
  recentMoments.innerHTML = "";
  const list = sharedMoments.slice(0, RENDER_LIMIT);

  if (list.length === 0) {
    const ui = UI_COPY[LANG] || UI_COPY.en;
    const line1 = document.createElement("li");
    line1.className = "moment-item moment-item-empty-line";
    line1.textContent = ui.emptyStateQuiet || "The atmosphere is quiet.";
    const line2 = document.createElement("li");
    line2.className = "moment-item moment-item-empty-line";
    line2.textContent = ui.emptyStateSignal || "What settles here becomes signal.";
    const line3 = document.createElement("li");
    line3.className = "moment-item moment-item-empty-line moment-item-empty-subtle";
    line3.textContent = ui.sheetEmpty || "No shared moments yet.";
    recentMoments.appendChild(line1);
    recentMoments.appendChild(line2);
    recentMoments.appendChild(line3);
    return;
  }

  renderMomentItems(recentMoments, list, constellations);
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
  sharedSheetConstellations = null;
  sharedSheetVisibleCount = 0;
}

function appendNextPageSharedSheet() {
  if (sharedSheetVisibleCount >= sharedSheetFullList.length || !sharedSheetSentinel) return;
  const nextEnd = Math.min(sharedSheetVisibleCount + SHARED_SHEET_PAGE_SIZE, sharedSheetFullList.length);
  const chunk = sharedSheetFullList.slice(sharedSheetVisibleCount, nextEnd);
  const byId = sharedSheetConstellations?.byMomentId || {};
  chunk.forEach((m) => {
    const constellation = byId[getMomentStableId(m)];
    sharedSheetList.insertBefore(createMomentItemElement(m, { constellation }), sharedSheetSentinel);
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
    const constellations = getConstellations(list);
    renderMomentItems(sharedSheetList, list, constellations);
    return;
  }

  sharedSheetFullList = list;
  sharedSheetConstellations = getConstellations(list);
  sharedSheetVisibleCount = Math.min(SHARED_SHEET_PAGE_SIZE, list.length);
  const firstChunk = list.slice(0, sharedSheetVisibleCount);
  renderMomentItems(sharedSheetList, firstChunk, sharedSheetConstellations);

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

/**
 * Abre el panel de momentos (shared-sheet). Reutilizado para "Shared moments" (recent) y "Moments nearby".
 * @param {Array} sharedMoments - Lista de momentos a mostrar
 * @param {Object} [options] - { title, countLabel, emptyMessage, useRemote }
 *   - useRemote: true = fetch remoto y actualizar estado (recent); false = solo mostrar la lista (nearby)
 */
async function openSharedSheet(sharedMoments, options = {}) {
  if (isSharedSheetOpen) return;
  isSharedSheetOpen = true;
  lastFocusedEl = document.activeElement;

  const ui = UI_COPY[LANG] || UI_COPY.en;
  const sheetTitleEl = document.getElementById("shared-sheet-title");
  if (sheetTitleEl) {
    sheetTitleEl.textContent = options.title ?? ui.sheetTitle ?? "Shared moments";
  }
  if (sharedSheetEmpty) {
    sharedSheetEmpty.textContent = options.emptyMessage ?? ui.sheetEmpty ?? "No shared moments yet.";
  }

  sharedSheet.hidden = false;
  sheetBackdrop.hidden = false;
  document.body.classList.add("sheet-open");
  document.addEventListener("keydown", onSharedSheetKeydown);

  const useRemote = options.useRemote !== false;
  if (useRemote) {
    renderSharedSheetList([], ui.loading || "Loading…");
  }
  requestAnimationFrame(() => {
    sharedSheet.classList.add("is-open");
    sheetBackdrop.classList.add("is-open");
    sharedSheetCloseButton.focus();
  });

  let listToShow = Array.isArray(sharedMoments) ? sharedMoments : [];

  if (useRemote) {
    try {
      const fresh = await fetchSharedMomentsRemote(SHARED_SHEET_MAX_ITEMS, 48, { skipCache: true });
      listToShow = fresh.filter((m) => m.shared && !m.hidden);
    } catch {
      listToShow = Array.isArray(sharedMoments) ? sharedMoments : [];
    }

    if (observatoryState) {
      observatoryState.sharedMoments = listToShow;
      refreshObservatoryLists(listToShow);
    }

    const n = listToShow.length;
    const countLabel = n === 0 ? "" : (typeof ui.sheetCount === "function" ? ui.sheetCount(n) : "Showing recent.");
    renderSharedSheetList(listToShow, countLabel);
  } else {
    const countLabel = listToShow.length === 0 ? "" : (options.countLabel ?? ui.sheetCountNearby ?? "Showing nearby.");
    renderSharedSheetList(listToShow, countLabel);
  }

  sharedSheetCloseButton.focus();
}

/** Franjas horarias (hora UTC 0-23): morning 6-11, afternoon 12-17, evening 18-23 y 0-5. */
function getTimeOfDayBucket(isoTimestamp) {
  const hour = new Date(isoTimestamp).getUTCHours();
  if (hour >= 6 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 17) return "afternoon";
  return "evening";
}

/** Devuelve una línea tipo "Morning: focus. Evening: tired." si hay >= minPerBucket momentos en >= 2 franjas; si no "". */
function getTimeOfDayHint(moments, minPerBucket = 3, lang = "en") {
  if (!ENABLE_TIME_OF_DAY_HINT || !Array.isArray(moments) || moments.length < minPerBucket * 2) return "";
  const buckets = { morning: [], afternoon: [], evening: [] };
  moments.forEach((m) => {
    const bucket = getTimeOfDayBucket(m.timestamp || m.created_at);
    if (buckets[bucket]) buckets[bucket].push(m);
  });
  const counts = { morning: buckets.morning.length, afternoon: buckets.afternoon.length, evening: buckets.evening.length };
  const withEnough = Object.entries(counts).filter(([, n]) => n >= minPerBucket);
  if (withEnough.length < 2) return "";
  const ui = UI_COPY[lang] || UI_COPY.en;
  const labels = { morning: ui.timeOfDayMorningLabel || "Morning", afternoon: ui.timeOfDayAfternoonLabel || "Afternoon", evening: ui.timeOfDayEveningLabel || "Evening" };
  const parts = [];
  withEnough.forEach(([key]) => {
    const arr = buckets[key];
    const moodCounts = { calm: 0, focus: 0, stressed: 0, curious: 0, tired: 0 };
    arr.forEach((m) => { if (moodCounts[m.mood] !== undefined) moodCounts[m.mood] += 1; });
    const dominant = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0][0];
    parts.push(`${labels[key]}: ${dominant}.`);
  });
  return parts.join(" ");
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
    if (horizonTimeOfDayLine) { horizonTimeOfDayLine.textContent = ""; horizonTimeOfDayLine.classList.add("hidden"); }
    return;
  }

  if (total < 4) {
    horizonPrimary.textContent = pickCopy(COPY.horizon.early, seed);
    if (horizonTimeOfDayLine) { horizonTimeOfDayLine.textContent = ""; horizonTimeOfDayLine.classList.add("hidden"); }
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

  const timeOfDayHint = getTimeOfDayHint(sharedMoments, 3, LANG);
  if (horizonTimeOfDayLine) {
    if (timeOfDayHint) {
      horizonTimeOfDayLine.textContent = timeOfDayHint;
      horizonTimeOfDayLine.classList.remove("hidden");
    } else {
      horizonTimeOfDayLine.textContent = "";
      horizonTimeOfDayLine.classList.add("hidden");
    }
  }

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

/** Nearby: máximo intencionado para escala. No aumentar; evita convertir el campo en feed (docs/OBSERVATORY_AT_SCALE_MOMENTS.md). */
const LOCAL_FIELD_MOMENTS_LIMIT = 6;
const NEARBY_VISIBLE_INITIAL = 3;

let nearbyListExpanded = false;

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

/**
 * Busca la primera región con actividad en el orden conceptual del observatorio (no por distancia ni por volumen).
 * Orden: lista de regiones (nearby → regional → wider → continentes → países → global). La "más cercana" es la
 * siguiente en esa lista que tenga ≥1 momento. Sin métricas, sin proximidad geográfica.
 */
function findNearestScopeWithMoments(sharedMoments, currentScope, allScopes) {
  if (!Array.isArray(allScopes) || !currentScope?.geo) return null;
  const currentGeo = String(currentScope.geo).toLowerCase().trim();
  const list = allScopes;
  let currentIndex = -1;
  for (let i = 0; i < list.length; i++) {
    const g = String(list[i]?.geo || "").toLowerCase().trim();
    if (g === currentGeo) {
      currentIndex = i;
      break;
    }
  }
  if (currentIndex < 0) return null;
  for (let i = currentIndex + 1; i < list.length; i++) {
    const scope = list[i];
    if (!scope?.geo) continue;
    const moments = filterMomentsByScope(sharedMoments || [], scope);
    if (moments.length > 0) return { scope, list: moments };
  }
  return null;
}

/** Elige aleatoriamente 1–3 momentos entre los últimos 10 de la región (sin ranking, sin "más recientes"). */
function pickNearbySignals(list) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const pool = list.slice(-10);
  if (pool.length === 0) return [];
  const count = Math.min(1 + Math.floor(Math.random() * 3), pool.length);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/** Crea un ítem mínimo de "señal cercana": solo texto del momento + hora · región. Sin botones, sin type/mood. */
function createNearbySignalElement(m, regionLabel) {
  const li = document.createElement("li");
  li.className = "signal-item";
  const note = m.note ? String(m.note).trim() : "";
  const noteLabel = note ? capitalizeNoteForDisplay(note) : "";
  const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const meta = regionLabel ? `${timeStr} · ${regionLabel}` : timeStr;
  const textSpan = document.createElement("span");
  textSpan.className = "signal-text";
  textSpan.textContent = noteLabel || "—";
  const metaSpan = document.createElement("span");
  metaSpan.className = "signal-meta";
  metaSpan.textContent = meta;
  li.appendChild(textSpan);
  li.appendChild(metaSpan);
  return li;
}

function renderRegionalMomentsList(sharedMoments, fieldScope, allScopes = null) {
  if (!localClimateMoments) return;
  const ui = UI_COPY[LANG] || UI_COPY.en;
  const hasScope = fieldScope?.geo && fieldScope.scope !== "global";
  if (localClimateMomentsLabel) {
    localClimateMomentsLabel.textContent = ui.nearbyMomentsLabel || "Moments";
    localClimateMomentsLabel.classList.toggle("visually-hidden", !hasScope);
  }
  localClimateMoments.classList.toggle("hidden", !hasScope);
  if (!hasScope) {
    localClimateMoments.innerHTML = "";
    return;
  }
  const list = filterMomentsByScope(sharedMoments || [], fieldScope);
  const fullList = list.slice(0, LOCAL_FIELD_MOMENTS_LIMIT);
  const showViewMore = fullList.length > NEARBY_VISIBLE_INITIAL && !nearbyListExpanded;
  const listToShow = showViewMore ? fullList.slice(0, NEARBY_VISIBLE_INITIAL) : fullList;

  localClimateMoments.innerHTML = "";
  localClimateMoments.classList.remove("hidden");
  if (fullList.length === 0) {
    const emptyMsg = ui.localFieldMomentsEmpty || "No shared moments in this scope yet.";
    const quietLine = ui.localFieldEmptyQuiet || "The field is quiet.";
    const examples = Array.isArray(ui.nearbyEmptyExamples) && ui.nearbyEmptyExamples.length > 0
      ? ui.nearbyEmptyExamples
      : ["The field gathers here.", "Signals will rise.", "Reading forms in the scope."];
    const nearest = findNearestScopeWithMoments(sharedMoments, fieldScope, allScopes);

    const msgLi = document.createElement("li");
    msgLi.className = "moment-item moment-item-empty";
    const msgSpan = document.createElement("span");
    msgSpan.className = "empty-message";
    msgSpan.textContent = emptyMsg;
    msgLi.appendChild(msgSpan);
    const quietSpan = document.createElement("span");
    quietSpan.className = "empty-quiet";
    quietSpan.textContent = quietLine;
    msgLi.appendChild(quietSpan);
    const examplesWrap = document.createElement("span");
    examplesWrap.className = "empty-examples";
    examples.slice(0, 3).forEach((phrase) => {
      const line = document.createElement("span");
      line.className = "empty-example-line";
      line.textContent = phrase;
      examplesWrap.appendChild(line);
    });
    msgLi.appendChild(examplesWrap);
    localClimateMoments.appendChild(msgLi);

    if (nearest && nearest.list.length > 0) {
      const signalsTitle = ui.nearbySignalsTitle || "Nearby signals";
      const titleLi = document.createElement("li");
      titleLi.className = "moment-item moment-item-empty moment-item-empty-header nearby-signals-header";
      titleLi.textContent = signalsTitle;
      localClimateMoments.appendChild(titleLi);
      const regionLabel = formatGeoForDisplay(nearest.scope?.geo) || (nearest.scope?.label ?? "");
      const toShow = pickNearbySignals(nearest.list);
      for (const m of toShow) {
        localClimateMoments.appendChild(createNearbySignalElement(m, regionLabel));
      }
    }

    const viewMoreWrapEmpty = document.getElementById("nearbyViewMoreWrap");
    if (viewMoreWrapEmpty) viewMoreWrapEmpty.classList.add("hidden");
    return;
  }
  const constellations = getConstellations(sharedMoments);
  const byId = constellations?.byMomentId || {};
  listToShow.forEach((m) => {
    const constellation = byId[getMomentStableId(m)];
    localClimateMoments.appendChild(createMomentItemElement(m, { inNearbyField: true, constellation }));
  });

  const viewMoreWrap = document.getElementById("nearbyViewMoreWrap");
  if (viewMoreWrap) {
    if (showViewMore) {
      viewMoreWrap.classList.remove("hidden");
      const btn = viewMoreWrap.querySelector(".nearby-view-more-btn");
      if (btn && !btn.dataset.bound) {
        btn.dataset.bound = "1";
        const viewMoreLabel = (UI_COPY[LANG] || UI_COPY.en).nearbyViewMoreLabel || "View more";
        btn.textContent = viewMoreLabel;
        btn.setAttribute("aria-label", viewMoreLabel);
        btn.onclick = () => {
          const ui = UI_COPY[LANG] || UI_COPY.en;
          const nearbyList = observatoryState
            ? filterMomentsByScope(observatoryState.sharedMoments || [], observatoryState.activeFieldScope).slice(0, LOCAL_FIELD_MOMENTS_LIMIT)
            : [];
          openSharedSheet(nearbyList, {
            title: ui.sheetTitleNearby ?? "Moments nearby",
            countLabel: ui.sheetCountNearby ?? "Showing nearby.",
            emptyMessage: ui.localFieldMomentsEmpty ?? "No shared moments in this scope yet.",
            useRemote: false,
          });
        };
      }
    } else {
      viewMoreWrap.classList.add("hidden");
    }
  }
}

function renderLocalClimate(localState, canonicalState, scopeLabel = "Nearby", pipeline = null, fieldScope = null, sharedMoments = null, fieldLensModel = null) {
  const allScopes = fieldLensModel?.byValue ? Array.from(fieldLensModel.byValue.values()) : null;
  renderRegionalMomentsList(sharedMoments || [], fieldScope, allScopes);
  const ui = UI_COPY[LANG] || UI_COPY.en;
  if (localClimateIntro) localClimateIntro.textContent = ui.nearbyIntroLine || "Reading nearby.";

  const pressureMode = localState?.pressureMode || "stabilizing";
  const seed = Math.round((localState?.computedDegree || BASELINE) * 10) + (localState?.total || 0);
  const source = localState?.source;
  let readingLine = "";
  if (source === "global_view" || source === "global_fallback") {
    const arr = ui.nearbyReadingFallback || ["Quiet.", "Light signal."];
    readingLine = pickCopy(arr, seed);
  } else {
    const arr =
      pressureMode === "condensing"
        ? (ui.nearbyReadingCondensing || ["Forming.", "Tightening.", "Rising."])
        : pressureMode === "clearing"
          ? (ui.nearbyReadingClearing || ["Light movement.", "Easing.", "Opening."])
          : (ui.nearbyReadingStable || ["Quiet.", "Steady.", "Holds."]);
    readingLine = pickCopy(arr, seed);
  }
  if (localClimatePrimary) localClimatePrimary.textContent = readingLine;

  /* Hidden panel elements: keep state for default scope / future use */
  const exactDegree = Number(localState?.computedDegree);
  const degreeStr = Number.isFinite(exactDegree) ? exactDegree.toFixed(1) : String(BASELINE);
  const total = Number(localState?.total) || 0;
  const confidenceMode = pipeline?.signalModes?.confidence || classifyConfidence(total);
  if (localClimateDegree) localClimateDegree.textContent = `${degreeStr}° ${scopeLabel.toLowerCase()}`;
  if (localClimateMass) localClimateMass.textContent = `${total} shared · ${confidenceMode}`;
  if (localClimateMetricsLine) {
    localClimateMetricsLine.textContent = "";
    localClimateMetricsLine.removeAttribute("aria-label");
    localClimateMetricsLine.classList.add("hidden");
  }
  if (localClimateEcho) {
    localClimateEcho.textContent = "";
    localClimateEcho.classList.add("hidden");
  }
  if (localClimateSecondary) {
    if (source === "global_view") localClimateSecondary.textContent = "Reading shared moments across the wider field.";
    else if (source === "global_fallback") localClimateSecondary.textContent = pickRegionalLocalCopy("fallback", fieldScope, seed + 3) || pickCopy(COPY.local.fallback, seed);
    else localClimateSecondary.textContent = pickRegionalLocalCopy("regional", fieldScope, seed + 7) || pickCopy(COPY.local.regional, seed);
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
  const STRATA_TENTATIVE_MAX = 99;
  const STRATA_RECURRENCE_MIN = 100;
  const STRATA_STRUCTURAL_MIN = 300;
  const phase = total < STRATA_RECURRENCE_MIN ? "tentative" : total < STRATA_STRUCTURAL_MIN ? "recurrence" : "structural";
  const STRATA_MAX_LINES = 3;

  if (total === 0) {
    return [s.sedimentStillForming || pickCopy(COPY.strataEarly, 0)];
  }

  const counts = { avoidable: 0, fertile: 0, observed: 0 };
  const moods = { calm: 0, focus: 0, stressed: 0, curious: 0, tired: 0 };
  longWindowMoments.forEach((m) => {
    if (counts[m.type] !== undefined) counts[m.type] += 1;
    if (moods[m.mood] !== undefined) moods[m.mood] += 1;
  });

  const lines = [];
  const avoidableRatio = total > 0 ? counts.avoidable / total : 0;
  const fertileRatio = total > 0 ? counts.fertile / total : 0;

  if (phase === "tentative") {
    if (total < 12) {
      lines.push(s.sedimentTentativePatternForming || "A line begins to appear.");
    }
    if (counts.observed >= 3 && moods.stressed >= 2) {
      lines.push(s.sedimentTentativeObservedCalm || "Observed calm appears after stress.");
    }
    if (counts.avoidable >= 3 && moods.stressed >= 2) {
      lines.push(s.sedimentTentativeTensionGathers || "Some tension gathers late.");
    }
    if (counts.fertile >= 3 && moods.tired >= 1 && lines.length < STRATA_MAX_LINES) {
      lines.push(s.sedimentFertileAfterFatigue || "Fertile moments follow fatigue.");
    }
    if (lines.length < 2) {
      lines.push(s.sedimentStillForming || "Your deep record is still forming.");
    }
    if (lines.length < 2) {
      lines.push(s.sedimentFirstLayers || "First layers only.");
    }
  } else if (phase === "recurrence") {
    if (counts.observed >= 4 && moods.stressed >= 3) {
      lines.push(s.sedimentRecurrenceObservedCalm || "Observed calm often follows stress.");
    }
    if (counts.avoidable >= 4 && moods.stressed >= 3) {
      lines.push(s.sedimentRecurrenceAvoidableLate || "Avoidable tension returns late.");
    }
    if (counts.fertile >= 4 && moods.tired >= 2) {
      lines.push(s.sedimentRecurrenceFertileAfterFatigue || "Fertile moments appear after fatigue.");
    }
    if (counts.observed >= 4 && lines.length < STRATA_MAX_LINES) {
      lines.push(s.sedimentObservedStability || "Observed calm appears often under stress.");
    }
    if (counts.avoidable >= 4 && lines.length < STRATA_MAX_LINES) {
      lines.push(s.sedimentAvoidableReturnsLate || "Avoidable tension returns late.");
    }
    if (fertileRatio > 0.3 && lines.length < STRATA_MAX_LINES) {
      lines.push(s.sedimentFertileDominant || "Fertile moments show up in the mix.");
    }
    if (lines.length < STRATA_MAX_LINES && lines.length >= 1 && counts.fertile >= 2 && counts.observed >= 2 && s.sedimentCollectiveEcho) {
      lines.push(s.sedimentCollectiveEcho);
    }
    if (lines.length < 2) {
      lines.push(s.sedimentStillForming || "Your deep record is still forming.");
    }
  } else {
    if (counts.observed >= 4 && moods.stressed >= 3) {
      lines.push(s.sedimentMatureObservedCalm || "Observed calm returns after stress.");
    }
    if (counts.avoidable >= 5 && moods.stressed >= 3) {
      lines.push(s.sedimentMatureAvoidableLate || "Avoidable tension gathers late in the day.");
    }
    if (counts.fertile >= 4 && moods.tired >= 2) {
      lines.push(s.sedimentMatureFertileAfterFatigue || "Fertile openings follow fatigue.");
    }
    if (lines.length < STRATA_MAX_LINES && counts.observed >= 4) {
      lines.push(s.sedimentMatureOpeningsAfterDense || "Openings appear after dense periods.");
    }
    if (lines.length < STRATA_MAX_LINES && lines.length >= 1 && counts.fertile >= 2 && counts.observed >= 2 && s.sedimentCollectiveEcho) {
      lines.push(s.sedimentCollectiveEcho);
    }
    if (lines.length < 2) {
      lines.push(s.sedimentStillForming || "Your deep record is still forming.");
    }
  }

  return lines.slice(0, STRATA_MAX_LINES);
}

function renderStrata(moments, canonicalState) {
  const longWindow = getLongWindow(moments, 30);
  const lines = buildStrataLines(longWindow, canonicalState);
  const strataContextEl = document.getElementById("strataContext");
  const ui = UI_COPY[LANG] || UI_COPY.en;
  if (strataContextEl) {
    strataContextEl.textContent = ui.strataContextLine || "Below the surface, your moments settle into deeper record.";
  }
  if (!lines.length) {
    groundStrata.classList.remove("is-active");
    groundStrata.hidden = true;
    strataLines.innerHTML = "";
    const wrap = document.getElementById("strataShareWrap");
    if (wrap) { wrap.classList.add("hidden"); wrap.hidden = true; }
    return;
  }

  strataLines.innerHTML = "";
  lines.forEach((line) => {
    const li = document.createElement("li");
    li.className = "strata-line";
    li.textContent = line;
    strataLines.appendChild(li);
  });

  const strataShareWrap = document.getElementById("strataShareWrap");
  const strataShareBtn = strataShareWrap?.querySelector(".strata-share-btn");
  if (strataShareWrap && strataShareBtn) {
    strataShareWrap.classList.remove("hidden");
    strataShareWrap.hidden = false;
    strataShareBtn.textContent = ui.strataShareLine || "Share this trace";
    const lineToShare = lines[0] || "";
    strataShareBtn.onclick = () => {
      if (!lineToShare) return;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(lineToShare).then(
          () => { strataShareBtn.textContent = (UI_COPY[LANG]?.strataShareCopied) || "Copied"; setTimeout(() => { strataShareBtn.textContent = ui.strataShareLine || "Share this trace"; }, 1200); },
          () => {}
        );
      }
    };
  }

  if (strataMetricsLine) {
    strataMetricsLine.textContent = "";
    strataMetricsLine.classList.add("hidden");
    strataMetricsLine.classList.add("strata-panel-hidden");
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
    setDegreeDisplay(txt);
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      const numPart = (finalTxt.match(/^[\d.]+/) || [])[0];
      if (numPart !== undefined) lastDisplayedDegreeStr = numPart;
      playDegreeSettle();
    }
  }
  requestAnimationFrame(frame);
}

function showTransientReading(total = 0, seed = 0, lang = "en") {
  const phrase = getAtmosphereLine(seed, lang, total);
  transientReadingLine.textContent = phrase;
  transientReadingLine.classList.remove("hidden");
  transientReadingLine.classList.add("is-visible");

  window.setTimeout(() => {
    transientReadingLine.classList.remove("is-visible");
    window.setTimeout(() => {
      transientReadingLine.classList.add("hidden");
      transientReadingLine.textContent = "";
    }, 550);
  }, 2500);
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
  const tagMap = LANG === "es"
    ? {
        pattern_a: ["Tensión repetida en la lectura.", "La lectura sigue—con tensión.", "Tensión en la lectura—mirá qué cambia."],
        pattern_b: ["Estado de ánimo repetido en el campo.", "El campo sostiene un estado—ahora.", "Estado en el campo—seguí leyendo."],
        pattern_c: ["Agrupamiento en la ventana.", "Se agrupa en la ventana—ahora.", "La ventana muestra un grupo—mirá."],
      }
    : {
        pattern_a: ["Repeated strain in the read.", "The read keeps going—with strain.", "Strain in the read—see what shifts."],
        pattern_b: ["Repeated mood in the field.", "The field holds a mood—now.", "Mood in the field—keep reading."],
        pattern_c: ["Clustering in the window.", "Clustering in the window—now.", "The window shows a cluster—see it."],
      };
  const patternFallback = LANG === "es"
    ? ["Patrón en la lectura—sigue.", "Ritmo en la ventana—mirá qué sigue.", "Eco colectivo en la lectura.", "La lectura tiene patrón—ahora.", "El campo hace eco—seguí leyendo."]
    : ["Pattern in the reading—it continues.", "Rhythm in the window—see what's next.", "Collective echo in the read.", "The read has a pattern—now.", "Echo in the field—keep reading."];
  const seed = (total * 7 + (dominant.length || 0)) | 0;
  const moodDisplayHero = LANG === "es" ? { stressed: "Tenso" } : { stressed: "Tense" };
  const patternOpts = repetition?.hasPattern && tagMap[repetition.tag]
    ? tagMap[repetition.tag]
    : patternFallback;
  const line = repetition?.hasPattern
    ? patternOpts[Math.abs(seed) % patternOpts.length]
    : dominant
      ? dominant.split("|").map((s, i) => {
          const t = s.trim().toLowerCase();
          if (i === 1 && moodDisplayHero[t]) return moodDisplayHero[t];
          return capitalizeForDisplay(s.trim());
        }).join(" · ")
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

/** Hero Engine: rotación de las 4 líneas del hero a ritmos distintos (sensación de sistema vivo, invitación a volver). */
const HERO_ENGINE_MS = { line1: 10000, line2: 15000, line3: 20000, line4: 45000 };
let heroEngineIntervals = [];

function clearHeroEngine() {
  heroEngineIntervals.forEach(function (id) { clearInterval(id); });
  heroEngineIntervals.length = 0;
}

function startHeroEngine() {
  clearHeroEngine();
  if (prefersReducedMotion || !observatoryState) return;
  const s = observatoryState;
  if (!climateSummaryLine || !atmosphericWeatherLine || !atmospherePatternLine) return;
  heroEngineIntervals.push(setInterval(function () {
    if (window.atmosphereSignal && window.atmosphereSignal.update && s.sharedMoments) {
      window.atmosphereSignal.update(s.sharedMoments);
    }
  }, HERO_ENGINE_MS.line1));
  heroEngineIntervals.push(setInterval(function () {
    const shared48h = getRecentWindow(s.sharedMoments || []);
    const weather = getAtmosphericWeather(shared48h);
    if (atmosphericWeatherLine && weather && weather.label) {
      atmosphericWeatherLine.textContent = weather.label;
      atmosphericWeatherLine.classList.remove("hidden");
    }
  }, HERO_ENGINE_MS.line2));
  heroEngineIntervals.push(setInterval(function () {
    if (s.canonicalState) renderPatternLayer(s.canonicalState);
  }, HERO_ENGINE_MS.line3));
  heroEngineIntervals.push(setInterval(function () {
    const total = Number(s.canonicalState && s.canonicalState.total) || 0;
    if (total > 0 && climateSummaryLine) {
      const seed = (total * 7 + Math.round(Number(s.canonicalState && s.canonicalState.computedDegree) || 0) + Math.floor(Date.now() / 1000)) | 0;
      climateSummaryLine.textContent = getReadingStatusLine(LANG, total, seed, s.canonicalState && s.canonicalState.dominantMix);
      climateSummaryLine.classList.remove("hidden");
    }
  }, HERO_ENGINE_MS.line4));
}

/** Timeout del eco de Nearby; se cancela si se programa otro antes de que dispare. */
let nearbyEchoTimeoutId = null;
/** Evita superposición si un repaint dispara otro eco antes de que termine el actual. */
let nearbyEchoActive = false;

/** Eco local: pulso sutil en "Signals nearby" y fade breve en la lectura local. Solo presencia, sin efectos fuertes. Respeta prefers-reduced-motion. */
function triggerNearbyEcho() {
  if (typeof window === "undefined" || prefersReducedMotion) return;
  if (nearbyEchoActive) return;
  nearbyEchoActive = true;
  const pulseMs = 560 + Math.random() * 80;
  const introLine = document.getElementById("localClimateIntro");
  if (introLine) {
    introLine.style.setProperty("--echo-pulse-duration", `${pulseMs}ms`);
    introLine.classList.add("echo-pulse", "echo-fade");
    setTimeout(() => {
      introLine.classList.remove("echo-pulse");
      introLine.style.removeProperty("--echo-pulse-duration");
      setTimeout(() => introLine.classList.remove("echo-fade"), 200);
    }, pulseMs);
  }
  setTimeout(() => { nearbyEchoActive = false; }, Math.max(pulseMs, 200));
}

/** Programa el eco de Nearby ~900–1200 ms después (propagación del campo). Se llama tras actualizar hero + renderLocalClimate. */
function scheduleNearbyEcho() {
  if (nearbyEchoTimeoutId != null) clearTimeout(nearbyEchoTimeoutId);
  nearbyEchoTimeoutId = setTimeout(() => {
    nearbyEchoTimeoutId = null;
    triggerNearbyEcho();
  }, 900 + Math.random() * 300);
}

/** Pinta la sección "Hidden from view" con botones "Show again" por cada id oculto. Muestra la frase/nota del momento cuando existe. */
function renderHiddenFromView() {
  if (!hiddenFromViewWrap || !hiddenFromViewList) return;
  const entries = getHiddenMoments();
  const ui = UI_COPY[LANG] || UI_COPY.en;
  if (entries.length === 0) {
    hiddenFromViewWrap.classList.add("hidden");
    hiddenFromViewWrap.hidden = true;
    hiddenFromViewList.innerHTML = "";
    const descElEmpty = document.getElementById("hiddenFromViewDescription");
    if (descElEmpty) descElEmpty.hidden = true;
    return;
  }
  hiddenFromViewWrap.classList.remove("hidden");
  hiddenFromViewWrap.hidden = false;
  const titleEl = hiddenFromViewWrap.querySelector(".hidden-from-view-title");
  if (titleEl) titleEl.textContent = ui.hiddenFromViewTitle || "Hidden from view";
  const descEl = document.getElementById("hiddenFromViewDescription");
  if (descEl) {
    descEl.textContent = ui.hiddenFromViewDescription || "Moments you hid from this view. You can show them again below.";
    descEl.hidden = false;
  }
  hiddenFromViewList.innerHTML = "";
  const showAgain = ui.showAgainLabel || "Show again";
  const momentLabel = LANG === "es" ? "Momento" : "Moment";
  entries.forEach((entry, index) => {
    const li = document.createElement("li");
    li.className = "hidden-from-view-item";
    const label = document.createElement("span");
    label.className = "hidden-from-view-item-label";
    label.textContent = entry.label || `${momentLabel} ${index + 1}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "text-button hidden-from-view-show-again";
    btn.textContent = showAgain;
    btn.setAttribute("aria-label", (LANG === "es" ? "Mostrar de nuevo este momento" : "Show this moment again"));
    btn.addEventListener("click", () => {
      removeHiddenMomentId(entry.id);
      if (observatoryState?.sharedMoments) refreshObservatoryLists(observatoryState.sharedMoments);
      renderHiddenFromView();
    });
    li.appendChild(label);
    li.appendChild(btn);
    hiddenFromViewList.appendChild(li);
  });
}

/** Actualiza solo las listas de momentos (recent + nearby) con el array indicado. Oculta los momentos marcados como "quitar de mi vista". */
function refreshObservatoryLists(sharedMoments) {
  if (!observatoryState || !Array.isArray(sharedMoments)) return;
  const filtered = filterHiddenMoments(sharedMoments);
  const constellations = getConstellations(filtered);
  renderRecent(filtered, constellations);
  renderLocalClimate(
    observatoryState.localClimateTruth,
    observatoryState.canonicalState,
    observatoryState.activeFieldScope?.label || "Nearby",
    observatoryState.observatoryPipeline,
    observatoryState.activeFieldScope,
    filtered,
    observatoryState.fieldLensModel
  );
  renderHiddenFromView();
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
      condition: localClimate.condition ?? conditionForDegree(localClimate.computedDegree, localClimate.total),
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

let climateDebugPanelEl = null;

function ensureClimateDebugPanel() {
  if (climateDebugPanelEl && document.body.contains(climateDebugPanelEl)) return;
  climateDebugPanelEl = document.createElement("div");
  climateDebugPanelEl.id = "climate-debug-panel";
  climateDebugPanelEl.setAttribute("aria-label", "Climate engine debug (v1 signals)");
  climateDebugPanelEl.className = "climate-debug-panel";
  document.body.appendChild(climateDebugPanelEl);
}

function updateClimateDebugPanel(canonicalState) {
  if (!climateDebugPanelEl || !canonicalState) return;
  const fmt = (n) => (n != null && Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "—");
  const activity = canonicalState.activity != null ? fmt(canonicalState.activity) : "—";
  const spread = canonicalState.spread != null ? fmt(canonicalState.spread) : "—";
  const persistence = canonicalState.persistence != null ? fmt(canonicalState.persistence) : "—";
  const mass = canonicalState.total != null ? String(canonicalState.total) : "—";
  const degree = canonicalState.computedDegree != null ? fmt(canonicalState.computedDegree) : "—";
  const condition = canonicalState.condition || "—";
  climateDebugPanelEl.innerHTML = `
    <div class="climate-debug-panel-title">Climate (debug)</div>
    <div class="climate-debug-panel-row"><span>Activity</span><span>${activity}</span></div>
    <div class="climate-debug-panel-row"><span>Spread</span><span>${spread}</span></div>
    <div class="climate-debug-panel-row"><span>Persistence</span><span>${persistence}</span></div>
    <div class="climate-debug-panel-row"><span>Mass 48h</span><span>${mass}</span></div>
    <div class="climate-debug-panel-row"><span>ComputedDegree</span><span>${degree}</span></div>
    <div class="climate-debug-panel-row"><span>Condition</span><span>${condition}</span></div>
  `;
}

function initOrbitalLayer() {
  const orbitalSection = document.getElementById("orbital");
  const transitionLine = document.getElementById("orbitalTransitionLine");
  if (!orbitalSection || !transitionLine) return;
  const ui = UI_COPY[LANG] || UI_COPY.en;
  const label = ui.orbitalTransitionLine || "Entering orbital view";
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          transitionLine.textContent = label;
          transitionLine.classList.remove("hidden");
          orbitalSection.classList.add("is-in-view");
        } else {
          orbitalSection.classList.remove("is-in-view");
        }
      });
    },
    { threshold: 0.2, rootMargin: "0px" }
  );
  observer.observe(orbitalSection);
}

async function boot() {
  applyUICopy();

  const hash = (window.location.hash || "").trim();
  const hero = document.getElementById("observatory-hero");
  if (hero && (!hash || hash === "#top")) {
    requestAnimationFrame(() => hero.scrollIntoView({ behavior: "auto", block: "start" }));
  }

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
    setDegreeDisplay(d);
    document.body.style.setProperty("--atmo", String(optimisticStartDisplay));
  } else {
    // First load with no stored state: avoid flashing a temporary fixed number.
    setDegreeDisplay(String(BASELINE) + "°");
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
    recentContext.textContent = "";
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
        sharedMoments,
        fieldLensModel
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
    const transientSeed = query.get("s") !== null ? (parseInt(query.get("s"), 10) || 0) : (Date.now() + (canonicalState?.total ?? 0) * 7) | 0;
    showTransientReading(canonicalState?.total ?? 0, transientSeed, LANG);
    if (heroEl) {
      heroEl.classList.add("observatory-hero-ritual");
      try { window.atmosphere?.bump?.(); } catch (_) {}
      setTimeout(() => heroEl.classList.remove("observatory-hero-ritual"), 2200);
    }
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
    // Hero: solo lectura (grado), sin telemetría visible. Métricas solo en panel "i" (instrumentInfoTechnical).
    climateMetricsLine.textContent = "";
    climateMetricsLine.classList.add("hidden");
    if (observatoryScopeRange) {
      observatoryScopeRange.textContent = "";
      observatoryScopeRange.classList.add("hidden");
    }
    if (parts.length > 0 && instrumentInfoTechnical) {
        if (climateInstrument) climateInstrument.classList.remove("hidden");
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
      climateSummaryLine.textContent = getReadingStatusLine(LANG, total, seed, canonicalState?.dominantMix);
      climateSummaryLine.classList.remove("hidden");
    } else {
      climateSummaryLine.textContent = "";
      climateSummaryLine.classList.add("hidden");
    }
  }

  const shared48h = getRecentWindow(sharedMoments || []);
  const weather = getAtmosphericWeather(shared48h);
  const uiForWeather = UI_COPY[LANG] || UI_COPY.en;
  if (atmosphericWeatherLine) {
    if (weather?.label) {
      atmosphericWeatherLine.textContent = weather.label;
      atmosphericWeatherLine.classList.remove("hidden");
    } else {
      atmosphericWeatherLine.textContent = "";
      atmosphericWeatherLine.classList.add("hidden");
    }
  }
  if (atmosphericWeatherCaption) {
    if (weather?.label) {
      atmosphericWeatherCaption.textContent = uiForWeather.atmosphericWeatherCaption || (LANG === "es" ? "La atmósfera refleja las últimas 48 horas de momentos." : "The atmosphere reflects the last 48 hours of moments.");
      atmosphericWeatherCaption.classList.remove("hidden");
    } else {
      atmosphericWeatherCaption.textContent = "";
      atmosphericWeatherCaption.classList.add("hidden");
    }
  }

  if (typeof window.atmosphereSignal !== "undefined" && window.atmosphereSignal.update) {
    try {
      window.__slipupMomentsCache = sharedMoments;
      /* Tras contribuir: horizonte reacciona en 2–4 s (condensación → señal). */
      const opts = contributed ? { pulseDelay: 2000 + Math.random() * 2000 } : {};
      window.atmosphereSignal.update(sharedMoments, opts);
    } catch (_) {}
  }

  const totalForWarmup = canonicalState.total || 0;
  if (warmupHint) {
    warmupHint.textContent = "";
    warmupHint.classList.add("hidden");
  }
  renderFutureConfidenceLine(canonicalState, observatoryPipeline);
  renderPatternLayer(canonicalState);
  const sharedFiltered = filterHiddenMoments(sharedMoments);
  const constellations = getConstellations(sharedFiltered);
  renderRecent(sharedFiltered, constellations);
  renderHorizon(canonicalState, sharedMoments, observatoryPipeline);
  renderLocalClimate(
    localClimateTruth,
    canonicalState,
    activeFieldScope.label || "Nearby",
    observatoryPipeline,
    activeFieldScope,
    sharedFiltered,
    fieldLensModel
  );
  scheduleNearbyEcho();
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
    fieldLensModel,
  };
  startHeroEngine();

  const level = (canonicalState?.computedDegree ?? 0) / 100;
  const isFieldQuiet = level < 0.18;
  if (prefersReducedMotion) {
    document.documentElement.removeAttribute("data-field-quiet");
    if (degreeValue) degreeValue.style.removeProperty("--degree-presence");
  } else {
    if (isFieldQuiet) document.documentElement.setAttribute("data-field-quiet", "true");
    else document.documentElement.removeAttribute("data-field-quiet");
    const presence = 0.94 + 0.06 * Math.min(1, Math.max(0, level));
    if (degreeValue) degreeValue.style.setProperty("--degree-presence", String(presence));
  }

  if (typeof window !== "undefined" && /[?&]debug=1/.test(window.location.search)) {
    ensureClimateDebugPanel();
    updateClimateDebugPanel(observatoryState.canonicalState);
  }

  renderHiddenFromView();
  initOrbitalLayer();

  viewMoreButton.onclick = () => openSharedSheet(filterHiddenMoments(observatoryState?.sharedMoments ?? []));

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
  const instrumentInfoPopoverEl = document.getElementById("instrumentInfoPopover");
  if (instrumentInfoBtn && instrumentInfoTextEl) {
    instrumentInfoBtn.addEventListener("click", () => {
      instrumentInfoTextEl.classList.toggle("hidden");
      if (instrumentInfoTechnicalEl) instrumentInfoTechnicalEl.classList.toggle("hidden");
      const isOpen = !instrumentInfoTextEl.classList.contains("hidden");
      instrumentInfoBtn.setAttribute("aria-expanded", String(isOpen));
      if (instrumentInfoPopoverEl) {
        instrumentInfoPopoverEl.classList.toggle("is-open", isOpen);
        instrumentInfoPopoverEl.setAttribute("aria-hidden", String(!isOpen));
      }
    });
  }

  reportObservatoryEvent("observatory_view");

  if (fieldScopeSelect) {
    let requestToken = 0;
    fieldScopeSelect.onchange = async () => {
      nearbyListExpanded = false;
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
          sharedMoments,
          fieldLensModel
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

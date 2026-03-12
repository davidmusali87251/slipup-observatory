/**
 * SlipUp Observatory — Copyright © 2026 Selim D. Musali
 */
import { postMomentRemote, fetchClimateRemote, isRemoteReady } from "./remote.js";
import { getNoteSignalBreakdown } from "./modelConstants.js";

const STORAGE_KEY = "slipup_v2_moments";

const form = document.getElementById("contributeForm");
const typeInput = document.getElementById("typeInput");
const moodInput = document.getElementById("moodInput");
const noteInput = document.getElementById("noteInput");
const sharedInput = document.getElementById("sharedInput");
const consentInput = document.getElementById("consentInput");
const saveButton = document.getElementById("saveButton");
const formStatus = document.getElementById("formStatus");
const noteAnalysisLine = document.getElementById("noteAnalysisLine");
const ALLOWED_MOODS = new Set(["calm", "focus", "stressed", "curious", "tired"]);

/** Short, everyday examples for Rise placeholder (all ≤19 chars). Rotates on load to model naming, not explaining. */
const RISE_EXAMPLES = [
  "Going to the gym",
  "Late for the bus",
  "Work all the day",
  "Missed the call",
  "Too much coffee",
  "Thinking again",
  "Rain on the way",
  "Running late",
  "Need fresh air",
  "Another try",
  "Pause before reply",
  "Traffic again",
  "Early morning",
  "Long day done",
  "One step back",
];

/** Optional hook for metrics: if window.__observatoryReportEvent is set, events are reported (e.g. for funnel % visitas → Contribute). No payload; no built-in analytics. */
function reportObservatoryEvent(eventName) {
  try {
    if (typeof window !== "undefined" && typeof window.__observatoryReportEvent === "function") {
      window.__observatoryReportEvent(eventName);
    }
  } catch (_) {}
}

/** When remote is ready, sets "X moments across the atmosphere." from climate total; else uses data-fallback. */
async function setMomentCountLine() {
  const el = document.getElementById("contributeMomentCountLine");
  if (!el) return;
  const fallback = el.getAttribute("data-fallback") || "Moments rising across the atmosphere.";
  if (!isRemoteReady()) {
    el.textContent = fallback;
    el.setAttribute("aria-hidden", "true");
    return;
  }
  try {
    const climate = await fetchClimateRemote(48);
    const total = climate?.total;
    if (Number.isFinite(total) && total > 0) {
      el.textContent = `${Number(total).toLocaleString()} moments across the atmosphere.`;
      el.removeAttribute("aria-hidden");
    } else {
      el.textContent = fallback;
      el.setAttribute("aria-hidden", "true");
    }
  } catch {
    el.textContent = fallback;
    el.setAttribute("aria-hidden", "true");
  }
}

function setRisePlaceholder() {
  if (!noteInput) return;
  const example = RISE_EXAMPLES[Math.floor(Math.random() * RISE_EXAMPLES.length)];
  noteInput.placeholder = example;
}

/** Picks 4 random examples for "Moments rise like" block above Rise; changes each load so it feels alive. Renders each as a separate line (observatory-style: señales en el aire). */
function setRiseExamplesLive() {
  const el = document.getElementById("contributeRiseExamplesLive");
  if (!el || RISE_EXAMPLES.length < 3) return;
  const shuffled = [...RISE_EXAMPLES].sort(() => Math.random() - 0.5);
  const four = shuffled.slice(0, 4);
  el.innerHTML = "";
  four.forEach((phrase) => {
    const line = document.createElement("span");
    line.className = "contribute-rise-example-line";
    line.textContent = phrase;
    el.appendChild(line);
  });
}

function updateNoteAnalysisLine() {
  if (!noteAnalysisLine) return;
  const raw = noteInput?.value?.trim() ?? "";
  if (!raw) {
    noteAnalysisLine.textContent = "";
    noteAnalysisLine.hidden = true;
    return;
  }
  const b = getNoteSignalBreakdown(raw);
  const parts = [];
  if (b.matchedReflective.length) parts.push(`Reflective: ${b.matchedReflective.join(", ")}`);
  if (b.matchedReactive.length) parts.push(`Reactive: ${b.matchedReactive.join(", ")}`);
  if (b.unmatchedWords.length) parts.push(`Not in lists: ${b.unmatchedWords.join(", ")}`);
  noteAnalysisLine.textContent = parts.length
    ? parts.join(" · ")
    : "Only type and mood shape the reading.";
  noteAnalysisLine.hidden = false;
}

function loadMoments() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveMoments(moments) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(moments));
}

function todayClientDay() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

function makeMoment() {
  const note = noteInput.value.replace(/\s+/g, " ").trim().slice(0, 19);
  const mood = ALLOWED_MOODS.has(moodInput.value) ? moodInput.value : "calm";
  return {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    client_day: todayClientDay(),
    type: typeInput.value,
    mood,
    note,
    timestamp: new Date().toISOString(),
    shared: sharedInput.checked,
    hidden: false,
  };
}

function makeRemoteMomentPayload() {
  return {
    type: typeInput.value,
    mood: ALLOWED_MOODS.has(moodInput.value) ? moodInput.value : "calm",
    note: noteInput.value,
    shared: sharedInput.checked,
    timestamp: new Date().toISOString(),
    client_day: todayClientDay(),
  };
}

function hasValidNote() {
  return noteInput.value.replace(/\s+/g, " ").trim().length > 0;
}

function syncSaveState() {
  const consentOk = Boolean(consentInput?.checked);
  saveButton.disabled = !hasValidNote() || !consentOk;
}

noteInput.addEventListener("input", () => {
  if (formStatus.textContent === "Complete this field before saving.") {
    formStatus.textContent = "";
  }
  syncSaveState();
  updateNoteAnalysisLine();
});

consentInput?.addEventListener("change", () => {
  if (formStatus.textContent === "Please accept Privacy and Terms to save this moment.") {
    formStatus.textContent = "";
  }
  syncSaveState();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formStatus.textContent = "";

  if (!typeInput.value || !moodInput.value) {
    formStatus.textContent = "Type and mood are required.";
    return;
  }
  if (!ALLOWED_MOODS.has(moodInput.value)) {
    formStatus.textContent = "Choose a mood.";
    return;
  }
  if (!hasValidNote()) {
    formStatus.textContent = "Complete this field before saving.";
    syncSaveState();
    noteInput.focus();
    return;
  }
  if (consentInput && !consentInput.checked) {
    formStatus.textContent = "Please accept Privacy and Terms to save this moment.";
    consentInput.focus();
    return;
  }

  const localMoment = makeMoment();
  const moments = loadMoments();
  moments.push(localMoment);
  saveMoments(moments);

  /** Ritual confirmation: jerarquía poética — "A trace has settled" y "The reading has shifted" más frecuentes; "Registered…" menos (más técnico). */
  const ritualPhrases = {
    en: [
      { t: "A trace has settled.", w: 5 },
      { t: "The reading has shifted.", w: 3 },
      { t: "Registered in the atmosphere.", w: 1 },
    ],
    es: [
      { t: "Una traza se ha asentado.", w: 5 },
      { t: "La lectura se ha movido.", w: 3 },
      { t: "Registrado en la atmósfera.", w: 1 },
    ],
  };
  const lang = (document.documentElement.getAttribute("lang") || "en").startsWith("es") ? "es" : "en";
  const pool = ritualPhrases[lang];
  const totalW = pool.reduce((s, p) => s + p.w, 0);
  const pickRitual = () => {
    let r = Math.random() * totalW;
    for (const p of pool) {
      r -= p.w;
      if (r <= 0) return p.t;
    }
    return pool[0].t;
  };

  if (!sharedInput.checked) {
    formStatus.textContent = "The reading adjusts.";
  } else {
    const remoteResult = await postMomentRemote(makeRemoteMomentPayload());
    if (remoteResult.ok) {
      formStatus.textContent = pickRitual();
      document.body.classList.add("contribute-ritual");
      setTimeout(() => document.body.classList.remove("contribute-ritual"), 1600);
    } else if (remoteResult.status === 422) {
      formStatus.textContent = "Saved locally. Shared sync couldn't accept this moment.";
    } else if (remoteResult.status === 429) {
      formStatus.textContent = "Saved locally. Shared channel is temporarily busy.";
    } else {
      formStatus.textContent = "Saved locally. Shared sync is unavailable.";
    }
  }

  reportObservatoryEvent("contribute_done");

  const seedParam = sharedInput.checked ? "&s=" + simpleHash(localMoment.id) : "";
  const redirectDelay = sharedInput.checked ? 2200 : 1400;
  setTimeout(() => {
    window.location.href = sharedInput.checked ? "./index.html?contributed=1" + seedParam : "./index.html";
  }, redirectDelay);
});

syncSaveState();
updateNoteAnalysisLine();
setRisePlaceholder();
setRiseExamplesLive();
reportObservatoryEvent("contribute_view");
setMomentCountLine();

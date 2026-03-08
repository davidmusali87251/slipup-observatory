import { postMomentRemote } from "./remote.js";
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

function setRisePlaceholder() {
  if (!noteInput) return;
  const example = RISE_EXAMPLES[Math.floor(Math.random() * RISE_EXAMPLES.length)];
  noteInput.placeholder = example;
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

  if (!sharedInput.checked) {
    formStatus.textContent = "The reading adjusts.";
  } else {
    const remoteResult = await postMomentRemote(makeRemoteMomentPayload());
    if (remoteResult.ok) {
      formStatus.textContent = "The reading adjusts.";
    } else if (remoteResult.status === 422) {
      formStatus.textContent = "Saved locally. Shared sync couldn't accept this moment.";
    } else if (remoteResult.status === 429) {
      formStatus.textContent = "Saved locally. Shared channel is temporarily busy.";
    } else {
      formStatus.textContent = "Saved locally. Shared sync is unavailable.";
    }
  }

  setTimeout(() => {
    window.location.href = sharedInput.checked ? "./index.html?contributed=1" : "./index.html";
  }, 1400);
});

syncSaveState();
updateNoteAnalysisLine();
setRisePlaceholder();

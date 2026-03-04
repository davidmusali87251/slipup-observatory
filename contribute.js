import { postMomentRemote } from "./remote.js";

const STORAGE_KEY = "slipup_v2_moments";

const form = document.getElementById("contributeForm");
const typeInput = document.getElementById("typeInput");
const moodInput = document.getElementById("moodInput");
const noteInput = document.getElementById("noteInput");
const sharedInput = document.getElementById("sharedInput");
const saveButton = document.getElementById("saveButton");
const formStatus = document.getElementById("formStatus");
const ALLOWED_MOODS = new Set(["calm", "focus", "stressed", "curious", "tired"]);

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
  saveButton.disabled = !hasValidNote();
}

noteInput.addEventListener("input", () => {
  if (formStatus.textContent === "Let one intention rise before saving.") {
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
    formStatus.textContent = "Let one intention rise before saving.";
    syncSaveState();
    noteInput.focus();
    return;
  }

  const localMoment = makeMoment();
  const moments = loadMoments();
  moments.push(localMoment);
  saveMoments(moments);

  if (!sharedInput.checked) {
    formStatus.textContent = "Moment stored locally.";
  } else {
    const remoteResult = await postMomentRemote(makeRemoteMomentPayload());
    if (remoteResult.ok) {
      formStatus.textContent = "Moment stored.";
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
  }, 220);
});

syncSaveState();

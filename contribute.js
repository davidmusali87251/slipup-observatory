/**
 * SlipUp™ Observatory
 */
import { postMomentRemote, fetchClimateRemote, isRemoteReady } from "./remote.js";
import { getNoteSignalBreakdown } from "./modelConstants.js";
import { isNoteBlocked } from "./noteContentPolicy.js";

const STORAGE_KEY = "slipup_v2_moments";

const form = document.getElementById("contributeForm");
const toneWrap = form?.querySelector(".contribute-rise-tone");
const kindStatesEl = form?.querySelector(".contribute-kind-states");
const moodInput = document.getElementById("moodInput");
const noteInput = document.getElementById("noteInput");
const sharedInput = document.getElementById("sharedInput");
const consentInput = document.getElementById("consentInput");
const saveButton = document.getElementById("saveButton");
const formStatus = document.getElementById("formStatus");
const noteAnalysisLine = document.getElementById("noteAnalysisLine");
const notePolicyHint = document.getElementById("notePolicyHint");
const ALLOWED_MOODS = new Set(["calm", "focus", "stressed", "curious", "tired"]);
const ALLOWED_TYPES = new Set(["fertile", "avoidable", "observed"]);

/** Mensajes fijos de validación (para limpiar al editar sin depender de truncado). */
const MSG_COMPLETE_FIELD = "Complete this field before saving.";
const MSG_ACCEPT_TERMS = "Please accept Privacy and Terms to save this moment.";

/** Máximo de caracteres visibles en #formStatus (evita párrafos largos si el servidor devuelve texto). */
const FORM_STATUS_MAX_CHARS = 120;

/**
 * @param {string} [msg]
 * @param {number} [maxChars]
 */
function setFormStatus(msg, maxChars = FORM_STATUS_MAX_CHARS) {
  if (!formStatus) return;
  const raw = String(msg ?? "");
  if (raw === "") {
    formStatus.textContent = "";
    formStatus.removeAttribute("title");
    return;
  }
  const t = raw.trim();
  if (t.length > maxChars) {
    formStatus.textContent = `${t.slice(0, Math.max(0, maxChars - 1))}\u2026`;
    formStatus.title = t;
  } else {
    formStatus.textContent = t;
    formStatus.removeAttribute("title");
  }
}

let typeTouched = false;
let kindSuggestTimer = null;

function getContributeLang() {
  return (document.documentElement.getAttribute("lang") || "en").startsWith("es") ? "es" : "en";
}

/** Deshabilita Place / muestra aviso si la nota coincide con la lista bloqueada (cliente). */
function updateNotePolicyUI() {
  const blocked = isNoteBlocked(noteInput?.value ?? "");
  if (noteInput) {
    noteInput.setAttribute("aria-invalid", blocked ? "true" : "false");
    noteInput.classList.toggle("contribute-note--blocked", blocked);
  }
  if (notePolicyHint) {
    if (blocked) {
      const lang = getContributeLang();
      notePolicyHint.textContent =
        lang === "es"
          ? "Esa frase no está permitida aquí. Cambiala para guardar."
          : "That wording isn’t allowed here. Change it to save.";
      notePolicyHint.hidden = false;
    } else {
      notePolicyHint.textContent = "";
      notePolicyHint.hidden = true;
    }
  }
}

function getSelectedType() {
  const el = form?.querySelector('input[name="type"]:checked');
  const v = el?.value;
  return v && ALLOWED_TYPES.has(v) ? v : "observed";
}

function setKindPreview(kind) {
  if (!form) return;
  if (kind && ALLOWED_TYPES.has(kind)) form.dataset.kindPreview = kind;
  else form.removeAttribute("data-kind-preview");
}

const NOTE_MAX_LEN = 19;

/** Asegura límite 19 (algunos móviles/IME ignoran maxlength hasta commit). */
function clampNoteLength() {
  if (!noteInput) return;
  const v = noteInput.value;
  if (v.length > NOTE_MAX_LEN) {
    noteInput.value = v.slice(0, NOTE_MAX_LEN);
  }
}

function updateToneReveal() {
  const has = (noteInput?.value?.trim()?.length ?? 0) > 0;
  if (!has) typeTouched = false;
  toneWrap?.classList.toggle("contribute-rise-tone--revealed", has);
  if (kindStatesEl) {
    if (has) kindStatesEl.removeAttribute("aria-disabled");
    else kindStatesEl.setAttribute("aria-disabled", "true");
  }
  /* disabled nativo: en móvil funciona mejor que pointer-events/tabindex (touch + teclado). */
  form?.querySelectorAll('input[name="type"]').forEach((r) => {
    r.disabled = !has;
    r.removeAttribute("tabindex");
    r.removeAttribute("aria-disabled");
  });
  if (moodInput) {
    moodInput.disabled = !has;
    moodInput.removeAttribute("tabindex");
    moodInput.removeAttribute("aria-disabled");
  }
}

/** Pre-sugiere kind según señales de la nota; solo si el usuario aún no eligió explícitamente. */
function suggestKindFromNote() {
  if (typeTouched) return;
  const raw = noteInput?.value?.trim() ?? "";
  if (!raw) return;
  const b = getNoteSignalBreakdown(raw);
  const r = b.matchedReactive.length;
  const f = b.matchedReflective.length;
  let v = "observed";
  if (r > f) v = "avoidable";
  else if (f > r) v = "fertile";
  const inp = form?.querySelector(`input[name="type"][value="${v}"]`);
  if (inp) inp.checked = true;
}

function scheduleKindSuggest() {
  clearTimeout(kindSuggestTimer);
  kindSuggestTimer = setTimeout(() => suggestKindFromNote(), 420);
}

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
    type: getSelectedType(),
    mood,
    note,
    timestamp: new Date().toISOString(),
    shared: sharedInput.checked,
    hidden: false,
  };
}

function makeRemoteMomentPayload() {
  return {
    type: getSelectedType(),
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
  const blocked = isNoteBlocked(noteInput?.value ?? "");
  if (saveButton) saveButton.disabled = !hasValidNote() || !consentOk || blocked;
  updateNotePolicyUI();
}

function onNoteFieldActivity() {
  clampNoteLength();
  if (formStatus.textContent === MSG_COMPLETE_FIELD) {
    setFormStatus("");
  }
  syncSaveState();
  updateNoteAnalysisLine();
  updateToneReveal();
  scheduleKindSuggest();
}

noteInput.addEventListener("input", onNoteFieldActivity);
noteInput.addEventListener("change", onNoteFieldActivity);
noteInput.addEventListener("paste", () => requestAnimationFrame(onNoteFieldActivity));
noteInput.addEventListener("cut", () => requestAnimationFrame(onNoteFieldActivity));
noteInput.addEventListener("compositionend", onNoteFieldActivity);

/** iOS/Safari: al restaurar desde caché (swipe back), re-sincronizar estado del formulario. */
window.addEventListener("pageshow", (e) => {
  if (e.persisted) {
    clampNoteLength();
    syncSaveState();
    updateNoteAnalysisLine();
    updateToneReveal();
    scheduleKindSuggest();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !noteInput) return;
  requestAnimationFrame(() => {
    clampNoteLength();
    updateToneReveal();
    syncSaveState();
  });
});

consentInput?.addEventListener("change", () => {
  if (formStatus.textContent === MSG_ACCEPT_TERMS) {
    setFormStatus("");
  }
  syncSaveState();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (form.dataset.submitting === "1") return;
  setFormStatus("");

  if (!moodInput.value || !ALLOWED_MOODS.has(moodInput.value)) {
    setFormStatus("Choose a mood.");
    return;
  }
  if (!hasValidNote()) {
    setFormStatus(MSG_COMPLETE_FIELD);
    syncSaveState();
    noteInput.focus();
    return;
  }

  const lang = getContributeLang();
  if (isNoteBlocked(noteInput.value)) {
    setFormStatus(
      lang === "es" ? "Esa frase no está permitida aquí." : "That wording isn’t allowed here."
    );
    updateNotePolicyUI();
    noteInput.focus();
    return;
  }

  if (consentInput && !consentInput.checked) {
    setFormStatus(MSG_ACCEPT_TERMS);
    consentInput.focus();
    return;
  }
  form.dataset.submitting = "1";
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.setAttribute("aria-busy", "true");
  }
  setFormStatus(
    sharedInput.checked
      ? lang === "es"
        ? "Enviando al campo compartido…"
        : "Sending to the shared field…"
      : lang === "es"
        ? "La lectura se ajusta."
        : "The reading adjusts."
  );

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
    /* Mensaje ya mostrado arriba (feedback inmediato). */
  } else {
    const remoteResult = await postMomentRemote(makeRemoteMomentPayload());
    if (remoteResult.ok) {
      setFormStatus(pickRitual());
      try { window.atmosphere?.bump?.(); } catch (_) {}
    } else if (remoteResult.moderationRejected) {
      setFormStatus(
        lang === "es"
          ? "Guardado local. No publicado (moderación)."
          : "Saved locally. Not published (moderation)."
      );
    } else if (remoteResult.status === 422) {
      setFormStatus(
        lang === "es"
          ? "Guardado local. No se aceptó la sincronización."
          : "Saved locally. Sync didn’t accept this."
      );
    } else if (remoteResult.status === 429) {
      setFormStatus(
        lang === "es"
          ? "Guardado local. Canal ocupado, probá de nuevo."
          : "Saved locally. Channel busy — try again."
      );
    } else {
      setFormStatus(
        lang === "es"
          ? "Guardado local. Sincronización no disponible."
          : "Saved locally. Sync unavailable."
      );
    }
  }

  reportObservatoryEvent("contribute_done");

  try {
    const windowMs = 25 * 60 * 1000 + Math.random() * 10 * 60 * 1000;
    localStorage.setItem(
      "slipup_v2_last_moment",
      JSON.stringify({
        type: getSelectedType(),
        mood: moodInput.value,
        note: (noteInput.value || "").replace(/\s+/g, " ").trim().slice(0, 80),
        timestamp: Date.now(),
        windowMs,
      })
    );
  } catch (_) {}

  const seedParam = sharedInput.checked ? "&s=" + simpleHash(localMoment.id) : "";
  const redirectDelay = sharedInput.checked ? 2200 : 1400;
  setTimeout(() => {
    window.location.href = "./index.html?contributed=1" + seedParam;
  }, redirectDelay);
});

/** Tooltip y caption "Support the Observatory": mensaje motivacional (mantener el campo vivo). */
function setSupportObservatoryTooltip() {
  const lang = (document.documentElement.getAttribute("lang") || "en").slice(0, 2);
  const tooltip = document.getElementById("supportObservatoryTooltip");
  if (tooltip) tooltip.textContent = lang === "es" ? "Tu apoyo mantiene el observatorio sin anuncios y el campo vivo." : "Your support keeps the observatory ad-free and the field alive.";
  const caption = document.getElementById("supportObservatoryCaption");
  if (caption) caption.textContent = lang === "es" ? "Mantené el campo vivo." : "Keep the field alive.";
}

if (kindStatesEl && form) {
  kindStatesEl.querySelectorAll(".contribute-kind-state").forEach((label) => {
    const radio = label.querySelector('input[name="type"]');
    if (!radio) return;
    label.addEventListener("pointerenter", () => setKindPreview(radio.value));
    label.addEventListener("pointerleave", () => {
      requestAnimationFrame(() => {
        if (!kindStatesEl.matches(":hover")) setKindPreview(getSelectedType());
      });
    });
  });
  form.querySelectorAll('input[name="type"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      typeTouched = true;
      setKindPreview(getSelectedType());
    });
    radio.addEventListener("focus", () => setKindPreview(radio.value));
    radio.addEventListener("blur", () => {
      setTimeout(() => {
        const ae = document.activeElement;
        if (!kindStatesEl.contains(ae)) setKindPreview(getSelectedType());
      }, 0);
    });
  });
}

clampNoteLength();
syncSaveState();
updateNoteAnalysisLine();
updateToneReveal();
scheduleKindSuggest();
setRisePlaceholder();
setRiseExamplesLive();
setSupportObservatoryTooltip();
reportObservatoryEvent("contribute_view");
setMomentCountLine();

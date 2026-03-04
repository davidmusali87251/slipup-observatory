import { fetchClimateRemote, fetchSharedMomentsRemote } from "./remote.js";

const STORAGE_KEY = "slipup_v2_moments";
const RENDER_LIMIT = 10;
const CENTER = 50;
const BASELINE = 28;
const SCALE = 100;
const BASELINE_PER_48H = 24;
const COMPUTED_DEGREE_KEY = "slipup_v2_computed_degree";
const DISPLAY_DEGREE_KEY = "slipup_v2_display_degree";

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

function patternLineForTag(tag) {
  if (tag === "pattern_a") return "Avoidable tension returns under stress.";
  if (tag === "pattern_b") return "A short loop is repeating.";
  if (tag === "pattern_c") return "Movement concentrates in small clusters.";
  return "";
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

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function weightedAvgMood(moodCounts, total) {
  if (total === 0) return 0;
  const moodWeights = {
    calm: -0.06,
    focus: -0.02,
    stressed: 0.06,
    curious: -0.01,
    tired: 0.04,
  };
  const sum = Object.entries(moodWeights).reduce((acc, [mood, weight]) => {
    return acc + safeNumber(moodCounts[mood]) * weight;
  }, 0);
  return sum / total;
}

function chooseAlpha(total) {
  if (total < 6) return 0.12;
  if (total < 20) return 0.18;
  return 0.2;
}

function quantityDamping(total) {
  // As sample volume grows, each new entry should move the degree less.
  // 28 is treated as a mature-volume reference point.
  const matureVolume = 28;
  const ratio = Math.max(0, total) / matureVolume;
  return clamp(1 / Math.sqrt(1 + ratio * 1.4), 0.22, 1);
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

  const counts = { avoidable: 0, fertile: 0, observed: 0 };
  const moods = {
    calm: 0,
    focus: 0,
    stressed: 0,
    curious: 0,
    tired: 0,
  };

  windowed.forEach((m) => {
    if (counts[m.type] !== undefined) counts[m.type] += 1;
    if (moods[m.mood] !== undefined) moods[m.mood] += 1;
  });

  const total = windowed.length;
  const avoidableP = counts.avoidable / total;
  const fertileP = counts.fertile / total;
  const observedP = counts.observed / total;
  const datasetSize = windowed.length;
  const warmupFactor = Math.min(1, datasetSize / 6);

  // Activity signal compares actual density with expected baseline.
  const activityRatio = clamp(total / BASELINE_PER_48H, 0.4, 2.2);
  const activitySignal = (activityRatio - 1) * 6.5;

  // Mood adds only a gentle modulation.
  const moodSignal = weightedAvgMood(moods, total);
  const moodAmplifier = clamp(1 + moodSignal * 0.65, 0.85, 1.2);

  // Degree represents structural condensation level (not error count, not mood intensity).
  const typeStructural = avoidableP * 18 + fertileP * 6 - 7;
  const observedStabilizer = 1 - observedP * 0.45;
  const structuralDelta = (typeStructural * moodAmplifier + activitySignal) * observedStabilizer;
  const damping = quantityDamping(total);
  const delta = structuralDelta * warmupFactor * damping;
  const target = clamp(BASELINE + delta, 0, SCALE);
  const alpha = chooseAlpha(total);

  // Deterministic warm-up smoothing based on current window only.
  const warmBase = BASELINE + alpha * (target - BASELINE);
  const repetitionNudge = clamp(repetition.strength * 4.8 * damping, 0, 2.8);
  let computedDegree = clamp(warmBase + repetitionNudge, 0, SCALE);
  if (datasetSize === 1) {
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
  if (total < 3) return "The sky is quiet.";
  if (value < 38) return "Movement appears steady.";
  if (value < 60) return "The atmosphere tends to balance.";
  if (value < 74) return "Pressure appears to be rising.";
  return "High pressure may be forming.";
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
    empty.textContent = "The sky is quiet.";
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

function renderHorizon(moments) {
  const personal = moments.filter((m) => !m.hidden);
  const total = personal.length;

  horizonSecondary.classList.add("hidden");
  horizonMoreButton.classList.add("hidden");
  horizonSecondary.innerHTML = "";

  if (total === 0) {
    horizonPrimary.textContent = "Horizon begins after your first moment.";
    return;
  }

  if (total < 4) {
    horizonPrimary.textContent = "Not enough signal yet.";
    return;
  }

  const latest = personal.slice(-12);
  const countByType = latest.reduce(
    (acc, item) => {
      acc[item.type] += 1;
      return acc;
    },
    { avoidable: 0, fertile: 0, observed: 0 }
  );
  const dominant = Object.entries(countByType).sort((a, b) => b[1] - a[1])[0][0];
  horizonPrimary.textContent = `A ${dominant} pattern appears to be present.`;

  horizonMoreButton.classList.remove("hidden");
  horizonMoreButton.onclick = () => {
    horizonSecondary.classList.remove("hidden");
    const trend = latest.length > 7 ? "Recent movement is steady." : "Signal is still forming.";
    const delta = calculateClimate(personal).computedDegree - BASELINE;
    const drift = delta > 5 ? "Direction may be rising." : delta < -5 ? "Direction may be easing." : "Direction appears balanced.";
    horizonSecondary.innerHTML = `<p>${trend}</p><p>${drift}</p><p>Change vs yesterday appears moderate.</p>`;
    horizonMoreButton.classList.add("hidden");
  };
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

function renderPatternLayer(repetition) {
  heroEl.classList.toggle("observatory--pattern", Boolean(repetition?.hasPattern));
  if (!repetition?.hasPattern) {
    atmospherePatternLine.textContent = "";
    atmospherePatternLine.classList.add("hidden");
    return;
  }
  atmospherePatternLine.textContent = patternLineForTag(repetition.tag);
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
    };
  } catch {
    const localClimate = calculateClimate(localMoments);
    return {
      source: "local",
      computedDegree: localClimate.computedDegree,
      total: localClimate.total,
      condition: conditionForDegree(localClimate.computedDegree, localClimate.total),
      repetition: localClimate.repetition,
    };
  }
}

async function boot() {
  const moments = loadMoments();
  const previousComputed = getStoredComputedDegree();
  const previousDisplay = getStoredDisplayDegree();
  const optimisticStartDisplay = Number.isFinite(previousDisplay)
    ? previousDisplay
    : Number.isFinite(previousComputed)
      ? previousComputed
      : BASELINE;
  degreeValue.textContent = formatDegree(optimisticStartDisplay);
  document.body.style.setProperty("--atmo", String(optimisticStartDisplay));

  const [sharedResult, climateTruth] = await Promise.all([loadSharedMoments(moments), loadClimateTruth(moments)]);
  const sharedMoments = sharedResult.items;
  const localClimate = calculateClimate(moments);
  const computedDegree = climateTruth.computedDegree;
  const startDisplay = Number.isFinite(previousDisplay)
    ? previousDisplay
    : Number.isFinite(previousComputed)
      ? previousComputed
      : computedDegree;

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
  conditionLine.textContent = climateTruth.condition;
  renderPatternLayer(climateTruth.repetition);
  renderRecent(sharedMoments);
  renderHorizon(moments);

  viewMoreButton.onclick = () => openSharedSheet(sharedMoments);
  sheetBackdrop.onclick = closeSharedSheet;
  sharedSheetCloseButton.onclick = closeSharedSheet;
}

boot();

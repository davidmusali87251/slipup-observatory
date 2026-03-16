/**
 * SlipUp™ Observatory — señal atmosférica visible.
 * Convierte momentos recientes en lectura breve + horizonte pulsante + puntos de señal.
 * Sin backend extra; usa solo timestamps y tipo de moment.
 *
 * Eventos (si existe window.__observatoryReportEvent):
 *   atmosphere.reading_shown — se mostró la etiqueta de lectura.
 *   atmosphere.pulse_fired   — el pulso pasó a activo (transición a .is-active).
 *   atmosphere.bumped        — se llamó a bump() (p. ej. tras contribuir).
 * Ejemplo analíticos: window.__observatoryReportEvent = function(name) { analytics.track(name); };
 *
 * Tuning (A/B sugerido):
 *   DECAY_HALFLIFE_HOURS: 8 = más reactivo, 16 = más persistente (actual 12).
 *   T1/T2: si muchos días "quiet" bajar T1 a 2; si muchos "dense" subir T2 a 10–12 (actual 3/8).
 *   pulseDelay: tras contribuir 2–4 s (condensación → señal); tuning 3–12 s.
 *   REACTION_DELAY_MS: cuando el nivel atmosférico cambia, el horizonte reacciona con 1–2 s de retraso (condensation → signal).
 * Panel dev: ?atm_tune=1 carga atm-tune-panel.js para cambiar tuning en vivo.
 */
(function () {
  "use strict";

  const WEIGHTS = { avoidable: 0.8, fertile: 1.0, observed: 0.6 };
  const WINDOW_MS = 24 * 3600 * 1000;
  const UPDATE_THROTTLE_MS = 1500;
  const REACTION_DELAY_MS = 1200;
  const LONGTAIL_POINT_CHANCE = 0.1;
  const LONGTAIL_DURATION_MS = { min: 10000, max: 14000 };

  var lastUpdateTs = 0;
  var lastLevel = undefined;
  var tuning = {
    DECAY_HALFLIFE_HOURS: 12,
    T1: 3,
    T2: 8,
  };

  /* Frases atmReadingLine: atmósfera/lectura/colectivo. Ligero pull para volver (continuidad, ahora, ver qué pasa). */
  const LABELS = {
    en: {
      quiet: [
        "The field holds its breath.",
        "Stillness before the next rise.",
        "The read is resting—for now.",
        "Nothing moving yet.",
        "The field still reads.",
        "The reading is here.",
        "Silence in the field.",
        "The reading waits.",
        "Calm layer.",
        "No lift yet.",
        "Still air.",
        "The read, now.",
        "Something will stir.",
      ],
      rising: [
        "Something is rising.",
        "The field is stirring—now.",
        "A shift in the air.",
        "The reading is waking.",
        "Moments gathering.",
        "The read is rising.",
        "The atmosphere, now.",
        "Lift in the air.",
        "The field is waking.",
        "Signals gathering.",
        "A rise in the read.",
        "The layer is moving.",
        "See what the field is reading.",
        "It's happening in the air.",
      ],
      dense: [
        "The field is full tonight.",
        "Heavy with signal.",
        "The air is charged.",
        "A thick read.",
        "The layer has weight.",
        "What the field holds.",
        "Full tonight.",
        "The field carries weight.",
        "Charged layer.",
        "Heavy reading.",
        "Dense with moments.",
        "The layer speaks.",
      ],
    },
    es: {
      quiet: [
        "El campo contiene la respiración.",
        "Calma antes del siguiente ascenso.",
        "La lectura descansa—por ahora.",
        "Nada se mueve aún.",
        "El campo sigue leyendo.",
        "La lectura está aquí.",
        "Silencio en el campo.",
        "La lectura espera.",
        "Capa en calma.",
        "Sin ascenso aún.",
        "Aire quieto.",
        "La lectura, ahora.",
        "Algo va a agitarse.",
      ],
      rising: [
        "Algo está subiendo.",
        "El campo se agita—ahora.",
        "Un cambio en el aire.",
        "La lectura despierta.",
        "Momentos reuniéndose.",
        "La lectura sube.",
        "La atmósfera, ahora.",
        "Ascenso en el aire.",
        "El campo despierta.",
        "Señales reuniéndose.",
        "Una subida en la lectura.",
        "La capa se mueve.",
        "Mirá qué lee el campo.",
        "Está pasando en el aire.",
      ],
      dense: [
        "El campo está lleno esta noche.",
        "Pesado de señal.",
        "El aire está cargado.",
        "Una lectura densa.",
        "La capa tiene peso.",
        "Lo que el campo sostiene.",
        "Lleno esta noche.",
        "El campo lleva peso.",
        "Capa cargada.",
        "Lectura pesada.",
        "Denso de momentos.",
        "La capa habla.",
      ],
    },
  };

  function pickLabel(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function lang() {
    const l = (document.documentElement.getAttribute("lang") || "en").slice(0, 2);
    return l === "es" ? "es" : "en";
  }

  function computeScore(moments) {
    if (!Array.isArray(moments)) return 0;
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    return moments.reduce(function (s, m) {
      const raw = m.timestamp || m.created_at;
      const ts = raw ? new Date(raw).getTime() : 0;
      if (ts < cutoff) return s;
      const ageHours = (now - ts) / 3600000;
      const base = WEIGHTS[String(m.type || "observed").toLowerCase()] || 0.7;
      const temporal = Math.exp(-ageHours / tuning.DECAY_HALFLIFE_HOURS);
      return s + base * temporal;
    }, 0);
  }

  function getState(score) {
    const l = LABELS[lang()];
    var t1 = tuning.T1, t2 = tuning.T2;
    if (score < t1) return { label: pickLabel(l.quiet), level: 0 };
    if (score < t2) return { label: pickLabel(l.rising), level: Math.min(1, (score - t1) / (t2 - t1)) };
    return { label: pickLabel(l.dense), level: 1 };
  }

  /** Tipo dominante en ventana (mismo peso temporal que score). Modula campo violeta (data-atmosphere-state). */
  function getDominantType(moments) {
    if (!Array.isArray(moments) || moments.length === 0) return "observed";
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    var sums = { avoidable: 0, fertile: 0, observed: 0 };
    moments.forEach(function (m) {
      const raw = m.timestamp || m.created_at;
      const ts = raw ? new Date(raw).getTime() : 0;
      if (ts < cutoff) return;
      const ageHours = (now - ts) / 3600000;
      const w = (WEIGHTS[String(m.type || "observed").toLowerCase()] || 0.7) * Math.exp(-ageHours / tuning.DECAY_HALFLIFE_HOURS);
      const t = String(m.type || "observed").toLowerCase();
      if (t === "avoidable") sums.avoidable += w;
      else if (t === "fertile") sums.fertile += w;
      else sums.observed += w;
    });
    if (sums.avoidable >= sums.fertile && sums.avoidable >= sums.observed) return "avoidable";
    if (sums.fertile >= sums.observed) return "fertile";
    return "observed";
  }

  function setTuning(opts) {
    if (opts && typeof opts === "object") {
      if (Number.isFinite(opts.DECAY_HALFLIFE_HOURS)) tuning.DECAY_HALFLIFE_HOURS = opts.DECAY_HALFLIFE_HOURS;
      if (Number.isFinite(opts.T1)) tuning.T1 = opts.T1;
      if (Number.isFinite(opts.T2)) tuning.T2 = opts.T2;
    }
    return tuning;
  }

  function getTuning() {
    return { DECAY_HALFLIFE_HOURS: tuning.DECAY_HALFLIFE_HOURS, T1: tuning.T1, T2: tuning.T2 };
  }

  function report(eventName, payload) {
    try {
      if (typeof window.__observatoryReportEvent === "function") {
        window.__observatoryReportEvent(eventName, payload);
      }
    } catch (_) {}
  }

  function applyVisuals(state, pulseActive, spawnPoints, opts) {
    opts = opts || {};
    if (pulseActive === undefined) pulseActive = state.level > 0.35;
    if (spawnPoints === undefined) spawnPoints = true;
    const dominantType = opts.dominantType || "observed";
    try {
      document.documentElement.setAttribute("data-atmosphere-state", dominantType);
    } catch (_) {}
    const horizonBar = document.getElementById("horizonPulseBar");
    const labelEl = document.getElementById("atmReadingLine");
    const signalsEl = document.getElementById("atmSignals");

    if (horizonBar) {
      var wasActive = horizonBar.classList.contains("is-active");
      horizonBar.classList.toggle("is-active", pulseActive);
      if (pulseActive && !wasActive) {
        report("atmosphere.pulse_fired", { level: state.level, pulseDelayMs: opts.pulseDelayMs || 0, trigger: "auto" });
      }
    }
    if (labelEl) {
      const newText = state.label ? state.label : "";
      if (newText !== labelEl.textContent) {
        if (!reduceMotion() && state.label) {
          labelEl.classList.add("atm-reading-updating");
          setTimeout(function () {
            labelEl.textContent = newText;
            labelEl.classList.toggle("hidden", !state.label);
            labelEl.classList.remove("atm-reading-updating");
            if (state.label) report("atmosphere.reading_shown", { level: state.level, label: state.label, score: opts.score });
          }, 250);
        } else {
          labelEl.textContent = newText;
          labelEl.classList.toggle("hidden", !state.label);
          if (state.label) report("atmosphere.reading_shown", { level: state.level, label: state.label, score: opts.score });
        }
      } else {
        labelEl.classList.toggle("hidden", !state.label);
      }
    }
    if (spawnPoints && signalsEl && state.level > 0 && !reduceMotion()) {
      spawnSignals(signalsEl, Math.min(6, Math.round(1 + state.level * 5)), state.level);
    }
  }

  function spawnSignals(container, count, intensity) {
    container.innerHTML = "";
    for (var i = 0; i < count; i++) {
      var p = document.createElement("div");
      p.className = "atm-point";
      p.setAttribute("aria-hidden", "true");
      var left = 10 + Math.random() * 80;
      var delayMs = Math.random() * 2000;
      var isLongtail = Math.random() < LONGTAIL_POINT_CHANCE;
      var durationMs = isLongtail
        ? LONGTAIL_DURATION_MS.min + Math.random() * (LONGTAIL_DURATION_MS.max - LONGTAIL_DURATION_MS.min)
        : 4000 + Math.random() * 4000;
      p.style.left = left + "%";
      p.style.bottom = "0";
      container.appendChild(p);
      requestAnimationFrame(function (el, delay, dur, int) {
        return function () {
          el.style.transition = "opacity " + dur + "ms ease-out " + delay + "ms, transform " + dur + "ms " + delay + "ms";
          el.style.opacity = 0.85 * int;
          el.style.transform = "translateY(-" + (12 + Math.random() * 24) + "px) scale(" + (0.6 + Math.random() * 0.6) + ")";
          setTimeout(function () {
            el.style.opacity = 0;
          }, delay + dur * 0.4);
        };
      }(p, delayMs, durationMs, intensity));
    }
  }

  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function update(moments, opts) {
    opts = opts || {};
    var now = Date.now();
    var pulseDelay = opts.pulseDelay;
    if (!pulseDelay && now - lastUpdateTs < UPDATE_THROTTLE_MS) return;
    lastUpdateTs = now;

    var score = computeScore(moments);
    var state = getState(score);
    var dominantType = getDominantType(moments);
    var baseOpts = { score: score, dominantType: dominantType };
    var levelChanged = lastLevel !== undefined && Math.abs(state.level - lastLevel) > 0.05;

    if (pulseDelay > 0 && !reduceMotion()) {
      applyVisuals(state, false, false, Object.assign({ pulseDelayMs: pulseDelay }, baseOpts));
      setTimeout(function () {
        applyVisuals(state, state.level > 0.35, true, Object.assign({ pulseDelayMs: pulseDelay }, baseOpts));
        lastLevel = state.level;
      }, pulseDelay);
    } else if (levelChanged && !reduceMotion()) {
      lastLevel = state.level;
      applyVisuals(state, false, false, baseOpts);
      setTimeout(function () {
        applyVisuals(state, state.level > 0.35, true, baseOpts);
      }, REACTION_DELAY_MS);
    } else {
      applyVisuals(state, undefined, true, baseOpts);
      lastLevel = state.level;
    }
  }

  function bump() {
    if (reduceMotion()) return;
    report("atmosphere.bumped", { source: "ui", momentType: "fertile" });
    var fake = [{ type: "fertile", timestamp: new Date().toISOString() }];
    var existing = typeof window.__slipupMomentsCache !== "undefined" && Array.isArray(window.__slipupMomentsCache) ? window.__slipupMomentsCache : [];
    lastUpdateTs = 0;
    update(fake.concat(existing));
  }

  window.atmosphereSignal = {
    update: update,
    bump: bump,
    setTuning: setTuning,
    getTuning: getTuning,
  };
})();

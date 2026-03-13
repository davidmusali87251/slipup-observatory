/**
 * Panel de tuning de la señal atmosférica — solo en desarrollo (?atm_tune=1).
 * Permite cambiar DECAY_HALFLIFE_HOURS, T1, T2 y reaplicar la señal.
 */
(function () {
  "use strict";
  if (!/[?&]atm_tune=1/.test(document.location.search)) return;

  var api = window.atmosphereSignal;
  if (!api || !api.getTuning || !api.setTuning || !api.update) return;

  var t = api.getTuning();
  var wrap = document.createElement("div");
  wrap.id = "atm-tune-panel";
  wrap.setAttribute("aria-label", "Atmosphere signal tuning (dev)");
  wrap.style.cssText =
    "position:fixed;bottom:12px;right:12px;z-index:9998;max-width:260px;background:rgba(11,12,26,0.95);" +
    "border:1px solid rgba(139,108,255,0.35);border-radius:10px;padding:10px 12px;font-family:var(--font-sans,sans-serif);" +
    "font-size:12px;color:#E6E6F0;box-shadow:0 4px 20px rgba(0,0,0,0.35);";

  function numInp(label, key, value, min, max, step) {
    var p = document.createElement("p");
    p.style.margin = "6px 0";
    var lab = document.createElement("label");
    lab.textContent = label + " ";
    lab.style.marginRight = "6px";
    var inp = document.createElement("input");
    inp.type = "number";
    inp.min = min;
    inp.max = max;
    inp.step = step || 1;
    inp.value = value;
    inp.style.width = "56px";
    inp.style.padding = "2px 4px";
    inp.style.background = "rgba(255,255,255,0.1)";
    inp.style.border = "1px solid rgba(139,108,255,0.3)";
    inp.style.borderRadius = "4px";
    inp.style.color = "#E6E6F0";
    lab.appendChild(inp);
    p.appendChild(lab);
    return { p: p, inp: inp, key: key };
  }

  var rowDecay = numInp("Decay half-life (h)", "DECAY_HALFLIFE_HOURS", t.DECAY_HALFLIFE_HOURS, 4, 24, 1);
  var rowT1 = numInp("T1 (quiet <)", "T1", t.T1, 1, 10, 1);
  var rowT2 = numInp("T2 (dense ≥)", "T2", t.T2, 4, 20, 1);

  var title = document.createElement("p");
  title.textContent = "Atmosphere tune (dev)";
  title.style.margin = "0 0 8px 0"; title.style.fontWeight = "600"; title.style.fontSize = "11px"; title.style.letterSpacing = "0.05em";
  wrap.appendChild(title);
  wrap.appendChild(rowDecay.p);
  wrap.appendChild(rowT1.p);
  wrap.appendChild(rowT2.p);

  var btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Apply";
  btn.style.marginTop = "8px";
  btn.style.padding = "4px 10px";
  btn.style.background = "rgba(139,108,255,0.35)";
  btn.style.border = "1px solid rgba(139,108,255,0.5)";
  btn.style.borderRadius = "6px";
  btn.style.color = "#E6E6F0";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "12px";
  btn.onclick = function () {
    var opts = {
      DECAY_HALFLIFE_HOURS: Number(rowDecay.inp.value) || 12,
      T1: Number(rowT1.inp.value) || 3,
      T2: Number(rowT2.inp.value) || 8,
    };
    api.setTuning(opts);
    api.update(window.__slipupMomentsCache || [], { pulseDelay: 0 });
  };
  wrap.appendChild(btn);

  document.body.appendChild(wrap);
})();

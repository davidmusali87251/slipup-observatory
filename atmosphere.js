/**
 * SlipUp™ Observatory — control del glow atmosférico.
 * Expone window.atmosphere.bump() para subir la intensidad del glow al registrar un momento (u otro evento).
 */
(function () {
  "use strict";

  const ROOT = document.documentElement;
  const GLOW_VAR = "--atm-glow-alpha";
  const DEFAULT_ALPHA = 0.2;
  const BUMP_ALPHA = 0.5;
  const BUMP_MS = 2200;

  let bumpTimeout = null;

  function bump() {
    if (!ROOT.classList.contains("theme-atmosphere")) return;
    ROOT.style.setProperty(GLOW_VAR, String(BUMP_ALPHA));
    if (bumpTimeout) clearTimeout(bumpTimeout);
    bumpTimeout = setTimeout(function () {
      bumpTimeout = null;
      ROOT.style.setProperty(GLOW_VAR, String(DEFAULT_ALPHA));
    }, BUMP_MS);
  }

  function reset() {
    if (bumpTimeout) clearTimeout(bumpTimeout);
    bumpTimeout = null;
    ROOT.style.setProperty(GLOW_VAR, String(DEFAULT_ALPHA));
  }

  window.atmosphere = {
    bump: bump,
    reset: reset,
  };
})();

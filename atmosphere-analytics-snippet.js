/**
 * SlipUp Observatory — envío de eventos de la señal atmosférica a analytics.
 * Incluir este script después de atmosphere-signal.js (o integrar en tu bundle)
 * y definir tu función de envío en ANALYTICS_TRACK.
 *
 * Eventos emitidos:
 *   atmosphere.reading_shown — se mostró la etiqueta de lectura (quiet field / signals rising / dense tonight).
 *   atmosphere.pulse_fired   — el horizonte pulsante pasó a activo (level > 0.35).
 *   atmosphere.bumped        — el usuario provocó un bump (p. ej. tras contribuir un momento).
 *
 * KPIs sugeridos:
 *   - CTR a Contribute tras atmosphere.reading_shown en sesión (primaria).
 *   - Visitas recurrentes 7d, tiempo medio en página, rebote en hero (secundarias).
 *   - Pulses por día, bumps por contribución, latencia contribución → pulse (operacionales).
 */
(function () {
  "use strict";

  function send(eventName, payload) {
    var params = payload && typeof payload === "object" ? Object.assign({}, payload) : {};
    if (typeof window.ANALYTICS_TRACK === "function") {
      window.ANALYTICS_TRACK(eventName, params);
      return;
    }
    if (typeof window.gtag === "function") {
      params.event_category = "atmosphere";
      window.gtag("event", eventName, params);
      return;
    }
    if (typeof window.__observatoryReportEvent === "function") {
      window.__observatoryReportEvent(eventName, params);
    }
  }

  var original = window.__observatoryReportEvent;
  window.__observatoryReportEvent = function (eventName, payload) {
    if (/^atmosphere\./.test(eventName)) send(eventName, payload);
    if (original) original(eventName, payload);
  };
})();

/**
 * Uso: definir tu track antes de cargar este snippet:
 *
 *   window.ANALYTICS_TRACK = function (eventName, payload) {
 *     analytics.track(eventName, payload || {});
 *   };
 *
 * Payloads típicos:
 *   atmosphere.reading_shown → { level, label, score }
 *   atmosphere.pulse_fired   → { level, pulseDelayMs, trigger }
 *   atmosphere.bumped      → { source, momentType }
 *
 * Si no defines ANALYTICS_TRACK, se usa gtag o __observatoryReportEvent.
 */

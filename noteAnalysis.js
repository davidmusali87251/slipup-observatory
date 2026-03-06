/**
 * Análisis de texto de la nota (Intention): normalización, tokens reconocidos y palabras sin token.
 * Una sola fuente de verdad para la señal semántica; el modelo solo usa reflective/reactive.
 * Ver docs/MODEL_DESIGN_AND_CALIBRATION.md y REFLECTIVE_TOKENS / REACTIVE_TOKENS en modelConstants.
 */

import {
  REFLECTIVE_TOKENS,
  REACTIVE_TOKENS,
  NOTE_SIGNAL_DIVISOR,
  NOTE_SIGNAL_CAP,
} from "./modelConstants.js";

/**
 * Normaliza el texto de la nota igual que en el modelo (minúsculas, NFD, sin acentos).
 */
export function normalizeNoteText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Comprueba si la palabra (o el texto) contiene al menos un token de la lista (substring).
 */
function wordMatchesAnyToken(word, tokens) {
  return tokens.some((token) => word.includes(token));
}

/**
 * Devuelve los tokens de la lista que aparecen como substring en el texto.
 */
function matchedTokens(text, tokens) {
  const out = [];
  tokens.forEach((token) => {
    if (text.includes(token)) out.push(token);
  });
  return out;
}

/**
 * Palabras del texto normalizado que no contienen ningún token reflexivo ni reactivo.
 * Útil para ver qué parte del texto "no entra" en la lectura y para ampliar listas.
 */
function unmatchedWords(normalizedText, reflectiveTokens, reactiveTokens) {
  if (!normalizedText) return [];
  const words = normalizedText.split(/\s+/).filter((w) => w.length > 0);
  const seen = new Set();
  return words.filter((word) => {
    if (seen.has(word)) return false;
    const matchesReflective = wordMatchesAnyToken(word, reflectiveTokens);
    const matchesReactive = wordMatchesAnyToken(word, reactiveTokens);
    if (matchesReflective || matchesReactive) return false;
    seen.add(word);
    return true;
  });
}

/**
 * Desglose completo del análisis de la nota para herramientas y UI.
 * - reflective / reactive: mismos valores que usa el modelo (señal acotada).
 * - matchedReflective / matchedReactive: listas de tokens que hicieron match.
 * - unmatchedWords: palabras que no contienen ningún token (candidatas a ampliar listas).
 */
export function getNoteSignalBreakdown(note) {
  const text = normalizeNoteText(note);
  if (!text) {
    return {
      normalizedText: "",
      reflective: 0,
      reactive: 0,
      matchedReflective: [],
      matchedReactive: [],
      unmatchedWords: [],
    };
  }

  const matchedReflective = matchedTokens(text, REFLECTIVE_TOKENS);
  const matchedReactive = matchedTokens(text, REACTIVE_TOKENS);
  const reflectiveCount = matchedReflective.length;
  const reactiveCount = matchedReactive.length;
  const reflective = Math.min(reflectiveCount / NOTE_SIGNAL_DIVISOR, NOTE_SIGNAL_CAP);
  const reactive = Math.min(reactiveCount / NOTE_SIGNAL_DIVISOR, NOTE_SIGNAL_CAP);
  const unmatched = unmatchedWords(text, REFLECTIVE_TOKENS, REACTIVE_TOKENS);

  return {
    normalizedText: text,
    reflective,
    reactive,
    matchedReflective,
    matchedReactive,
    unmatchedWords: unmatched,
  };
}

/**
 * Señal que usa el modelo (solo reflective y reactive). Mantiene compatibilidad con app.js y backend.
 */
export function noteSignal(note) {
  const b = getNoteSignalBreakdown(note);
  return { reflective: b.reflective, reactive: b.reactive };
}

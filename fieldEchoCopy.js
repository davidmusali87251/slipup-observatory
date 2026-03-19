/**
 * SlipUp™ Observatory — eco del campo tras contribuir.
 * Reflexiones cortas (≤19) según kind + tone + señal de la nota (tokens reflexivos/reactivos).
 * No citan el texto del usuario; responden a lo que entró.
 */
import { getNoteSignalBreakdown } from "./modelConstants.js";
import { clampHeroReadingLine } from "./uiCopy.js";

/** @type {Record<string, string[]>} */
const REFLECTION_EN = {
  "fertile|calm": ["Room for that rise.", "Air leans gentle.", "Soft lift for this."],
  "fertile|focus": ["Your aim has space.", "Intent held in air.", "Focus finds room."],
  "fertile|stressed": ["Strain, still a door.", "Tight; air listens.", "Pressure meets lift."],
  "fertile|curious": ["Questions find air.", "Wonder has a shelf.", "Curious room here."],
  "fertile|tired": ["Tired; still room.", "Room for weary too.", "Rest meets sky."],
  "avoidable|calm": ["Marked, still quiet.", "Quiet breath; named.", "Weight, gentle note."],
  "avoidable|focus": ["Named; watched sharp.", "Edge held in view.", "Risk seen clearly."],
  "avoidable|stressed": ["Tension logged here.", "Strain named aloud.", "The sting is seen."],
  "avoidable|curious": ["Probing what stings.", "Risk under kind light.", "Curious on the edge."],
  "avoidable|tired": ["Heavy named gently.", "Weariness recorded.", "Load met with care."],
  "observed|calm": ["Seen without rush.", "Quiet witness held.", "Taken in softly."],
  "observed|focus": ["Noted with full eye.", "Attention held steady.", "Seen with clear line."],
  "observed|stressed": ["Strain seen clearly.", "Seen under the load.", "A witness to weight."],
  "observed|curious": ["Seen with bright ask.", "Wonder held in view.", "Eye open, asking."],
  "observed|tired": ["Weary view, honest.", "Seen past fatigue.", "Weary; truth stays."],
};

/** @type {Record<string, string[]>} */
const REFLECTION_ES = {
  "fertile|calm": ["Hay aire para eso.", "Sube con suavidad.", "Espacio para esto."],
  "fertile|focus": ["Tu foco tiene aire.", "Foco, aire y lugar.", "Claro aire acá."],
  "fertile|stressed": ["Tensa, aire queda.", "Apretado; aire oye.", "Carga con salida."],
  "fertile|curious": ["Duda, aire nuevo.", "Curiosidad, aire.", "Pregunta con aire."],
  "fertile|tired": ["Cansancio y aire.", "Fatiga, aire suave.", "Descanso con cielo."],
  "avoidable|calm": ["Marcado con calma.", "Peso, nota suave.", "Nombrado sin filo."],
  "avoidable|focus": ["Visto filo en claro.", "El borde queda fijo.", "Riesgo bien mirado."],
  "avoidable|stressed": ["Tensión registrada.", "La carga nombrada.", "Dolor visto acá."],
  "avoidable|curious": ["Mirada al filo.", "Curiosidad al riesgo.", "Pregunta al borde."],
  "avoidable|tired": ["Peso con cuidado.", "Fatiga anotada.", "Carga con ternura."],
  "observed|calm": ["Visto sin apuro.", "Testigo quieto.", "Mirada suave acá."],
  "observed|focus": ["Visto con cuidado.", "Ojo fijo, claro.", "Atento mirar acá."],
  "observed|stressed": ["Visto bajo carga.", "Tensión reconocida.", "Carga bien mirada."],
  "observed|curious": ["Visto con asombro.", "Mirada en pregunta.", "Ojo curioso acá."],
  "observed|tired": ["Se ve el cansancio.", "Fatiga reconocida.", "Verdad cansada."],
};

const DEFAULT_EN = ["The field heard that.", "Logged in the air.", "Held in the reading."];
const DEFAULT_ES = ["El campo lo oyó.", "Quedó en el aire.", "Quedó en la lectura."];

/**
 * @param {{ type?: string, mood?: string, note?: string }} moment
 * @param {"en"|"es"} lang
 * @param {number} seed
 * @returns {string}
 */
export function getFieldEchoReflection(moment, lang, seed = 0) {
  const type = String(moment?.type || "observed").toLowerCase();
  const mood = String(moment?.mood || "calm").toLowerCase();
  const note = moment?.note ?? "";
  const key = `${type}|${mood}`;
  const table = lang === "es" ? REFLECTION_ES : REFLECTION_EN;
  const fallback = lang === "es" ? DEFAULT_ES : DEFAULT_EN;
  let pool = table[key];
  if (!pool || !pool.length) pool = fallback;

  const b = getNoteSignalBreakdown(note);
  let offset = 0;
  if (b.matchedReactive.length > b.matchedReflective.length) offset = 1;
  else if (b.matchedReflective.length > b.matchedReactive.length) offset = 2;

  const idx = (Math.abs(seed) + offset) % pool.length;
  return clampHeroReadingLine(pool[idx]);
}

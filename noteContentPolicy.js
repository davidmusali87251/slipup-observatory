/**
 * Filtro de texto en el campo del momento (cliente).
 * - La Edge Function `moments` aplica la misma lógica vía
 *   `supabase/functions/_shared/noteContentPolicy.ts` (mantener listas alineadas).
 * - Fragmentos cortos usan límites de palabra (evita "ass" en "class").
 * - Añade más en runtime: window.__SLIPUP_NOTE_BLOCKLIST = ["..."].
 * - En servidor (solo deploy): secret/env `SLIPUP_NOTE_BLOCKLIST_EXTRA` = JSON array de strings.
 */

/**
 * Fragmentos prohibidos (comparación con normalizeForPolicy).
 * Cubre: spam/phishing, insultos y vulgaridad frecuente ES/EN.
 * Ampliar en servidor con lista propia o modelo; el repo no puede listar todo el odio posible.
 */
export const NOTE_BLOCKED_FRAGMENTS = [
  // —— Spam / phishing / enlaces (substring seguro: suelen ser tokens largos o con puntuación)
  "http://",
  "https://",
  "www.",
  "t.me/",
  "telegram.me",
  "discord.gg",
  "bit.ly/",
  "tinyurl",
  "goo.gl",
  "short.link",
  "click aqui",
  "click here",
  "buy now",
  "buy now!",
  "free money",
  "send bitcoin",
  "crypto wallet",
  "whatsapp:",
  "onlyfans",
  "subscribe now",
  "winner!",
  "you won",
  "claim prize",
  "verify account",
  "urgent action",
  "act now",
  "limited offer",
  "100% free",
  "no virus",
  "download now",
  "t.co/",
  "fb.me/",
  "ig.me/",
  "youtu.be",
  "linktr.ee",
  "bio.link",
  "ow.ly/",
  "is.gd/",
  "buff.ly",
  "cutt.ly",
  "rebrand.ly",
  "tiny.cc/",
  "shorturl",
  "url short",
  "earn cash",
  "earn $",
  "make money",
  "get rich",
  "double your",
  "cash prize",
  "gift card",
  "wire me",
  "send cash",
  "western uni",
  "money gram",
  "airdrop",
  "presale",
  "rug pull",
  "pump coin",
  "binance ref",
  "metamask",
  "seed phrase",
  "private key",
  "reset pass",
  "click link",
  "open link",
  "dm me now",
  "add me on",
  "snap:",
  "insta:",
  "tiktok.com",
  "cashapp",
  "venmo me",
  "paypal.me",
  "only fans",
  "sugar daddy",
  "sugar baby",
  "escort",
  "hook up",
  "nudes",
  "nude pic",
  "send nudes",
  "sex chat",
  "cam girl",
  "cam site",
  "deepfake",
  "revenge por",
  "gana dinero",
  "gana plata",
  "haz clic",
  "hace clic",
  "transf banc",
  "herencia",
  "principe ni",
  "loteria",
  "premio gana",
  "multiplica",
  "inversion",
  "whatsapp +",
  "telegram @",
  "contactame",
  "escribime ya",

  // —— Frases / odio (ES)
  "muerte a",
  "matar a",
  "violacion",
  "menores de",
  "cp",
  "porno",
  "xxx",
  "nsfw",
  "violar a",
  "violador",
  "pedofil",
  "pedofilo",
  "cp link",
  "child porn",
  "kids naked",
  "menor desnu",
  "snuff",
  "necrofil",
  "bestiality",
  "zoofilia",
  "incesto",
  "suicidate",
  "kill yours",
  "bomb how",
  "make bomb",

  // —— Insultos / vulgaridad ES (raíces largas → includes)
  "mierda",
  "puta madre",
  "hijo de puta",
  "hdp",
  "jodete",
  "chinga",
  "pendejo",
  "imbecil",
  "estupido",
  "idiota",
  "retrasado",
  "maldito",
  "basura humana",
  "vete a la mierda",
  "que te jodan",
  "cabron",
  "cagon",
  "mamón",
  "gilipollas",
  "capullo",
  "subnormal",
  "maricon",
  "sudaca",
  "sudacas",
  "indio de",
  "negro de mierda",
  "blanco de mierda",
  "boludo de m",
  "pelotudo",
  "tarado",
  "inutil",
  "hijo puta",
  "hijoputa",
  "me cago en",
  "vete a la",
  "anda a cagar",
  "concha de",
  "la concha",
  "chupame",
  "chupame la",
  "mamaguevo",
  "mamahuevo",
  "careverga",
  "care chimba",
  "hpta",
  "malparido",
  "malparida",
  "mongolo",
  "mongolico",
  "anormal",
  "degenerado",
  "degenerada",
  "mata judios",
  "odio judios",
  "odio negros",
  "odio blancos",
  "odio gays",
  "odio mujeres",
  "odio hombres",
  "puto el que",
  "puta la que",

  // —— Insultos / vulgaridad EN (raíces largas)
  "fucking",
  "motherfucker",
  "bullshit",
  "shithead",
  "dumbass",
  "jackass",
  "asshole",
  "bastard",
  "bitch",
  "bastards",
  "cocksucker",
  "dickhead",
  "prick",
  "slut",
  "whore",
  "retard",
  "nazi",
  "heil hitler",
  "kkk",
  "white power",
  "nigger",
  "nigga",
  "faggot",
  "tranny",
  "spic",
  "chink",
  "kike",
  "coon",
  "beaner",
  "wetback",
  "towelhead",
  "raghead",
  "gook",
  "jungle bunny",
  "porch monkey",
  "sand nigger",
  "zipperhead",
  "dyke",
  "shemale",
  "shitstain",
  "twat",
  "wanker",
  "bellend",
  "nonce",
  "groomer",
  "pedo bear",
  "groom kids",
  "kill yourself",
  "kys",
  "neck yourself",
  "hang yourself",
  "gas the",
  "race war",
  "day of rope",
  "1488",
  "zyklon",
  "holohoax",

  // —— Tokens cortos (solo con límite de palabra en isFragmentBlocked)
  "fuck",
  "shit",
  "cunt",
  "dick",
  "cock",
  "piss",
  "damn",
  "rape",
  "cum",
  "sex",
  "porn",
  "puta",
  "puto",
  "coño",
  "joder",
  "culo",
  "mamada",
  "verga",
  "chingar",
  "pinche",
  "pito",
  "ojete",
  "orto",
  "meada",
  "caca",
  "pedos",
  "sux",
  "fuk",
  "fux",
  "fuq",
];


/**
 * Normaliza para comparar: minúsculas, sin diacríticos fuertes, espacios colapsados.
 * @param {string} s
 */
export function normalizeForPolicy(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} textNorm texto ya normalizado
 * @param {string} fragNorm fragmento ya normalizado
 */
function isFragmentBlocked(textNorm, fragNorm) {
  if (!fragNorm || fragNorm.length < 2) return false;
  /* Frases con espacio: coincidencia de subcadena completa */
  if (fragNorm.includes(" ")) {
    return textNorm.includes(fragNorm);
  }
  /* Raíces largas: pocas colisiones en notas cortas (max 19) */
  if (fragNorm.length >= 5) {
    return textNorm.includes(fragNorm);
  }
  /* Tokens cortos: límite de palabra (evita "ass" en "class") */
  try {
    const escaped = fragNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `(?:^|[^a-z0-9áéíóúñü])${escaped}(?:[^a-z0-9áéíóúñü]|$)`,
      "i"
    ).test(textNorm);
  } catch {
    return textNorm.includes(fragNorm);
  }
}

function getAllBlockedFragments() {
  const base = Array.isArray(NOTE_BLOCKED_FRAGMENTS) ? NOTE_BLOCKED_FRAGMENTS : [];
  const extra =
    typeof window !== "undefined" && Array.isArray(window.__SLIPUP_NOTE_BLOCKLIST)
      ? window.__SLIPUP_NOTE_BLOCKLIST
      : [];
  return [...base, ...extra].filter((f) => typeof f === "string" && f.trim().length >= 2);
}

/**
 * @param {string} noteText
 * @returns {boolean} true si contiene algún fragmento bloqueado
 */
export function isNoteBlocked(noteText) {
  const n = normalizeForPolicy(noteText);
  if (!n) return false;
  for (const frag of getAllBlockedFragments()) {
    const f = normalizeForPolicy(frag);
    if (f.length >= 2 && isFragmentBlocked(n, f)) return true;
  }
  return false;
}

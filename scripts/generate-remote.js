#!/usr/bin/env node
/**
 * Genera remote.js con la config remota desde remote.local.js o variables de entorno.
 * Uso (desde la raíz del repo):
 *   node scripts/generate-remote.js
 * Lee remote.local.js si existe; si no, usa env REMOTE_MOMENTS_URL, REMOTE_CLIMATE_URL, REMOTE_ANON_KEY, USE_REMOTE_SHARED.
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const remotePath = path.join(root, "remote.js");
const templatePath = path.join(root, "remote.js.template");
const localPath = path.join(root, "remote.local.js");

if (!fs.existsSync(remotePath) && fs.existsSync(templatePath)) {
  fs.copyFileSync(templatePath, remotePath);
}

let config = {
  USE_REMOTE_SHARED: false,
  REMOTE_MOMENTS_URL: "https://YOUR_PROJECT_REF.supabase.co/functions/v1/moments",
  REMOTE_CLIMATE_URL: "https://YOUR_PROJECT_REF.supabase.co/functions/v1/climate",
  REMOTE_ANON_KEY: "",
};

if (fs.existsSync(localPath)) {
  try {
    const local = require(localPath);
    if (local.USE_REMOTE_SHARED !== undefined) config.USE_REMOTE_SHARED = Boolean(local.USE_REMOTE_SHARED);
    if (local.REMOTE_MOMENTS_URL) config.REMOTE_MOMENTS_URL = String(local.REMOTE_MOMENTS_URL);
    if (local.REMOTE_CLIMATE_URL) config.REMOTE_CLIMATE_URL = String(local.REMOTE_CLIMATE_URL);
    if (local.REMOTE_ANON_KEY !== undefined) config.REMOTE_ANON_KEY = String(local.REMOTE_ANON_KEY || "");
  } catch (e) {
    console.warn("Warning: could not load remote.local.js:", e.message);
  }
}

if (process.env.REMOTE_MOMENTS_URL) config.REMOTE_MOMENTS_URL = String(process.env.REMOTE_MOMENTS_URL || "").trim();
if (process.env.REMOTE_CLIMATE_URL) config.REMOTE_CLIMATE_URL = String(process.env.REMOTE_CLIMATE_URL || "").trim();
if (process.env.REMOTE_ANON_KEY !== undefined) config.REMOTE_ANON_KEY = String(process.env.REMOTE_ANON_KEY || "").trim();
if (process.env.USE_REMOTE_SHARED !== undefined) config.USE_REMOTE_SHARED = process.env.USE_REMOTE_SHARED === "true" || process.env.USE_REMOTE_SHARED === "1";

// Quita espacios/saltos de línea al pegar secrets y escapa caracteres que romperían el JS
function trimSecret(s) {
  return String(s ?? "").trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
function escape(str) {
  const s = trimSecret(str);
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

const relateUrl = config.REMOTE_MOMENTS_URL
  ? config.REMOTE_MOMENTS_URL.replace(/\/moments\/?$/, "/relate")
  : "";
const textResonanceUrl = config.REMOTE_MOMENTS_URL
  ? config.REMOTE_MOMENTS_URL.replace(/\/moments\/?$/, "/text-resonance")
  : "";
const configBlock = `// Generated or edited locally. Do not commit real values. See README and remote.local.js.example.
const USE_REMOTE_SHARED = ${config.USE_REMOTE_SHARED};
const REMOTE_MOMENTS_URL = "${escape(config.REMOTE_MOMENTS_URL)}";
const REMOTE_CLIMATE_URL = "${escape(config.REMOTE_CLIMATE_URL)}";
const REMOTE_RELATE_URL = "${escape(relateUrl)}";
const REMOTE_TEXT_RESONANCE_URL = "${escape(textResonanceUrl)}";
const REMOTE_ANON_KEY = "${escape(config.REMOTE_ANON_KEY)}";
`;

if (!fs.existsSync(remotePath)) {
  console.error("remote.js not found. Create it from remote.js.template or run from repo root.");
  process.exit(1);
}
let content = fs.readFileSync(remotePath, "utf8");
const lines = content.split("\n");
let end = 0;
for (let i = 0; i < lines.length; i++) {
  if (/^const REMOTE_ANON_KEY\s*=/.test(lines[i])) {
    end = i + 1;
    break;
  }
}
if (end === 0) {
  console.error("Could not find config block in remote.js");
  process.exit(1);
}
const rest = lines.slice(end).join("\n");
fs.writeFileSync(remotePath, configBlock + "\n" + rest, "utf8");
console.log("remote.js updated from", fs.existsSync(localPath) ? "remote.local.js" : "env/placeholders");

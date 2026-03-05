import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const DEFAULT_WINDOW_HOURS = 48;
const MAX_WINDOW_HOURS = 168;
const MAX_NOTE_LENGTH = 19;
const MAX_GEO_BUCKET_LENGTH = 64;
const NOTE_SIGNAL_CAP = 0.16;
const BUCKET_MINUTES = 5;
const GEO_INDEX_MAX = parseInt(Deno.env.get("MOMENTS_GEO_INDEX_MAX") ?? "4000", 10);

const RATE_WINDOW_SECONDS = parseInt(Deno.env.get("MOMENTS_WINDOW_SECONDS") ?? "60", 10);
const MOMENTS_GET_MAX = parseInt(Deno.env.get("MOMENTS_GET_MAX") ?? "240", 10);
const MOMENTS_POST_MAX = parseInt(Deno.env.get("MOMENTS_POST_MAX") ?? "20", 10);
const RATE_LIMIT_SALT = Deno.env.get("RATE_LIMIT_SALT") ?? "slipup-moments";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_TYPES = new Set(["avoidable", "fertile", "observed"]);
const ALLOWED_MOODS = new Set(["calm", "focus", "stressed", "curious", "tired"]);
const REFLECTIVE_TOKENS = [
  "reflect",
  "noticed",
  "learn",
  "learned",
  "lesson",
  "pause",
  "adjust",
  "again",
  "next",
  "aware",
  "observe",
  "chose",
  "choice",
  "calm",
  "breathe",
  "intent",
  "reflex",
  "aprend",
  "leccion",
  "pausa",
  "ajust",
  "proxima",
  "siguiente",
  "consciente",
  "observo",
  "elegi",
  "eleccion",
  "calma",
  "respir",
  "intencion",
];
const REACTIVE_TOKENS = [
  "rush",
  "late",
  "panic",
  "angry",
  "stuck",
  "again!",
  "always",
  "never",
  "chaos",
  "overwhelm",
  "noise",
  "blame",
  "fight",
  "explode",
  "prisa",
  "tarde",
  "panico",
  "enoj",
  "atasc",
  "siempre",
  "nunca",
  "caos",
  "ruido",
  "culpa",
  "pelea",
  "explot",
];

type JsonRecord = Record<string, unknown>;

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pickCorsOrigin(origin: string | null) {
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  if (!origin) return ALLOWED_ORIGINS[0] ?? "*";
  return ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? "*");
}

function makeHeaders(origin: string | null, extra: Record<string, string> = {}) {
  const allowed = pickCorsOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-slipup-fp,x-slipup-geo,x-requested-with",
    "Access-Control-Max-Age": "86400",
    ...(allowed !== "*" ? { Vary: "Origin" } : {}),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=20",
    ...extra,
  };
}

function json(origin: string | null, status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: makeHeaders(origin, extra) });
}

function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) throw new Error("Missing Supabase secrets");
  return createClient(url, serviceKey, {
    global: { headers: { "x-client-info": "slipup-edge-moments/1.0" } },
  });
}

function getClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

async function sha256Base64Url(input: string) {
  const bytes = new TextEncoder().encode(input);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  let binary = "";
  for (let i = 0; i < hash.length; i += 1) binary += String.fromCharCode(hash[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function consumeRateLimit(
  supabase: ReturnType<typeof createClient>,
  keyHash: string,
  maxHits: number,
  windowSeconds: number
) {
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_key: keyHash,
    p_window_seconds: windowSeconds,
    p_max: maxHits,
  });

  if (error) {
    console.warn("consume_rate_limit RPC unavailable:", error.message);
    return { allowed: true, remaining: maxHits, reset_at: null as string | null };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(row?.allowed),
    remaining: Number(row?.remaining ?? 0),
    reset_at: row?.reset_at ?? null,
  };
}

function retryAfterSeconds(resetAt: string | null) {
  if (!resetAt) return "60";
  const delta = Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000);
  return String(Math.max(1, delta));
}

function normalizeScope(raw: string | null) {
  if (raw === "all") return "all";
  if (raw === "geo_index") return "geo_index";
  return "shared";
}

function normalizeGeoBucket(raw: string | null) {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_GEO_BUCKET_LENGTH);
}

function normalizeContinent(raw: string | null) {
  const cleaned = String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .trim();
  return cleaned || "";
}

function normalizeNote(input: unknown) {
  return String(input ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NOTE_LENGTH);
}

function parseClientDay(input: unknown) {
  const value = String(input ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function parseTimestamp(input: unknown) {
  const value = String(input ?? "").trim();
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function roundToBucketStart(iso: string) {
  const date = new Date(iso);
  const ms = date.getTime();
  const bucketMs = BUCKET_MINUTES * 60_000;
  return new Date(Math.floor(ms / bucketMs) * bucketMs).toISOString();
}

function noteSignal(note: string) {
  const text = String(note || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!text) return { reflective: 0, reactive: 0 };

  let reflective = 0;
  let reactive = 0;
  REFLECTIVE_TOKENS.forEach((token) => {
    if (text.includes(token)) reflective += 1;
  });
  REACTIVE_TOKENS.forEach((token) => {
    if (text.includes(token)) reactive += 1;
  });

  return {
    reflective: Math.min(reflective / 2.5, NOTE_SIGNAL_CAP),
    reactive: Math.min(reactive / 2.5, NOTE_SIGNAL_CAP),
  };
}

function parseBody(payload: JsonRecord) {
  const type = String(payload.type ?? "");
  const mood = String(payload.mood ?? "");
  if (!ALLOWED_TYPES.has(type)) return { error: "invalid_type" as const };
  if (!ALLOWED_MOODS.has(mood)) return { error: "invalid_mood" as const };

  const note = normalizeNote(payload.note);
  if (!note) return { error: "note_required" as const };

  const timestamp = parseTimestamp(payload.timestamp);
  if (!timestamp) return { error: "invalid_timestamp" as const };

  const shared = Boolean(payload.shared);
  const clientDay = parseClientDay(payload.client_day);
  const geoBucket = normalizeGeoBucket(
    typeof payload.geo_bucket === "string" ? payload.geo_bucket : ""
  );

  return {
    value: {
      timestamp,
      type,
      mood,
      note,
      shared,
      hidden: false,
      client_day: clientDay,
      geo_bucket: geoBucket || null,
    },
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: makeHeaders(origin) });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json(origin, 405, { error: "method_not_allowed" });
  }

  let supabase;
  try {
    supabase = supabaseAdmin();
  } catch {
    return json(origin, 500, { error: "server_misconfigured" });
  }

  const ip = getClientIp(req);
  const fp = req.headers.get("x-slipup-fp") ?? "";
  const bucketKey = req.method === "POST" ? "moments:post" : "moments:get";
  const rateMax = req.method === "POST" ? MOMENTS_POST_MAX : MOMENTS_GET_MAX;
  const keyHash = await sha256Base64Url(`${RATE_LIMIT_SALT}|${bucketKey}|${ip}|${fp}`);
  const rl = await consumeRateLimit(supabase, `${bucketKey}:${keyHash}`, rateMax, RATE_WINDOW_SECONDS);
  if (!rl.allowed) {
    return json(
      origin,
      429,
      { error: "rate_limited", message: "Too many requests", reset_at: rl.reset_at },
      { "Retry-After": retryAfterSeconds(rl.reset_at) }
    );
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const limit = clampInt(parseInt(url.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10), 1, MAX_LIMIT);
    const windowHours = clampInt(
      parseInt(url.searchParams.get("windowHours") ?? `${DEFAULT_WINDOW_HOURS}`, 10),
      1,
      MAX_WINDOW_HOURS
    );
    const scope = normalizeScope(url.searchParams.get("scope"));
    const now = new Date();
    const start = new Date(now.getTime() - windowHours * 3600_000);

    if (scope === "geo_index") {
      const geoLimit = clampInt(
        parseInt(url.searchParams.get("geoLimit") ?? "2000", 10),
        1,
        GEO_INDEX_MAX
      );
      const continent = normalizeContinent(url.searchParams.get("continent"));

      let geoQuery = supabase
        .from("moments")
        .select("geo_bucket,timestamp")
        .eq("shared", true)
        .eq("hidden", false)
        .not("geo_bucket", "is", null)
        .gte("timestamp", start.toISOString())
        .lte("timestamp", now.toISOString())
        .order("timestamp", { ascending: false })
        .limit(geoLimit);

      if (continent) {
        geoQuery = geoQuery.like("geo_bucket", `tz.${continent}.%`);
      }

      const { data, error } = await geoQuery;
      if (error) return json(origin, 500, { error: "db_error" });

      const rows = Array.isArray(data) ? data : [];
      const geoBuckets = new Map<string, string>();
      const countries = new Map<string, { continent: string; country: string; count: number; lastSeen: string }>();
      const continents = new Set<string>();

      rows.forEach((row) => {
        const geo = String(row?.geo_bucket ?? "").toLowerCase();
        const ts = String(row?.timestamp ?? "");
        if (!geo.startsWith("tz.")) return;
        if (!geoBuckets.has(geo)) geoBuckets.set(geo, ts);

        const parts = geo.split(".").filter(Boolean);
        const cont = parts[1] || "";
        if (!cont) return;
        continents.add(cont);
        const country = parts[2] || "";
        if (!country) return;
        const key = `${cont}.${country}`;
        const current = countries.get(key);
        if (!current) {
          countries.set(key, { continent: cont, country, count: 1, lastSeen: ts });
          return;
        }
        current.count += 1;
        if (ts && (!current.lastSeen || ts > current.lastSeen)) current.lastSeen = ts;
      });

      return json(origin, 200, {
        scope,
        windowHours,
        geoCount: geoBuckets.size,
        continents: Array.from(continents).sort(),
        countries: Array.from(countries.values()).sort((a, b) => b.count - a.count),
      });
    }

    let query = supabase
      .from("moments")
      .select("id,timestamp,created_at,client_day,type,mood,note,shared,hidden")
      .eq("hidden", false)
      .gte("timestamp", start.toISOString())
      .lte("timestamp", now.toISOString())
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (scope === "shared") {
      query = query.eq("shared", true);
    }

    const { data, error } = await query;
    if (error) return json(origin, 500, { error: "db_error" });

    return json(origin, 200, {
      moments: data ?? [],
      scope,
      windowHours,
      limit,
    });
  }

  let payload: JsonRecord;
  try {
    payload = (await req.json()) as JsonRecord;
  } catch {
    return json(origin, 422, { error: "invalid_json" });
  }

  const parsed = parseBody(payload);
  if ("error" in parsed) {
    return json(origin, 422, { error: parsed.error });
  }

  const headerGeo = normalizeGeoBucket(req.headers.get("x-slipup-geo"));
  const row = {
    ...parsed.value,
    geo_bucket: parsed.value.geo_bucket || headerGeo || null,
  };

  const { data, error } = await supabase.from("moments").insert(row).select("id,timestamp").single();
  if (error) return json(origin, 500, { error: "db_error" });

  // Increment scalable 5-minute buckets for shared moments.
  if (row.shared) {
    const signal = noteSignal(row.note);
    const bucketStart = roundToBucketStart(row.timestamp);

    const consume = async (bucketGeo: string | null) =>
      supabase.rpc("consume_climate_bucket", {
        p_bucket_start: bucketStart,
        p_geo_bucket: bucketGeo,
        p_type: row.type,
        p_mood: row.mood,
        p_reflective: signal.reflective,
        p_reactive: signal.reactive,
      });

    // Global bucket (null geo) + optional regional bucket.
    const globalResult = await consume(null);
    if (globalResult.error) {
      console.warn("consume_climate_bucket global unavailable:", globalResult.error.message);
    }
    if (row.geo_bucket) {
      const localResult = await consume(row.geo_bucket);
      if (localResult.error) {
        console.warn("consume_climate_bucket local unavailable:", localResult.error.message);
      }
    }
  }

  return json(origin, 201, { ok: true, moment: data });
});

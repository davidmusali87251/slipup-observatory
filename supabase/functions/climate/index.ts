import { createClient } from "npm:@supabase/supabase-js@2";
import { computeClimate } from "../_shared/computeClimate.ts";

const DEFAULT_WINDOW_HOURS = 48;
const MAX_WINDOW_HOURS = 168;
const MAX_GEO_BUCKET_LENGTH = 64;
const LOCAL_MIN_MASS = parseInt(Deno.env.get("LOCAL_MIN_MASS") ?? "30", 10);

const RATE_WINDOW_SECONDS = parseInt(Deno.env.get("CLIMATE_GET_WINDOW_SECONDS") ?? "60", 10);
const CLIMATE_GET_MAX = parseInt(Deno.env.get("CLIMATE_GET_MAX") ?? "180", 10);
const RATE_LIMIT_SALT = Deno.env.get("RATE_LIMIT_SALT") ?? "slipup-climate";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeScope(raw: string | null) {
  return raw === "local" ? "local" : "global";
}

function normalizeGeoBucket(raw: string | null) {
  if (!raw) return "";
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_GEO_BUCKET_LENGTH);
  return normalized;
}

function geoCandidates(geo: string) {
  if (!geo) return [];
  const segments = geo.split(".").filter(Boolean);
  // Start from a broader regional level when we have a city-like suffix.
  // Example: tz.america.argentina.buenos-aires -> start at tz.america.argentina
  const startLength = segments.length >= 4 ? segments.length - 1 : segments.length;
  const buckets: string[] = [];
  for (let i = startLength; i >= 1; i -= 1) {
    buckets.push(segments.slice(0, i).join("."));
  }
  return buckets;
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
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-slipup-fp,x-requested-with",
    "Access-Control-Max-Age": "86400",
    ...(allowed !== "*" ? { Vary: "Origin" } : {}),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=30",
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
    global: { headers: { "x-client-info": "slipup-edge-climate/1.0" } },
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

async function fetchGlobalMoments(
  supabase: ReturnType<typeof createClient>,
  startIso: string,
  endIso: string
) {
  return supabase
    .from("moments")
    .select("timestamp,type,mood,note")
    .eq("shared", true)
    .eq("hidden", false)
    .gte("timestamp", startIso)
    .lte("timestamp", endIso);
}

async function fetchLocalMoments(
  supabase: ReturnType<typeof createClient>,
  geoBucket: string,
  startIso: string,
  endIso: string
) {
  return supabase
    .from("moments")
    .select("timestamp,type,mood,note")
    .eq("shared", true)
    .eq("hidden", false)
    .eq("geo_bucket", geoBucket)
    .gte("timestamp", startIso)
    .lte("timestamp", endIso);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: makeHeaders(origin) });
  }

  if (req.method !== "GET") {
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
  const keyHash = await sha256Base64Url(`${RATE_LIMIT_SALT}|${ip}|${fp}`);
  const rl = await consumeRateLimit(supabase, `climate:get:${keyHash}`, CLIMATE_GET_MAX, RATE_WINDOW_SECONDS);
  if (!rl.allowed) {
    return json(
      origin,
      429,
      { error: "rate_limited", message: "Too many requests", reset_at: rl.reset_at },
      { "Retry-After": retryAfterSeconds(rl.reset_at) }
    );
  }

  const url = new URL(req.url);
  const windowHours = clampInt(
    parseInt(url.searchParams.get("windowHours") ?? `${DEFAULT_WINDOW_HOURS}`, 10),
    1,
    MAX_WINDOW_HOURS
  );
  const referenceParam = url.searchParams.get("referenceTime") ?? "";
  const scope = normalizeScope(url.searchParams.get("scope"));
  const requestedGeo = normalizeGeoBucket(url.searchParams.get("geo"));
  const referenceTime = referenceParam ? new Date(referenceParam) : new Date();
  if (Number.isNaN(referenceTime.getTime())) {
    return json(origin, 422, { error: "invalid_reference_time" });
  }

  const start = new Date(referenceTime.getTime() - windowHours * 3600_000);
  const startIso = start.toISOString();
  const endIso = referenceTime.toISOString();

  if (scope === "local") {
    const candidates = geoCandidates(requestedGeo);
    for (const candidate of candidates) {
      const { data, error } = await fetchLocalMoments(supabase, candidate, startIso, endIso);
      if (error) return json(origin, 500, { error: "db_error" });
      const rows = data ?? [];
      if (rows.length >= LOCAL_MIN_MASS) {
        const climate = computeClimate(rows, referenceTime.toISOString(), windowHours);
        return json(origin, 200, {
          ...climate,
          source: "local",
          requestedGeo,
          geoBucketUsed: candidate,
          minRequired: LOCAL_MIN_MASS,
        });
      }
    }
  }

  const { data, error } = await fetchGlobalMoments(supabase, startIso, endIso);
  if (error) return json(origin, 500, { error: "db_error" });

  const climate = computeClimate(data ?? [], referenceTime.toISOString(), windowHours);
  return json(origin, 200, {
    ...climate,
    source: scope === "local" ? "global_fallback" : "global",
    requestedGeo: scope === "local" ? requestedGeo : "",
    geoBucketUsed: scope === "local" ? "global" : "",
    minRequired: scope === "local" ? LOCAL_MIN_MASS : undefined,
  });
});

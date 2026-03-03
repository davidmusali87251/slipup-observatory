import { createClient } from "npm:@supabase/supabase-js@2";

const TYPES = new Set(["avoidable", "fertile", "observed"]);
const MOODS = new Set(["calm", "focus", "stressed", "curious", "tired"]);
const BLOCKLIST = new Set(["http://", "https://", ".com", ".net", "@"]);

const DEFAULT_WINDOW_HOURS = 48;
const MAX_WINDOW_HOURS = 168;
const DEFAULT_PREVIEW_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_BODY_BYTES = 2048;

const RATE_WINDOW_SECONDS = parseInt(Deno.env.get("RATE_WINDOW_SECONDS") ?? "60", 10);
const POST_PER_WINDOW = parseInt(Deno.env.get("POST_PER_WINDOW") ?? "10", 10);
const GET_PER_WINDOW = parseInt(Deno.env.get("GET_PER_WINDOW") ?? "120", 10);

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-slipup-fp,x-requested-with",
    "Access-Control-Max-Age": "86400",
    ...(allowed !== "*" ? { Vary: "Origin" } : {}),
    "Content-Type": "application/json; charset=utf-8",
    ...extra,
  };
}

function json(origin: string | null, status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: makeHeaders(origin, extra) });
}

function normalizeNote(input: unknown) {
  return String(input ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 19);
}

function parseISODateOnly(input: unknown): string | null {
  if (typeof input !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : null;
}

function parseTimestampUtc(input: unknown, now: Date): Date {
  if (typeof input !== "string") return now;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return now;

  const nowMs = now.getTime();
  const minMs = nowMs - 72 * 3600_000;
  const maxMs = nowMs + 5 * 60_000;
  const ts = parsed.getTime();
  if (ts < minMs || ts > maxMs) return now;
  return parsed;
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

async function readJsonBody(req: Request) {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) {
    return { ok: false as const, reason: "payload_too_large" };
  }
  try {
    return { ok: true as const, value: text ? JSON.parse(text) : null };
  } catch {
    return { ok: false as const, reason: "invalid_json" };
  }
}

function hasBlockedContent(note: string) {
  const n = note.toLowerCase();
  for (const token of BLOCKLIST) {
    if (n.includes(token)) return true;
  }
  return false;
}

function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) throw new Error("Missing Supabase secrets");
  return createClient(url, serviceKey, {
    global: { headers: { "x-client-info": "slipup-edge-moments/1.0" } },
  });
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

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: makeHeaders(origin) });
  }

  let supabase;
  try {
    supabase = supabaseAdmin();
  } catch {
    return json(origin, 500, { error: "server_misconfigured" });
  }

  const ip = getClientIp(req);
  const fp = req.headers.get("x-slipup-fp") ?? "";
  const keyHash = await sha256Base64Url(`${ip}|${fp}`);

  if (req.method === "GET") {
    const rl = await consumeRateLimit(supabase, `get:${keyHash}`, GET_PER_WINDOW, RATE_WINDOW_SECONDS);
    if (!rl.allowed) {
      return json(
        origin,
        429,
        { error: "rate_limited", message: "Too many requests", reset_at: rl.reset_at },
        { "Retry-After": retryAfterSeconds(rl.reset_at) }
      );
    }

    const url = new URL(req.url);
    const limit = clampInt(parseInt(url.searchParams.get("limit") ?? `${DEFAULT_PREVIEW_LIMIT}`, 10), 1, MAX_LIMIT);
    const windowHours = clampInt(
      parseInt(url.searchParams.get("windowHours") ?? `${DEFAULT_WINDOW_HOURS}`, 10),
      1,
      MAX_WINDOW_HOURS
    );
    const now = new Date();
    const start = new Date(now.getTime() - windowHours * 3600_000);

    const { data, error } = await supabase
      .from("moments")
      .select("id,timestamp,type,mood,note,shared")
      .eq("shared", true)
      .eq("hidden", false)
      .gte("timestamp", start.toISOString())
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) return json(origin, 500, { error: "db_error" });

    return json(origin, 200, {
      referenceTime: now.toISOString(),
      windowHours,
      limit,
      moments: data ?? [],
    });
  }

  if (req.method === "POST") {
    const rl = await consumeRateLimit(supabase, `post:${keyHash}`, POST_PER_WINDOW, RATE_WINDOW_SECONDS);
    if (!rl.allowed) {
      return json(
        origin,
        429,
        {
          error: "rate_limited",
          message: "Shared channel is temporarily busy",
          reset_at: rl.reset_at,
        },
        { "Retry-After": retryAfterSeconds(rl.reset_at) }
      );
    }

    const bodyResult = await readJsonBody(req);
    if (!bodyResult.ok) {
      if (bodyResult.reason === "payload_too_large") {
        return json(origin, 413, { error: "payload_too_large" });
      }
      return json(origin, 400, { error: "invalid_json" });
    }

    const body = bodyResult.value;
    if (!body || typeof body !== "object") return json(origin, 400, { error: "invalid_json" });

    const type = body.type;
    const mood = body.mood;
    const shared = body.shared ?? true;
    const note = normalizeNote(body.note);
    const clientDay = parseISODateOnly(body.client_day);
    const now = new Date();
    const timestamp = parseTimestampUtc(body.timestamp, now).toISOString();

    if (!TYPES.has(type)) return json(origin, 422, { error: "invalid_type" });
    if (!MOODS.has(mood)) return json(origin, 422, { error: "invalid_mood" });
    if (typeof shared !== "boolean") return json(origin, 422, { error: "invalid_shared" });
    if (note.length === 0) return json(origin, 422, { error: "invalid_note" });
    if (hasBlockedContent(note)) return json(origin, 422, { error: "note_rejected" });

    const insertPayload: Record<string, unknown> = {
      timestamp,
      type,
      mood,
      note,
      shared,
      hidden: false,
      ...(clientDay ? { client_day: clientDay } : {}),
    };

    const { data, error } = await supabase
      .from("moments")
      .insert(insertPayload)
      .select("id,timestamp,type,mood,note,shared")
      .single();
    if (error) return json(origin, 500, { error: "db_error" });

    return json(origin, 201, { moment: data });
  }

  return json(origin, 405, { error: "method_not_allowed" });
});

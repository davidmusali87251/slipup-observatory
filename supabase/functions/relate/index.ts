import { createClient } from "npm:@supabase/supabase-js@2";

const RELATE_RATE_MAX = parseInt(Deno.env.get("RELATE_RATE_MAX") ?? "30", 10);
const RATE_WINDOW_SECONDS = parseInt(Deno.env.get("MOMENTS_WINDOW_SECONDS") ?? "60", 10);
const RATE_LIMIT_SALT = Deno.env.get("RATE_LIMIT_SALT") ?? "slipup-moments";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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
      "authorization,apikey,content-type,x-slipup-fp,x-requested-with",
    "Access-Control-Max-Age": "86400",
    ...(allowed !== "*" ? { Vary: "Origin" } : {}),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extra,
  };
}

function json(origin: string | null, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: makeHeaders(origin) });
}

function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) throw new Error("Missing Supabase secrets");
  return createClient(url, serviceKey, {
    global: { headers: { "x-client-info": "slipup-edge-relate/1.0" } },
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(s: string) {
  return typeof s === "string" && UUID_REGEX.test(s.trim());
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: makeHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json(origin, 405, { error: "method_not_allowed" });
  }

  let supabase;
  try {
    supabase = supabaseAdmin();
  } catch {
    return json(origin, 500, { error: "server_misconfigured" });
  }

  const fp = (req.headers.get("x-slipup-fp") ?? "").trim().slice(0, 256);
  if (!fp) {
    return json(origin, 400, { error: "missing_fingerprint", message: "x-slipup-fp header required" });
  }

  let body: { moment_id?: string };
  try {
    body = (await req.json()) as { moment_id?: string };
  } catch {
    return json(origin, 422, { error: "invalid_json" });
  }

  const momentId = typeof body?.moment_id === "string" ? body.moment_id.trim() : "";
  if (!momentId || !isValidUuid(momentId)) {
    return json(origin, 422, { error: "invalid_moment_id" });
  }

  const { data: existing } = await supabase
    .from("moments")
    .select("id")
    .eq("id", momentId)
    .eq("hidden", false)
    .maybeSingle();

  if (!existing) {
    return json(origin, 404, { error: "moment_not_found" });
  }

  await supabase
    .from("moment_relates")
    .upsert(
      { moment_id: momentId, visitor_fp: fp },
      { onConflict: "moment_id,visitor_fp", doNothing: true }
    );

  const { count, error: countError } = await supabase
    .from("moment_relates")
    .select("*", { count: "exact", head: true })
    .eq("moment_id", momentId);

  if (countError) {
    return json(origin, 500, { error: "db_error" });
  }

  return json(origin, 200, { ok: true, count: typeof count === "number" ? count : 0 });
});

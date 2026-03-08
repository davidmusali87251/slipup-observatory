import { createClient } from "npm:@supabase/supabase-js@2";
import { computeClimate, conditionForDegree } from "../_shared/computeClimate.ts";
import {
  BASELINE,
  SCALE,
  RECENCY_HALFLIFE_HOURS,
  RESPONSE_AMPLITUDE,
  INFLUENCE,
  chooseAlpha,
  WARMUP_MASS_THRESHOLD,
  PRESSURE_NORMALIZER_SQRT_COEF,
  PRESSURE_NORMALIZER_OFFSET,
  TANH_SENSITIVITY,
  STABILIZE_DAMPING_MIN,
  STABILIZE_DAMPING_MAX,
  REPETITION_FIELD_MASS_DIVISOR,
  REPETITION_NUDGE_FACTOR,
  REPETITION_NUDGE_MAX,
  REPETITION_DAMPING_MIN,
  REPETITION_DAMPING_MAX,
  SINGLE_MOMENT_DEGREE_DELTA,
  PATTERN_A_STRENGTH_BASE,
  PATTERN_A_STRENGTH_RATE,
  PATTERN_A_STRENGTH_MIN,
  PATTERN_A_STRENGTH_MAX,
  PATTERN_B_STRENGTH_BASE,
  PATTERN_B_STRENGTH_RATE,
  PATTERN_B_STRENGTH_MIN,
  PATTERN_B_STRENGTH_MAX,
  PATTERN_C_STRENGTH,
  STABILITY_OBSERVED_WEIGHT,
  STABILITY_CALM_FOCUS_WEIGHT,
  GROUND_AVOIDABLE_WEIGHT,
  GROUND_FERTILE_WEIGHT,
  MASS_INERTIA_REF,
  PRESSURE_MODE_CONDENSING_DELTA,
  PRESSURE_MODE_CLEARING_DELTA,
} from "../_shared/modelConstants.ts";

const DEFAULT_WINDOW_HOURS = 48;
const MAX_WINDOW_HOURS = 168;
const MAX_GEO_BUCKET_LENGTH = 64;
const LOCAL_MIN_MASS = parseInt(Deno.env.get("LOCAL_MIN_MASS") ?? "30", 10);
const USE_BUCKETS = (Deno.env.get("CLIMATE_USE_BUCKETS") ?? "true").toLowerCase() !== "false";

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

type BucketRow = {
  bucket_start: string;
  shared_count: number;
  reflective_sum: number;
  reactive_sum: number;
  avoidable_calm: number;
  avoidable_focus: number;
  avoidable_stressed: number;
  avoidable_curious: number;
  avoidable_tired: number;
  fertile_calm: number;
  fertile_focus: number;
  fertile_stressed: number;
  fertile_curious: number;
  fertile_tired: number;
  observed_calm: number;
  observed_focus: number;
  observed_stressed: number;
  observed_curious: number;
  observed_tired: number;
};

const COMBO_KEYS: Array<[string, string, keyof BucketRow]> = [
  ["avoidable", "calm", "avoidable_calm"],
  ["avoidable", "focus", "avoidable_focus"],
  ["avoidable", "stressed", "avoidable_stressed"],
  ["avoidable", "curious", "avoidable_curious"],
  ["avoidable", "tired", "avoidable_tired"],
  ["fertile", "calm", "fertile_calm"],
  ["fertile", "focus", "fertile_focus"],
  ["fertile", "stressed", "fertile_stressed"],
  ["fertile", "curious", "fertile_curious"],
  ["fertile", "tired", "fertile_tired"],
  ["observed", "calm", "observed_calm"],
  ["observed", "focus", "observed_focus"],
  ["observed", "stressed", "observed_stressed"],
  ["observed", "curious", "observed_curious"],
  ["observed", "tired", "observed_tired"],
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function recencyMass(ageHours: number) {
  return Math.pow(0.5, ageHours / RECENCY_HALFLIFE_HOURS);
}

function signedPressure(mode: "condense" | "clear" | "stabilize", strength: number) {
  if (mode === "condense") return strength;
  if (mode === "clear") return -strength;
  return 0;
}

function derivePressureMode(computedDegree: number, repetition: { hasPattern: boolean; tag: string }) {
  const delta = computedDegree - BASELINE;
  if (repetition?.hasPattern && repetition?.tag === "pattern_a") return "condensing";
  if (delta >= PRESSURE_MODE_CONDENSING_DELTA) return "condensing";
  if (delta <= PRESSURE_MODE_CLEARING_DELTA) return "clearing";
  return "stabilizing";
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
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-slipup-fp,x-slipup-geo,x-requested-with",
    "Access-Control-Max-Age": "86400",
    ...(allowed !== "*" ? { Vary: "Origin" } : {}),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=30",
    ...extra,
  };
}
// Cache 15–30s for /climate at scale; reduces jitter and cost.

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

async function fetchBucketRows(
  supabase: ReturnType<typeof createClient>,
  geoBucket: string | null,
  startIso: string,
  endIso: string
) {
  let query = supabase
    .from("climate_5m_bucket")
    .select(
      "bucket_start,shared_count,reflective_sum,reactive_sum,avoidable_calm,avoidable_focus,avoidable_stressed,avoidable_curious,avoidable_tired,fertile_calm,fertile_focus,fertile_stressed,fertile_curious,fertile_tired,observed_calm,observed_focus,observed_stressed,observed_curious,observed_tired"
    )
    .gte("bucket_start", startIso)
    .lte("bucket_start", endIso)
    .order("bucket_start", { ascending: true });
  query = geoBucket === null ? query.is("geo_bucket", null) : query.eq("geo_bucket", geoBucket);
  return query;
}

function computeFromBuckets(rows: BucketRow[], referenceIso: string, windowHours: number) {
  if (!rows.length) return null;
  const referenceTime = new Date(referenceIso);
  let atmosphericPressure = 0;
  let fieldMass = 0;
  let stabilizeMass = 0;
  let total = 0;
  let avoidableStressedTotal = 0;
  const avoidableMoodTotals = { calm: 0, focus: 0, stressed: 0, curious: 0, tired: 0 };
  let hasCluster = false;
  const comboCounts = new Map<string, number>();
  let observedTotal = 0;
  let calmFocusTotal = 0;
  let avoidableTotal = 0;
  let fertileTotal = 0;

  rows.forEach((raw) => {
    const row = raw as BucketRow;
    const bucketTs = new Date(row.bucket_start).getTime();
    const ageHours = Math.max(0, (referenceTime.getTime() - bucketTs) / 3600_000);
    const mass = recencyMass(ageHours);
    const bucketCount = Number(row.shared_count || 0);
    if (bucketCount <= 0) return;
    total += bucketCount;
    fieldMass += bucketCount * mass;
    atmosphericPressure += (Number(row.reactive_sum || 0) - Number(row.reflective_sum || 0)) * mass;
    stabilizeMass += Number(row.reflective_sum || 0) * 0.75 * mass;

    let bucketAvoidable = 0;
    COMBO_KEYS.forEach(([type, mood, key]) => {
      const count = Number(row[key] || 0);
      if (count <= 0) return;
      comboCounts.set(`${type}|${mood}`, (comboCounts.get(`${type}|${mood}`) || 0) + count);
      const influence = INFLUENCE[type]?.[mood] ?? { mode: "stabilize", strength: 0.12 };
      atmosphericPressure += signedPressure(influence.mode, influence.strength) * count * mass;
      if (influence.mode === "stabilize") stabilizeMass += influence.strength * count * mass;
      if (type === "avoidable") {
        bucketAvoidable += count;
        avoidableTotal += count;
        avoidableMoodTotals[mood as keyof typeof avoidableMoodTotals] += count;
      } else if (type === "fertile") {
        fertileTotal += count;
      } else if (type === "observed") {
        observedTotal += count;
      }
      if (mood === "calm" || mood === "focus") calmFocusTotal += count;
      if (type === "avoidable" && mood === "stressed") avoidableStressedTotal += count;
    });
    if (bucketCount >= 3 && bucketAvoidable > bucketCount / 2) hasCluster = true;
  });

  const repetition = (() => {
    if (avoidableStressedTotal >= 2) {
      const strength = clamp(
        PATTERN_A_STRENGTH_BASE + (avoidableStressedTotal - 2) * PATTERN_A_STRENGTH_RATE,
        PATTERN_A_STRENGTH_MIN,
        PATTERN_A_STRENGTH_MAX
      );
      return { hasPattern: true, tag: "pattern_a", strength };
    }
    const maxAvoidableMood = Math.max(...Object.values(avoidableMoodTotals));
    if (maxAvoidableMood >= 3) {
      const strength = clamp(
        PATTERN_B_STRENGTH_BASE + (maxAvoidableMood - 3) * PATTERN_B_STRENGTH_RATE,
        PATTERN_B_STRENGTH_MIN,
        PATTERN_B_STRENGTH_MAX
      );
      return { hasPattern: true, tag: "pattern_b", strength };
    }
    if (hasCluster) return { hasPattern: true, tag: "pattern_c", strength: PATTERN_C_STRENGTH };
    return { hasPattern: false, tag: "", strength: 0 };
  })();

  if (total <= 0 || fieldMass <= 0) return null;
  const warmupFactor = Math.min(1, fieldMass / WARMUP_MASS_THRESHOLD);
  const pressureNormalizer = PRESSURE_NORMALIZER_SQRT_COEF * Math.sqrt(fieldMass) + PRESSURE_NORMALIZER_OFFSET;
  const normalizedPressure = atmosphericPressure / pressureNormalizer;
  const stabilizeDamping = clamp(1 - stabilizeMass / (fieldMass + 1), STABILIZE_DAMPING_MIN, STABILIZE_DAMPING_MAX);
  const targetDelta = RESPONSE_AMPLITUDE * Math.tanh(normalizedPressure * TANH_SENSITIVITY) * stabilizeDamping;
  const target = clamp(BASELINE + targetDelta * warmupFactor, 0, SCALE);
  const alpha = chooseAlpha(fieldMass);
  const warmBase = BASELINE + alpha * (target - BASELINE);
  const repetitionDamping = clamp(
    1 / Math.sqrt(1 + fieldMass / REPETITION_FIELD_MASS_DIVISOR),
    REPETITION_DAMPING_MIN,
    REPETITION_DAMPING_MAX
  );
  const repetitionNudge = clamp(repetition.strength * REPETITION_NUDGE_FACTOR * repetitionDamping, 0, REPETITION_NUDGE_MAX);
  let computedDegree = clamp(warmBase + repetitionNudge, 0, SCALE);
  if (total === 1) computedDegree = Math.min(computedDegree, BASELINE + SINGLE_MOMENT_DEGREE_DELTA);
  const deltaFromBaseline = computedDegree - BASELINE;
  const massInertiaFactor = 1 / (1 + Math.sqrt(total) / MASS_INERTIA_REF);
  computedDegree = clamp(BASELINE + deltaFromBaseline * massInertiaFactor, 0, SCALE);

  let dominantMix = "";
  let maxCombo = 0;
  comboCounts.forEach((count, key) => {
    if (count > maxCombo) {
      maxCombo = count;
      dominantMix = key;
    }
  });
  const totalSafe = Math.max(1, total);
  const stabilityIndex = clamp(
    (observedTotal / totalSafe) * STABILITY_OBSERVED_WEIGHT + (calmFocusTotal / totalSafe) * STABILITY_CALM_FOCUS_WEIGHT,
    0,
    1
  );
  const groundIndex = clamp(
    (avoidableTotal / totalSafe) * GROUND_AVOIDABLE_WEIGHT + (fertileTotal / totalSafe) * GROUND_FERTILE_WEIGHT,
    0,
    1
  );
  const pressureMode = derivePressureMode(computedDegree, repetition);
  const toneReading = clamp(50 + 50 * Math.tanh(normalizedPressure * TANH_SENSITIVITY), 0, 100);

  return {
    modelVersion: "v2.2-global-bucket",
    referenceTime: referenceIso,
    windowHours,
    computedDegree,
    total,
    condition: conditionForDegree(computedDegree, total),
    repetition,
    pressureMode,
    toneReading,
    dominantMix,
    stabilityIndex,
    groundIndex,
  };
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

  if (USE_BUCKETS) {
    if (scope === "local") {
      const candidates = geoCandidates(requestedGeo);
      for (const candidate of candidates) {
        const { data, error } = await fetchBucketRows(supabase, candidate, startIso, endIso);
        if (error) break;
        const rows = (data ?? []) as BucketRow[];
        const aggregatedTotal = rows.reduce((acc, row) => acc + Number(row.shared_count || 0), 0);
        if (aggregatedTotal >= LOCAL_MIN_MASS) {
          const climate = computeFromBuckets(rows, referenceTime.toISOString(), windowHours);
          if (climate) {
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
    } else {
      const { data, error } = await fetchBucketRows(supabase, null, startIso, endIso);
      if (!error) {
        const climate = computeFromBuckets((data ?? []) as BucketRow[], referenceTime.toISOString(), windowHours);
        if (climate) {
          return json(origin, 200, {
            ...climate,
            source: "global",
            requestedGeo: "",
            geoBucketUsed: "",
          });
        }
      }
    }
  }

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

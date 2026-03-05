// En repo: placeholders. Local con datos reales: node scripts/generate-remote.js (usa remote.local.js o env).
const USE_REMOTE_SHARED = false;
const REMOTE_MOMENTS_URL = "https://YOUR_PROJECT_REF.supabase.co/functions/v1/moments";
const REMOTE_CLIMATE_URL = "https://YOUR_PROJECT_REF.supabase.co/functions/v1/climate";
const REMOTE_ANON_KEY = "";

const REMOTE_TIMEOUT_MS = 4500;
const FP_STORAGE_KEY = "slipup_v2_fp";
const GEO_BUCKET_KEY = "slipup_v2_geo_bucket";
const GET_CACHE_TTL_MS = 20000;

const ALLOWED_TYPES = new Set(["avoidable", "fertile", "observed"]);
const ALLOWED_MOODS = new Set(["calm", "focus", "stressed", "curious", "tired"]);
const sharedGetCache = new Map();
const climateGetCache = new Map();
const geoIndexCache = new Map();

function withTimeout(signal, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();

  if (signal) {
    if (signal.aborted) controller.abort();
    signal.addEventListener("abort", abort, { once: true });
  }

  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", abort);
    },
  };
}

function normalizeNote(input) {
  return String(input || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 19);
}

function isRemoteReady() {
  return USE_REMOTE_SHARED && REMOTE_MOMENTS_URL.length > 0;
}

function buildHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (REMOTE_ANON_KEY) {
    headers.apikey = REMOTE_ANON_KEY;
    headers.Authorization = `Bearer ${REMOTE_ANON_KEY}`;
  }
  const fp = getOrCreateFingerprint();
  if (fp) headers["x-slipup-fp"] = fp;
  const geo = getClientGeoBucket();
  if (geo) headers["x-slipup-geo"] = geo;
  return headers;
}

function getOrCreateFingerprint() {
  try {
    const current = localStorage.getItem(FP_STORAGE_KEY);
    if (current) return current;
    const created = crypto.randomUUID();
    localStorage.setItem(FP_STORAGE_KEY, created);
    return created;
  } catch {
    return "";
  }
}

function sanitizeBucketPart(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function deriveGeoBucketFromTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (!tz) return "";
    const parts = tz.split("/").map(sanitizeBucketPart).filter(Boolean);
    if (!parts.length) return "";
    return `tz.${parts.join(".")}`.slice(0, 64);
  } catch {
    return "";
  }
}

function getClientGeoBucket() {
  try {
    const current = localStorage.getItem(GEO_BUCKET_KEY);
    if (current) return current;
    const derived = deriveGeoBucketFromTimezone();
    if (derived) localStorage.setItem(GEO_BUCKET_KEY, derived);
    return derived;
  } catch {
    return deriveGeoBucketFromTimezone();
  }
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function sanitizeMoment(raw) {
  const type = ALLOWED_TYPES.has(raw?.type) ? raw.type : "observed";
  const mood = ALLOWED_MOODS.has(raw?.mood) ? raw.mood : "calm";
  const timestamp = raw?.timestamp ? new Date(raw.timestamp).toISOString() : new Date().toISOString();
  return {
    id: raw?.id || crypto.randomUUID(),
    timestamp,
    created_at: raw?.created_at || timestamp,
    client_day: raw?.client_day || null,
    type,
    mood,
    note: normalizeNote(raw?.note),
    shared: Boolean(raw?.shared),
    hidden: Boolean(raw?.hidden),
    geo_bucket: typeof raw?.geo_bucket === "string" ? raw.geo_bucket.trim().slice(0, 64) : null,
  };
}

async function fetchSharedMomentsRemote(limit = 10, windowHours = 48) {
  if (!isRemoteReady()) {
    throw new Error("REMOTE_NOT_READY");
  }

  const cacheKey = `${limit}|${windowHours}`;
  const cached = sharedGetCache.get(cacheKey);
  if (cached && Date.now() - cached.at < GET_CACHE_TTL_MS) {
    return cached.items;
  }

  const url = new URL(REMOTE_MOMENTS_URL);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("windowHours", String(windowHours));
  url.searchParams.set("scope", "shared");

  const scoped = withTimeout(undefined, REMOTE_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: buildHeaders(),
      signal: scoped.signal,
    });
    const payload = await safeJson(response);

    if (!response.ok) {
      const err = new Error("REMOTE_GET_FAILED");
      err.status = response.status;
      err.payload = payload;
      throw err;
    }

    const items = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.moments)
        ? payload.moments
      : Array.isArray(payload?.items)
        ? payload.items
        : [];
    const sanitized = items.map(sanitizeMoment);
    sharedGetCache.set(cacheKey, { at: Date.now(), items: sanitized });
    return sanitized;
  } finally {
    scoped.clear();
  }
}

async function postMomentRemote(inputMoment) {
  if (!isRemoteReady()) {
    return { ok: false, reason: "REMOTE_NOT_READY", status: 0 };
  }

  const payload = {
    type: inputMoment.type,
    mood: inputMoment.mood,
    note: normalizeNote(inputMoment.note),
    shared: Boolean(inputMoment.shared),
    timestamp: inputMoment.timestamp,
    client_day: inputMoment.client_day || null,
    geo_bucket: inputMoment.geo_bucket || getClientGeoBucket() || null,
  };

  const scoped = withTimeout(undefined, REMOTE_TIMEOUT_MS);
  try {
    const response = await fetch(REMOTE_MOMENTS_URL, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(payload),
      signal: scoped.signal,
    });
    const data = await safeJson(response);
    if (!response.ok) {
      return {
        ok: false,
        reason: "REMOTE_POST_FAILED",
        status: response.status,
        data,
      };
    }
    return { ok: true, status: response.status, data };
  } catch {
    return { ok: false, reason: "REMOTE_POST_ERROR", status: 0 };
  } finally {
    scoped.clear();
  }
}

async function fetchClimateRemote(windowHours = 48, referenceTime = "", scope = "global", geo = "") {
  if (!isRemoteReady() || !REMOTE_CLIMATE_URL) {
    throw new Error("REMOTE_CLIMATE_NOT_READY");
  }

  const cacheKey = `${windowHours}|${referenceTime || "now"}|${scope}|${geo}`;
  const cached = climateGetCache.get(cacheKey);
  if (cached && Date.now() - cached.at < GET_CACHE_TTL_MS) {
    return cached.item;
  }

  const url = new URL(REMOTE_CLIMATE_URL);
  url.searchParams.set("windowHours", String(windowHours));
  if (referenceTime) url.searchParams.set("referenceTime", referenceTime);
  if (scope) url.searchParams.set("scope", scope);
  if (geo) url.searchParams.set("geo", geo);

  const scoped = withTimeout(undefined, REMOTE_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: buildHeaders(),
      signal: scoped.signal,
    });
    const payload = await safeJson(response);
    if (!response.ok) {
      const err = new Error("REMOTE_CLIMATE_GET_FAILED");
      err.status = response.status;
      err.payload = payload;
      throw err;
    }

    const item = payload && typeof payload === "object" ? payload : null;
    if (!item) throw new Error("REMOTE_CLIMATE_EMPTY");

    climateGetCache.set(cacheKey, { at: Date.now(), item });
    return item;
  } finally {
    scoped.clear();
  }
}

async function fetchGeoIndexRemote(windowHours = 720, continent = "", geoLimit = 2000) {
  if (!isRemoteReady() || !REMOTE_MOMENTS_URL) {
    throw new Error("REMOTE_GEO_INDEX_NOT_READY");
  }
  const cacheKey = `${windowHours}|${continent}|${geoLimit}`;
  const cached = geoIndexCache.get(cacheKey);
  if (cached && Date.now() - cached.at < GET_CACHE_TTL_MS) {
    return cached.item;
  }

  const url = new URL(REMOTE_MOMENTS_URL);
  url.searchParams.set("scope", "geo_index");
  url.searchParams.set("windowHours", String(windowHours));
  url.searchParams.set("geoLimit", String(geoLimit));
  if (continent) url.searchParams.set("continent", continent);

  const scoped = withTimeout(undefined, REMOTE_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: buildHeaders(),
      signal: scoped.signal,
    });
    const payload = await safeJson(response);
    if (!response.ok) {
      const err = new Error("REMOTE_GEO_INDEX_GET_FAILED");
      err.status = response.status;
      err.payload = payload;
      throw err;
    }
    const item = payload && typeof payload === "object" ? payload : { continents: [], countries: [] };
    geoIndexCache.set(cacheKey, { at: Date.now(), item });
    return item;
  } finally {
    scoped.clear();
  }
}

export {
  USE_REMOTE_SHARED,
  fetchSharedMomentsRemote,
  postMomentRemote,
  fetchClimateRemote,
  fetchGeoIndexRemote,
};

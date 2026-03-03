const USE_REMOTE_SHARED = true;

// Set this to your deployed Supabase Edge Function URL:
// https://<project-ref>.supabase.co/functions/v1/moments
const REMOTE_MOMENTS_URL = "https://ksyfcddiuzrabujflvpb.supabase.co/functions/v1/moments";

// Optional: anon key for gateway rules / protected functions.
const REMOTE_ANON_KEY = "sb_publishable_eDg1bbmJ1N8m9z7Qb4R0rg_ADAqORE7";

const REMOTE_TIMEOUT_MS = 4500;
const FP_STORAGE_KEY = "slipup_v2_fp";
const GET_CACHE_TTL_MS = 20000;

const ALLOWED_TYPES = new Set(["avoidable", "fertile", "observed"]);
const ALLOWED_MOODS = new Set(["calm", "focus", "stressed", "curious", "tired"]);
const sharedGetCache = new Map();

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

export { USE_REMOTE_SHARED, fetchSharedMomentsRemote, postMomentRemote };

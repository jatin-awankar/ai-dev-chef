const DEMO_MODE_ENV_KEY = "FORTIFY_DEMO_MODE";
const DEMO_SPEED_ENV_KEY = "FORTIFY_DEMO_SPEED";
const DEMO_SEED_ENV_KEY = "FORTIFY_DEMO_SEED";
const DEMO_PROFILE_ENV_KEY = "FORTIFY_DEMO_PROFILE";
const SPEEDS = new Set(["fast", "normal", "slow"]);

export function setDemoModeForProcess(enabled) {
  process.env[DEMO_MODE_ENV_KEY] = enabled ? "true" : "false";
}
export function setDemoProfileForProcess(profile) {
  if (!profile) {
    delete process.env[DEMO_PROFILE_ENV_KEY];
    return;
  }
  process.env[DEMO_PROFILE_ENV_KEY] = String(profile).trim().toLowerCase();
}

export function isDemoModeEnabled(env = process.env) {
  const rawValue = env?.[DEMO_MODE_ENV_KEY];
  if (typeof rawValue !== "string") {
    return false;
  }

  const normalized = rawValue.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function getDemoSpeed(env = process.env) {
  const rawValue = env?.[DEMO_SPEED_ENV_KEY];
  if (typeof rawValue !== "string") {
    return "normal";
  }

  const normalized = rawValue.trim().toLowerCase();
  return SPEEDS.has(normalized) ? normalized : "normal";
}

export function getDemoSeed(env = process.env) {
  const rawValue = env?.[DEMO_SEED_ENV_KEY];
  if (typeof rawValue !== "string" || rawValue.trim() === "") {
    return null;
  }

  return rawValue.trim();
}

export function getDemoProfile(env = process.env) {
  const rawValue = env?.[DEMO_PROFILE_ENV_KEY];
  if (typeof rawValue !== "string" || rawValue.trim() === "") {
    return "default";
  }
  return rawValue.trim().toLowerCase();
}

export function createDemoRng(seedInput) {
  const seed = hashStringToUint32(String(seedInput ?? ""));
  let state = seed || 0x6d2b79f5;

  return {
    next() {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

function hashStringToUint32(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

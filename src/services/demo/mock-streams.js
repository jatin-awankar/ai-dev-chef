import { getDemoSpeed } from "./demo-mode.js";

const SPEED_PROFILE = {
  fast: {
    tokenMin: 8,
    tokenMax: 18,
    preludeMin: 55,
    preludeMax: 100,
    phaseMin: 60,
    phaseMax: 120,
  },
  normal: {
    tokenMin: 16,
    tokenMax: 40,
    preludeMin: 90,
    preludeMax: 170,
    phaseMin: 110,
    phaseMax: 240,
  },
  slow: {
    tokenMin: 32,
    tokenMax: 80,
    preludeMin: 150,
    preludeMax: 280,
    phaseMin: 180,
    phaseMax: 380,
  },
};

export async function* streamMockScenario(
  scenario,
  { signal, speed = getDemoSpeed(), rng } = {},
) {
  const profile = SPEED_PROFILE[speed] ?? SPEED_PROFILE.normal;
  const prelude = Array.isArray(scenario?.prelude) ? scenario.prelude : [];
  const streamChunks = Array.isArray(scenario?.stream) ? scenario.stream : [];

  for (const line of prelude) {
    await waitDelay(randomBetween(profile.preludeMin, profile.preludeMax, rng), signal);
    yield {
      type: "text_delta",
      delta: `${line}\n`,
      event: { type: "demo.phase.prelude", phase: "prelude" },
    };
  }

  if (prelude.length > 0) {
    await waitDelay(randomBetween(profile.phaseMin, profile.phaseMax, rng), signal);
    yield {
      type: "text_delta",
      delta: "\n",
      event: { type: "demo.phase.transition", phase: "prelude_to_stream" },
    };
  }

  for (const chunk of streamChunks) {
    await waitDelay(randomBetween(profile.tokenMin, profile.tokenMax, rng), signal);
    yield {
      type: "text_delta",
      delta: chunk,
      event: { type: "demo.phase.stream", phase: "stream" },
    };
  }

  await waitDelay(randomBetween(profile.phaseMin, profile.phaseMax, rng), signal);
  yield {
    type: "text_done",
    text: scenario?.final ?? "",
    event: {
      type: "demo.phase.complete",
      phase: "complete",
      metadata: scenario?.metadata ?? {},
    },
  };
}

function waitDelay(duration, signal) {
  if (signal?.aborted) {
    return Promise.reject(signal.reason ?? new Error("Request aborted."));
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, duration);

    const onAbort = () => {
      clearTimeout(timeoutId);
      cleanup();
      reject(signal.reason ?? new Error("Request aborted."));
    };

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function randomBetween(min, max, rng) {
  const n = typeof rng?.next === "function" ? rng.next() : Math.random();
  return min + Math.floor(n * (max - min + 1));
}


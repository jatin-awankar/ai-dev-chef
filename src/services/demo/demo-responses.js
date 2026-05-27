function nextRandom(rng) {
  if (rng && typeof rng.next === "function") {
    return rng.next();
  }
  return Math.random();
}

function pick(items, rng) {
  return items[Math.floor(nextRandom(rng) * items.length)];
}

function pickByWeight(weightedItems, rng) {
  const total = weightedItems.reduce((sum, item) => sum + item.weight, 0);
  let cursor = nextRandom(rng) * total;

  for (const item of weightedItems) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item.value;
    }
  }

  return weightedItems[weightedItems.length - 1].value;
}

const preludePools = {
  commit: [
    "Analyzing staged changes...",
    "Reading repository state...",
    "Evaluating commit intent...",
  ],
  explain: [
    "Analyzing stack trace...",
    "Inspecting async boundaries...",
    "Tracing failure path...",
  ],
  summarize: [
    "Scanning project structure...",
    "Inspecting service boundaries...",
    "Compacting architecture notes...",
  ],
  chat: [
    "Reviewing context...",
    "Checking constraints...",
    "Preparing response...",
  ],
};

const scenarioPacks = {
  commit: {
    quick: [
      "fix(streaming): guard undefined delta in renderer",
      "refactor(config): trim model preference resolution",
      "chore(history): normalize persisted session ids",
    ],
    medium: [
      "feat(auth): add persisted OpenAI key validation on startup",
      "fix(commit): prevent empty message emission on cancelled stream",
      "refactor(cli): move demo flag handling into root command hook",
    ],
    deep: [
      "refactor(openai): isolate streaming fallback and error normalization",
      "feat(demo): add deterministic seeded stream timing for fixture captures",
      "fix(renderer): preserve markdown formatting across multiline delta chunks",
    ],
  },
  explain: {
    quick: [
      "The undefined access probably comes from unresolved async data. Add `await` at the call site and null-check before property access.",
      "This looks like ESM path resolution drift. Use explicit extensions and match import casing.",
    ],
    medium: [
      `Likely root cause: missing \`await\` in an upstream call.

The async function returns a pending Promise, then downstream code reads nested fields immediately. That creates an undefined access crash.

Fix:
1. Await the upstream call.
2. Guard nullish branches.
3. Add a regression test for the failing stack path.`,
      `This failure pattern matches a race condition between two async updates.

One branch writes state after another render path already consumed earlier values, so the renderer sees inconsistent shape.

Fix:
1. Serialize state writes.
2. Tag updates with request ids.
3. Drop stale completions in the reducer.`,
    ],
    deep: [
      `Crash source is likely concurrent mutation plus delayed render.

Sequence:
1. Request A starts and primes partial state.
2. Request B starts, resolves first, and triggers render.
3. Request A resolves late and overwrites state with missing fields.
4. Render pipeline dereferences an expected object and throws.

Hardening steps:
1. Use immutable state snapshots per request.
2. Gate final writes on latest request token.
3. Add diagnostic logs around render entry and async completion.
4. Add a focused test reproducing out-of-order completion.`,
    ],
  },
  summarize: {
    quick: [
      "Layered CLI: Commander commands call service flows; services delegate prompts and renderers; OpenAI adapter handles streaming and fallback.",
      "Architecture is cleanly split across commands/services/renderers with local config and history persistence.",
    ],
    medium: [
      `## Architecture Snapshot

- Command modules stay thin and forward options into service orchestration.
- Services own business flow and prompt composition.
- Renderers convert async deltas into terminal-safe output.
- OpenAI adapter centralizes retry, timeout, and model fallback.

## Maintainability Notes

- Strong separation of concerns.
- Demo mode can evolve independently from command handlers.`,
    ],
    deep: [
      `## System Summary

Fortify is structured as a layered ESM CLI:
- **Commands** parse intent and invoke use-case services.
- **Services** coordinate context gathering, prompt creation, and output handling.
- **Renderers** consume async iterables and keep streaming UX decoupled from model transport.
- **Storage/Config** modules isolate persistence concerns from runtime orchestration.

## Runtime Behavior

- Streaming paths are cancellation-aware.
- OpenAI calls are retried with bounded backoff.
- Model fallback is handled in the OpenAI service, not command code.

## Engineering Posture

- Good extensibility for plugin command packs.
- Demo infrastructure is now suitable for deterministic fixture playback and recordings.`,
    ],
  },
  chat: {
    quick: [
      "Start at the failing boundary, log the exact value shape, then patch the first invalid transition.",
      "Reproduce on the smallest input first. Once stable, patch and add one regression test.",
    ],
    medium: [
      `Fastest path:
1. Reproduce with minimal input.
2. Confirm expected vs actual state at failure boundary.
3. Patch the first invalid mutation, not the final crash site.`,
      `I’d instrument request ids around async state writes first. If ordering is unstable, gate updates and ignore stale completions.`,
    ],
    deep: [
      `Debug this in three passes:
1. Capture a deterministic repro with fixed input.
2. Trace state transitions around async completion and render entry.
3. Apply a narrow fix at the earliest invalid state transition.

If you share the failing snippet, I can draft a minimal patch plus a regression test shape.`,
    ],
  },
};

export function resolveDemoScenario({ input, instructions, metadata, rng } = {}) {
  const domain = metadata?.demo?.type ?? "chat";
  const profile = metadata?.demo?.profile ?? "default";
  const packs = profile === "showcase" ? showcaseScenarioPacks : scenarioPacks;
  const preludeSet = profile === "showcase" ? showcasePreludePools : preludePools;
  const depth = pickByWeight(
    [
      { value: "quick", weight: 0.35 },
      { value: "medium", weight: 0.45 },
      { value: "deep", weight: 0.2 },
    ],
    rng,
  );

  const preludeCount = depth === "quick" ? 1 : depth === "medium" ? 2 : 3;
  const prelude = (preludeSet[domain] ?? preludeSet.chat).slice(0, preludeCount);
  const domainPack = packs[domain] ?? packs.chat;
  const final = pick(domainPack[depth], rng);

  return {
    prelude,
    stream: tokenizeForStream(final, rng),
    final,
    metadata: {
      domain,
      profile,
      depth,
      preludeCount,
      staged: true,
    },
  };
}

function tokenizeForStream(text, rng) {
  const tokens = text.match(/(\s+|[^\s]+)/g) ?? [text];
  const chunks = [];
  for (let i = 0; i < tokens.length; ) {
    const width = Math.floor(nextRandom(rng) * 3) + 1;
    chunks.push(tokens.slice(i, i + width).join(""));
    i += width;
  }
  return chunks;
}

function extractInputText(input) {
  if (typeof input === "string") {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => JSON.stringify(item)).join("\n");
  }
  if (input && typeof input === "object") {
    return JSON.stringify(input);
  }
  return "";
}

const showcasePreludePools = {
  commit: [
    "Analyzing staged changes...",
    "Reading repository state...",
    "Extracting commit intent...",
  ],
  explain: [
    "Analyzing stack trace...",
    "Inspecting async boundaries...",
    "Potential race condition detected.",
  ],
  summarize: [
    "Scanning project structure...",
    "Inspecting renderer pipeline...",
    "Analyzing async service boundaries...",
  ],
  chat: [
    "Reviewing context...",
    "Inspecting constraints...",
    "Preparing focused response...",
  ],
};

const showcaseScenarioPacks = {
  commit: {
    quick: ["fix(stream): guard undefined delta before markdown render"],
    medium: ["refactor(demo): add deterministic showcase stream orchestration"],
    deep: ["feat(cli): add explicit demo scenario typing and showcase profile routing"],
  },
  explain: {
    quick: ["The undefined access likely comes from unresolved async data. Add `await` and guard nullish values."],
    medium: ["Crash likely originates from out-of-order async completion. A stale request overwrites state used by the active render path."],
    deep: ["Root cause is probably concurrent async mutation: one request completes late, overwrites expected object shape, then renderer dereferences undefined."],
  },
  summarize: {
    quick: ["Layered architecture: command modules invoke services; services orchestrate prompts and streams; renderers handle terminal output."],
    medium: ["Fortify is structured with clear boundaries across commands, services, renderers, and storage. Streaming and cancellation behavior is centralized in the OpenAI adapter and renderer pipeline."],
    deep: ["The codebase is a modular ESM CLI with strong separation: commands for intent parsing, services for orchestration, renderers for UX, and storage/config for persistence. Streaming is first-class and cancellation-aware, which improves runtime resilience and maintainability."],
  },
  chat: scenarioPacks.chat,
};

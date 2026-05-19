import OpenAI from "openai";
import { loadConfig } from "../../config/index.js";
import { withRetry } from "../../utils/retry.js";
import {
  OpenAIConfigurationError,
  OpenAITimeoutError,
  isRetryableOpenAIError,
  normalizeOpenAIError
} from "./openai-service-errors.js";

const DEFAULT_MODEL = "gpt-5.4";

export class OpenAIService {
  constructor({
    configLoader = loadConfig,
    clientFactory = (options) => new OpenAI(options),
    timeoutMs = 60_000,
    maxRetries = 2,
    retryBaseDelayMs = 500,
    retryMaxDelayMs = 5_000
  } = {}) {
    this.configLoader = configLoader;
    this.clientFactory = clientFactory;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.retryBaseDelayMs = retryBaseDelayMs;
    this.retryMaxDelayMs = retryMaxDelayMs;
  }

  async generateResponse({
    input,
    model,
    instructions,
    maxOutputTokens,
    temperature,
    timeoutMs,
    maxRetries,
    metadata
  }) {
    const requestPayload = await this.#buildRequestPayload({
      input,
      model,
      instructions,
      maxOutputTokens,
      temperature,
      metadata,
      stream: false
    });

    const response = await this.#executeWithRetry(
      async () => {
        const client = await this.#createClient(timeoutMs);
        return client.responses.create(requestPayload);
      },
      { timeoutMs, maxRetries }
    );

    return {
      id: response.id,
      model: response.model,
      outputText: response.output_text ?? "",
      response
    };
  }

  async *streamResponse({
    input,
    model,
    instructions,
    maxOutputTokens,
    temperature,
    timeoutMs,
    maxRetries,
    metadata
  }) {
    const requestPayload = await this.#buildRequestPayload({
      input,
      model,
      instructions,
      maxOutputTokens,
      temperature,
      metadata,
      stream: true
    });

    const stream = await this.#executeWithRetry(
      async () => {
        const client = await this.#createClient(timeoutMs);
        return client.responses.create(requestPayload);
      },
      { timeoutMs, maxRetries }
    );

    const requestTimeoutMs = timeoutMs ?? this.timeoutMs;

    for await (const event of this.#iterateStreamWithTimeout(stream, requestTimeoutMs)) {
      if (event?.type === "error") {
        throw normalizeOpenAIError(event.error, { fallbackMessage: "OpenAI streaming failed." });
      }

      if (event?.type === "response.output_text.delta") {
        yield {
          type: "text_delta",
          delta: event.delta ?? "",
          event
        };
        continue;
      }

      if (event?.type === "response.output_text.done") {
        yield {
          type: "text_done",
          text: event.text ?? "",
          event
        };
        continue;
      }

      yield {
        type: "event",
        event
      };
    }
  }

  async #createClient(timeoutMs) {
    const apiKey = await this.#loadApiKey();
    return this.clientFactory({
      apiKey,
      maxRetries: 0,
      timeout: timeoutMs ?? this.timeoutMs
    });
  }

  async #loadApiKey() {
    const config = await this.configLoader();
    const apiKey = config?.apiKeys?.openai?.trim();

    if (!apiKey) {
      throw new OpenAIConfigurationError(
        "OpenAI API key is missing. Run `aidevchef auth` before making requests."
      );
    }

    return apiKey;
  }

  async #buildRequestPayload({
    input,
    model,
    instructions,
    maxOutputTokens,
    temperature,
    metadata,
    stream
  }) {
    const config = await this.configLoader();
    const selectedModel = model ?? config?.modelPreferences?.defaultModel ?? DEFAULT_MODEL;

    if (!input) {
      throw new OpenAIConfigurationError("`input` is required for OpenAI responses.");
    }

    const payload = {
      model: selectedModel,
      input,
      stream
    };

    if (instructions) {
      payload.instructions = instructions;
    }

    if (typeof maxOutputTokens === "number") {
      payload.max_output_tokens = maxOutputTokens;
    }

    if (typeof temperature === "number") {
      payload.temperature = temperature;
    }

    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      payload.metadata = metadata;
    }

    return payload;
  }

  async #executeWithRetry(operation, { timeoutMs, maxRetries } = {}) {
    const requestTimeoutMs = timeoutMs ?? this.timeoutMs;
    const retryLimit = maxRetries ?? this.maxRetries;

    return withRetry(
      async () => {
        try {
          return await this.#runWithTimeout(operation, requestTimeoutMs);
        } catch (error) {
          throw normalizeOpenAIError(error);
        }
      },
      {
        maxRetries: retryLimit,
        baseDelayMs: this.retryBaseDelayMs,
        maxDelayMs: this.retryMaxDelayMs,
        shouldRetry: (error) => isRetryableOpenAIError(error)
      }
    );
  }

  async #runWithTimeout(operation, timeoutMs) {
    const timeoutError = new OpenAITimeoutError(
      `OpenAI request timed out after ${timeoutMs}ms.`
    );

    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(timeoutError), timeoutMs);
    });

    try {
      return await Promise.race([operation(), timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async *#iterateStreamWithTimeout(stream, timeoutMs) {
    const iterator = stream[Symbol.asyncIterator]();

    try {
      while (true) {
        const { done, value } = await this.#runWithTimeout(() => iterator.next(), timeoutMs);
        if (done) {
          return;
        }

        yield value;
      }
    } finally {
      if (typeof iterator.return === "function") {
        await iterator.return();
      }
    }
  }
}

import { EventEmitter } from "node:events";
import { STREAM_RENDERER_EVENTS } from "./stream-events.js";

export class StreamRenderCancelledError extends Error {
  constructor(message = "Stream rendering cancelled.") {
    super(message);
    this.name = "StreamRenderCancelledError";
    this.code = "STREAM_RENDER_CANCELLED";
  }
}

function defaultChunkToText(chunk) {
  if (typeof chunk === "string") {
    return chunk;
  }

  if (!chunk || typeof chunk !== "object") {
    return "";
  }

  if (chunk.type === "text_done" || chunk.type === "response.output_text.done") {
    return "";
  }

  if (typeof chunk.delta === "string") {
    return chunk.delta;
  }

  if (typeof chunk.token === "string") {
    return chunk.token;
  }

  if (typeof chunk.text === "string") {
    return chunk.text;
  }

  if (typeof chunk.content === "string") {
    return chunk.content;
  }

  return "";
}

export class StreamingTerminalRenderer extends EventEmitter {
  #pendingOutput = "";
  #flushScheduled = false;
  #isRendering = false;
  #lastChar = "\n";
  #abortController = null;
  #activeIterator = null;
  #sigintHandler = null;
  #activeAbortSignal = null;
  #activeAbortListener = null;

  constructor({
    stdout = process.stdout,
    stderr = process.stderr,
    signalProcess = process,
    chunkToText = defaultChunkToText
  } = {}) {
    super();
    this.stdout = stdout;
    this.stderr = stderr;
    this.signalProcess = signalProcess;
    this.chunkToText = chunkToText;
  }

  get isRendering() {
    return this.#isRendering;
  }

  cancel(reason = "Cancelled by user.") {
    if (!this.#abortController || this.#abortController.signal.aborted) {
      return;
    }

    const cancellationError =
      reason instanceof Error ? reason : new StreamRenderCancelledError(reason);

    this.#abortController.abort(cancellationError);
  }

  async renderStream(stream, { signal, handleCtrlC = true, ensureTrailingNewline = true } = {}) {
    if (!stream || typeof stream[Symbol.asyncIterator] !== "function") {
      throw new TypeError("`stream` must be an async iterable.");
    }

    if (this.#isRendering) {
      throw new Error("Renderer is already processing a stream.");
    }

    this.#isRendering = true;
    this.#abortController = new AbortController();
    this.#lastChar = "\n";

    try {
      if (signal?.aborted) {
        throw signal.reason ?? new StreamRenderCancelledError("Stream aborted before rendering.");
      }

      this.#bindExternalSignal(signal);

      if (handleCtrlC) {
        this.#bindSigintCancellation();
      }

      this.emit(STREAM_RENDERER_EVENTS.start);

      const iterator = stream[Symbol.asyncIterator]();
      this.#activeIterator = iterator;
      const abortPromise = this.#waitForAbort(this.#abortController.signal);

      while (true) {
        const step = await Promise.race([iterator.next(), abortPromise]);

        if (step.done) {
          break;
        }

        const token = this.chunkToText(step.value);
        if (!token) {
          continue;
        }

        this.#queueOutput(token);
        this.emit(STREAM_RENDERER_EVENTS.token, token);

        if (token.includes("\n")) {
          this.emit(STREAM_RENDERER_EVENTS.line, token);
        }
      }

      await this.#flushPendingOutput();
      this.#ensureTrailingNewline(ensureTrailingNewline);
      this.emit(STREAM_RENDERER_EVENTS.complete);
    } catch (error) {
      await this.#flushPendingOutput();
      this.#ensureTrailingNewline(ensureTrailingNewline);

      if (this.#isCancellationError(error)) {
        const cancellationError =
          error instanceof Error ? error : new StreamRenderCancelledError(String(error));
        this.emit(STREAM_RENDERER_EVENTS.cancelled, cancellationError);
        throw cancellationError;
      }

      const renderError =
        error instanceof Error ? error : new Error("Streaming renderer failed.");
      this.emit(STREAM_RENDERER_EVENTS.failure, renderError);
      throw renderError;
    } finally {
      await this.#cleanup();
    }
  }

  #queueOutput(text) {
    this.#pendingOutput += text;

    if (this.#flushScheduled) {
      return;
    }

    this.#flushScheduled = true;
    queueMicrotask(() => {
      this.#flushScheduled = false;
      this.#flushPendingOutput();
    });
  }

  async #flushPendingOutput() {
    if (!this.#pendingOutput) {
      return;
    }

    const outputChunk = this.#pendingOutput;
    this.#pendingOutput = "";
    this.stdout.write(outputChunk);
    this.#lastChar = outputChunk.at(-1) ?? this.#lastChar;
  }

  #ensureTrailingNewline(ensureTrailingNewline) {
    if (!ensureTrailingNewline) {
      return;
    }

    if (this.#lastChar !== "\n") {
      this.stdout.write("\n");
      this.#lastChar = "\n";
    }
  }

  #bindSigintCancellation() {
    this.#sigintHandler = () => {
      this.cancel("Cancelled by Ctrl+C.");
    };

    this.signalProcess.on("SIGINT", this.#sigintHandler);
  }

  #bindExternalSignal(signal) {
    if (!signal) {
      return;
    }

    this.#activeAbortSignal = signal;
    this.#activeAbortListener = () => {
      const reason = signal.reason ?? new StreamRenderCancelledError("Stream aborted.");
      this.cancel(reason);
    };

    signal.addEventListener("abort", this.#activeAbortListener, { once: true });
  }

  #waitForAbort(abortSignal) {
    return new Promise((_, reject) => {
      if (abortSignal.aborted) {
        reject(abortSignal.reason ?? new StreamRenderCancelledError("Stream aborted."));
        return;
      }

      abortSignal.addEventListener(
        "abort",
        () => {
          reject(abortSignal.reason ?? new StreamRenderCancelledError("Stream aborted."));
        },
        { once: true }
      );
    });
  }

  #isCancellationError(error) {
    if (error instanceof StreamRenderCancelledError) {
      return true;
    }

    if (error?.name === "AbortError") {
      return true;
    }

    if (error?.code === "STREAM_RENDER_CANCELLED") {
      return true;
    }

    return false;
  }

  async #cleanup() {
    if (this.#activeAbortSignal && this.#activeAbortListener) {
      this.#activeAbortSignal.removeEventListener("abort", this.#activeAbortListener);
    }

    if (this.#sigintHandler) {
      this.signalProcess.off("SIGINT", this.#sigintHandler);
    }

    if (this.#activeIterator && typeof this.#activeIterator.return === "function") {
      try {
        await this.#activeIterator.return();
      } catch {
        // Iterator cleanup should not mask rendering results.
      }
    }

    this.#activeAbortSignal = null;
    this.#activeAbortListener = null;
    this.#sigintHandler = null;
    this.#activeIterator = null;
    this.#abortController = null;
    this.#pendingOutput = "";
    this.#flushScheduled = false;
    this.#isRendering = false;
  }
}

export function createStreamingTerminalRenderer(options) {
  return new StreamingTerminalRenderer(options);
}

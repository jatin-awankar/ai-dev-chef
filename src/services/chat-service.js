import { createInterface } from "node:readline/promises";
import { ChatSessionRenderer } from "../renderers/index.js";
import { InMemoryConversationStore } from "../storage/in-memory-conversation-store.js";
import { LocalHistoryStore } from "../storage/local-history-store.js";
import {
  bindCtrlCCancellation,
  isAbortLikeError
} from "../utils/operation-cancellation.js";
import { OpenAIService } from "./openai/index.js";
import { getDemoProfile } from "./demo/index.js";

function normalizeSessionId(sessionId) {
  if (typeof sessionId === "string" && sessionId.trim()) {
    return sessionId.trim();
  }

  return "default";
}

export class ChatService {
  constructor({
    openAIService = new OpenAIService(),
    conversationStore = new InMemoryConversationStore(),
    historyStore = new LocalHistoryStore(),
    renderer = new ChatSessionRenderer(),
    input = process.stdin,
    output = process.stdout,
    signalProcess = process
  } = {}) {
    this.openAIService = openAIService;
    this.conversationStore = conversationStore;
    this.historyStore = historyStore;
    this.renderer = renderer;
    this.input = input;
    this.output = output;
    this.signalProcess = signalProcess;
    this.historyPersistenceDisabled = false;
  }

  async startInteractiveChat({ mode = "default", sessionId = "" } = {}) {
    const resolvedSessionId = normalizeSessionId(sessionId);
    const existingSession = await this.#loadSessionFromHistory(resolvedSessionId);
    const session = existingSession
      ? this.conversationStore.hydrateSession(existingSession)
      : this.conversationStore.getOrCreateSession(resolvedSessionId);

    const readlineInterface = createInterface({
      input: this.input,
      output: this.output,
      terminal: true,
      historySize: 200,
      removeHistoryDuplicates: true
    });

    let exitRequested = false;
    let promptAbortController = null;
    let generationAbortController = null;

    const unbindSigint = bindCtrlCCancellation({
      signalProcess: this.signalProcess,
      onCancel: () => {
        exitRequested = true;

        if (generationAbortController && !generationAbortController.signal.aborted) {
          generationAbortController.abort(new Error("Cancelled by Ctrl+C."));
        }

        if (promptAbortController && !promptAbortController.signal.aborted) {
          promptAbortController.abort(new Error("Interrupted by Ctrl+C."));
        }
      }
    });

    this.renderer.showSessionStart({ mode, sessionId: session.id });

    try {
      while (!exitRequested) {
        const userInput = await this.#readUserInput(readlineInterface, () => {
          promptAbortController = new AbortController();
          return promptAbortController;
        });

        promptAbortController = null;

        if (userInput === null) {
          exitRequested = true;
          break;
        }

        const trimmedInput = userInput.trim();
        if (!trimmedInput) {
          continue;
        }

        if (this.#isExitCommand(trimmedInput)) {
          exitRequested = true;
          break;
        }

        this.conversationStore.addMessage(session.id, {
          role: "user",
          content: trimmedInput
        });
        await this.#persistSession(session.id);

        const responseInput = this.conversationStore.toResponseInput(session.id);

        generationAbortController = new AbortController();

        try {
          const stream = this.openAIService.streamResponse({
            input: responseInput,
            metadata: OpenAIService.buildDemoMetadata({
              type: "chat",
              profile: getDemoProfile(),
              extra: { command: "chat", mode },
            }),
            signal: generationAbortController.signal,
            onModelFallback: ({ fromModel, toModel }) => {
              this.renderer.showModelFallback({ fromModel, toModel });
            },
          });

          const assistantMessage = await this.renderer.renderAssistantStream(stream, {
            signal: generationAbortController.signal
          });

          if (assistantMessage) {
            this.conversationStore.addMessage(session.id, {
              role: "assistant",
              content: assistantMessage
            });
            await this.#persistSession(session.id);
          }
        } catch (error) {
          if (generationAbortController.signal.aborted || isAbortLikeError(error)) {
            exitRequested = true;
            continue;
          }

          this.renderer.showError(error instanceof Error ? error.message : "Chat request failed.");
        } finally {
          generationAbortController = null;
        }
      }
    } finally {
      if (promptAbortController && !promptAbortController.signal.aborted) {
        promptAbortController.abort(new Error("Chat session closed."));
      }

      if (generationAbortController && !generationAbortController.signal.aborted) {
        generationAbortController.abort(new Error("Chat session closed."));
      }

      unbindSigint();
      readlineInterface.close();
      await this.#persistSession(session.id);
      this.renderer.showSessionEnd();
    }
  }

  async #readUserInput(readlineInterface, createAbortController) {
    const controller = createAbortController();

    try {
      return await readlineInterface.question(this.renderer.showUserPrompt(), {
        signal: controller.signal
      });
    } catch (error) {
      if (error?.code === "ERR_USE_AFTER_CLOSE") {
        return null;
      }

      if (isAbortLikeError(error)) {
        return null;
      }

      throw error;
    }
  }

  #isExitCommand(input) {
    const normalizedInput = input.toLowerCase();
    return normalizedInput === "/exit" || normalizedInput === "exit" || normalizedInput === "quit";
  }

  async #persistSession(sessionId) {
    const session = this.conversationStore.getSession(sessionId);
    try {
      await this.historyStore.saveSession(session);
    } catch (error) {
      this.#disableHistoryPersistence(error);
    }
  }

  async #loadSessionFromHistory(sessionId) {
    try {
      return await this.historyStore.loadSession(sessionId);
    } catch (error) {
      this.#disableHistoryPersistence(error);
      return null;
    }
  }

  #disableHistoryPersistence(error) {
    if (this.historyPersistenceDisabled) {
      return;
    }

    this.historyPersistenceDisabled = true;
    const message =
      error instanceof Error ? error.message : "History persistence is unavailable in this environment.";
    this.renderer.showWarning(`History persistence disabled: ${message}`);
  }
}

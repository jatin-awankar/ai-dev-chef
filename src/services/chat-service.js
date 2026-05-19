import { createInterface } from "node:readline/promises";
import { ChatSessionRenderer } from "../renderers/index.js";
import { InMemoryConversationStore } from "../storage/in-memory-conversation-store.js";
import { OpenAIService } from "./openai/index.js";

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
    renderer = new ChatSessionRenderer(),
    input = process.stdin,
    output = process.stdout,
    signalProcess = process
  } = {}) {
    this.openAIService = openAIService;
    this.conversationStore = conversationStore;
    this.renderer = renderer;
    this.input = input;
    this.output = output;
    this.signalProcess = signalProcess;
  }

  async startInteractiveChat({ mode = "default", sessionId = "" } = {}) {
    const resolvedSessionId = normalizeSessionId(sessionId);
    const session = this.conversationStore.getOrCreateSession(resolvedSessionId);

    const readlineInterface = createInterface({
      input: this.input,
      output: this.output,
      terminal: true,
      historySize: 200,
      removeHistoryDuplicates: true
    });

    let exitRequested = false;
    let isGenerating = false;
    let promptAbortController = null;
    let generationAbortController = null;

    const handleSigint = () => {
      if (isGenerating && generationAbortController && !generationAbortController.signal.aborted) {
        generationAbortController.abort(new Error("Cancelled by Ctrl+C."));
        return;
      }

      exitRequested = true;

      if (promptAbortController && !promptAbortController.signal.aborted) {
        promptAbortController.abort(new Error("Interrupted by Ctrl+C."));
      }
    };

    this.signalProcess.on("SIGINT", handleSigint);
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

        const responseInput = this.conversationStore.toResponseInput(session.id);

        generationAbortController = new AbortController();
        isGenerating = true;

        try {
          const stream = this.openAIService.streamResponse({
            input: responseInput,
            signal: generationAbortController.signal
          });

          const assistantMessage = await this.renderer.renderAssistantStream(stream, {
            signal: generationAbortController.signal
          });

          if (assistantMessage) {
            this.conversationStore.addMessage(session.id, {
              role: "assistant",
              content: assistantMessage
            });
          }
        } catch (error) {
          if (this.#isAbortLikeError(error)) {
            continue;
          }

          this.renderer.showError(error instanceof Error ? error.message : "Chat request failed.");
        } finally {
          generationAbortController = null;
          isGenerating = false;
        }
      }
    } finally {
      if (promptAbortController && !promptAbortController.signal.aborted) {
        promptAbortController.abort(new Error("Chat session closed."));
      }

      if (generationAbortController && !generationAbortController.signal.aborted) {
        generationAbortController.abort(new Error("Chat session closed."));
      }

      this.signalProcess.off("SIGINT", handleSigint);
      readlineInterface.close();
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

      if (this.#isAbortLikeError(error)) {
        return null;
      }

      throw error;
    }
  }

  #isExitCommand(input) {
    const normalizedInput = input.toLowerCase();
    return normalizedInput === "/exit" || normalizedInput === "exit" || normalizedInput === "quit";
  }

  #isAbortLikeError(error) {
    if (error?.name === "AbortError" || error?.name === "APIUserAbortError") {
      return true;
    }

    if (error?.code === "ABORT_ERR") {
      return true;
    }

    return false;
  }
}

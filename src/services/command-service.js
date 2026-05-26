import { AuthService } from "./auth-service.js";
import { ChatService } from "./chat-service.js";
import { CommitService } from "./commit-service.js";
import { ExplainService } from "./explain-service.js";
import { HistoryService } from "./history-service.js";
import { SummarizeService } from "./summarize-service.js";
import { USER_CANCELLED_EXIT_CODE } from "../utils/operation-cancellation.js";

export class CommandService {
  constructor({
    authService = new AuthService(),
    chatService = new ChatService(),
    commitService = new CommitService(),
    explainService = new ExplainService(),
    historyService = new HistoryService(),
    summarizeService = new SummarizeService()
  } = {}) {
    this.authService = authService;
    this.chatService = chatService;
    this.commitService = commitService;
    this.explainService = explainService;
    this.historyService = historyService;
    this.summarizeService = summarizeService;
  }

  async explain(input) {
    const result = await this.explainService.runExplainFlow({
      target: input?.target,
      context: input?.context ?? ""
    });

    this.#setExitCodeFromResult(result);
  }

  async commit(input) {
    const result = await this.commitService.runCommitFlow({
      style: input?.style ?? "conventional",
      scope: input?.scope ?? "",
      autoCommit: Boolean(input?.yes)
    });

    this.#setExitCodeFromResult(result);
  }

  async summarize(input) {
    const result = await this.summarizeService.runSummaryFlow({
      sourcePath: input?.source,
      format: input?.format ?? "bullet"
    });

    this.#setExitCodeFromResult(result);
  }

  async chat(input) {
    await this.chatService.startInteractiveChat({
      mode: input?.mode ?? "default",
      sessionId: input?.sessionId ?? ""
    });
  }

  async history(input) {
    const result = await this.historyService.showHistory({
      clear: Boolean(input?.clear)
    });

    this.#setExitCodeFromResult(result);
  }

  async auth(input) {
    void input;
    const isAuthenticated = await this.authService.authenticateOpenAIKey();

    if (!isAuthenticated) {
      process.exitCode = 1;
    }
  }

  #setExitCodeFromResult(result) {
    if (!result?.ok && result?.reason === "cancelled") {
      process.exitCode = USER_CANCELLED_EXIT_CODE;
      return;
    }

    if (!result?.ok) {
      process.exitCode = 1;
    }
  }
}

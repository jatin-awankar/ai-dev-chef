import { AuthService } from "./auth-service.js";
import { ChatService } from "./chat-service.js";
import { CommitService } from "./commit-service.js";
import { ExplainService } from "./explain-service.js";
import { HistoryService } from "./history-service.js";
import { SummarizeService } from "./summarize-service.js";

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

    if (!result?.ok) {
      process.exitCode = 1;
    }
  }

  async commit(input) {
    const result = await this.commitService.runCommitFlow({
      style: input?.style ?? "conventional",
      scope: input?.scope ?? "",
      autoCommit: Boolean(input?.yes)
    });

    if (!result?.ok) {
      process.exitCode = 1;
    }
  }

  async summarize(input) {
    const result = await this.summarizeService.runSummaryFlow({
      sourcePath: input?.source,
      format: input?.format ?? "bullet"
    });

    if (!result?.ok) {
      process.exitCode = 1;
    }
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

    if (!result?.ok) {
      process.exitCode = 1;
    }
  }

  async auth(input) {
    void input;
    const isAuthenticated = await this.authService.authenticateOpenAIKey();

    if (!isAuthenticated) {
      process.exitCode = 1;
    }
  }
}

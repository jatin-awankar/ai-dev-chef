import { createTerminalUI } from "../renderers/index.js";
import { LocalHistoryStore } from "../storage/local-history-store.js";

export class HistoryService {
  constructor({
    historyStore = new LocalHistoryStore(),
    terminalUI = createTerminalUI()
  } = {}) {
    this.historyStore = historyStore;
    this.terminalUI = terminalUI;
  }

  async showHistory({ clear = false } = {}) {
    try {
      if (clear) {
        await this.historyStore.clearHistory();
        this.terminalUI.success("Chat history cleared.");
        return { ok: true, cleared: true };
      }

      const sessions = await this.historyStore.listSessions();
      const historyDir = this.historyStore.getHistoryDirectory();

      this.terminalUI.divider("Fortify History");
      this.terminalUI.info(`Location: ${historyDir}`);

      if (!sessions.length) {
        this.terminalUI.info("No saved conversations found.");
        return { ok: true, sessions: [] };
      }

      for (const session of sessions) {
        this.terminalUI.stdout.write(
          `${this.terminalUI.chalk.yellow(session.id)}  messages=${session.messageCount}  updated=${session.updatedAt}\n`
        );
      }

      return { ok: true, sessions };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to read local history.";
      this.terminalUI.error(message);
      return { ok: false, error };
    }
  }
}

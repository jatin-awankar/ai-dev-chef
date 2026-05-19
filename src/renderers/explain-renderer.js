import { createTerminalUI } from "./terminal-ui.js";
import { MarkdownTerminalRenderer } from "./markdown-terminal-renderer.js";

export class ExplainRenderer {
  constructor({
    terminalUI = createTerminalUI(),
    markdownRenderer = new MarkdownTerminalRenderer({ terminalUI })
  } = {}) {
    this.terminalUI = terminalUI;
    this.markdownRenderer = markdownRenderer;
  }

  showStart({ sourceLabel, sourceType }) {
    this.terminalUI.divider("Error Explanation");
    this.terminalUI.info(`Source: ${sourceType} (${sourceLabel})`);
  }

  showStackTraceDetection(stackTrace) {
    if (stackTrace.detected) {
      this.terminalUI.info(
        `Detected Node.js-style stack trace (${stackTrace.frames.length} frames).`
      );
      return;
    }

    this.terminalUI.warning("No standard Node.js stack trace detected. Using general error analysis.");
  }

  showStreamingStart() {
    this.terminalUI.divider();
    this.terminalUI.stdout.write(`${this.terminalUI.chalk.bold.green("Explanation:")} `);
  }

  async renderExplanationStream(stream, { signal } = {}) {
    const output = await this.markdownRenderer.renderMarkdownStream(stream, {
      signal,
      handleCtrlC: false,
      ensureTrailingNewline: true
    });
    return output.trim();
  }

  showDone() {
    this.terminalUI.divider();
    this.terminalUI.success("Explanation completed.");
  }

  showCancelled() {
    this.terminalUI.warning("Explanation cancelled.");
  }

  showError(message) {
    this.terminalUI.error(message);
  }
}

import { createTerminalUI } from "./terminal-ui.js";
import { MarkdownTerminalRenderer } from "./markdown-terminal-renderer.js";

export class SummarizeRenderer {
  constructor({
    terminalUI = createTerminalUI(),
    markdownRenderer = new MarkdownTerminalRenderer({ terminalUI })
  } = {}) {
    this.terminalUI = terminalUI;
    this.markdownRenderer = markdownRenderer;
  }

  showStart({ sourcePath }) {
    this.terminalUI.divider("Project Summarizer");
    this.terminalUI.info(`Target: ${sourcePath}`);
  }

  showDiscovery({ fileCount }) {
    this.terminalUI.info(`Discovered ${fileCount} text/code files.`);
  }

  showNoFilesFound() {
    this.terminalUI.warning("No supported text/code files found at the target path.");
  }

  showTokenGuardNotice(message) {
    this.terminalUI.warning(message);
  }

  showChunkProgress({ filePath, chunkIndex, totalChunks }) {
    this.terminalUI.info(`Summarizing ${filePath} (${chunkIndex + 1}/${totalChunks})`);
  }

  showFinalStart() {
    this.terminalUI.divider();
    this.terminalUI.info("Generating final project summary...");
    this.terminalUI.stdout.write(`${this.terminalUI.chalk.bold.green("Summary:")} `);
  }

  async renderFinalSummaryStream(stream, { signal } = {}) {
    const outputText = await this.markdownRenderer.renderMarkdownStream(stream, {
      signal,
      handleCtrlC: false,
      ensureTrailingNewline: true
    });
    return outputText.trim();
  }

  showError(message) {
    this.terminalUI.error(message);
  }

  showDone() {
    this.terminalUI.divider();
    this.terminalUI.success("Project summary completed.");
  }
}

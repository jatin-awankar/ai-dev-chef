import { getConfigPath, updateConfig } from "../config/index.js";
import { createTerminalUI } from "../renderers/index.js";
import { promptSecretInput } from "../utils/prompt-secret.js";

export class AuthService {
  constructor({
    configPathResolver = getConfigPath,
    configUpdater = updateConfig,
    terminalUI = createTerminalUI(),
    secretPrompt = promptSecretInput
  } = {}) {
    this.configPathResolver = configPathResolver;
    this.configUpdater = configUpdater;
    this.terminalUI = terminalUI;
    this.secretPrompt = secretPrompt;
  }

  async authenticateOpenAIKey() {
    if (!this.terminalUI.capabilities.isInteractive) {
      this.terminalUI.error("`auth` requires an interactive terminal.");
      return false;
    }

    this.terminalUI.divider("Authentication");
    this.terminalUI.info("Enter your OpenAI API key. Input is hidden.");

    try {
      const apiKey = (await this.secretPrompt({
        prompt: "OpenAI API key: ",
        stdin: this.terminalUI.stdin,
        stdout: this.terminalUI.stdout
      })).trim();

      if (!apiKey) {
        this.terminalUI.error("API key cannot be empty.");
        return false;
      }

      await this.configUpdater({
        apiKeys: {
          openai: apiKey
        }
      });

      const configPath = this.configPathResolver();
      this.terminalUI.success(`OpenAI API key saved to ${configPath}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      this.terminalUI.error(message);
      return false;
    }
  }
}

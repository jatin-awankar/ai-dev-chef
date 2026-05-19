import { AuthService } from "./auth-service.js";

export class CommandService {
  constructor({ authService = new AuthService() } = {}) {
    this.authService = authService;
  }

  async explain(input) {
    void input;
  }

  async commit(input) {
    void input;
  }

  async summarize(input) {
    void input;
  }

  async chat(input) {
    void input;
  }

  async auth(input) {
    void input;
    const isAuthenticated = await this.authService.authenticateOpenAIKey();

    if (!isAuthenticated) {
      process.exitCode = 1;
    }
  }
}

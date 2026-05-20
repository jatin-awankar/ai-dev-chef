import { appMetadata } from "../config/app-metadata.js";

export function createAuthCommand(commandService) {
  return {
    name: "auth",
    description: "Configure local authentication credentials.",
    configure(command) {
      command
        .summary("Save your OpenAI API key locally")
        .description(
          `Prompts for an OpenAI API key and stores it in your local ${appMetadata.displayName} config.`
        )
        .addHelpText("after", `\nExample:\n  ${appMetadata.cliName} auth`)
        .action(async () => {
          await commandService.auth();
        });
    }
  };
}

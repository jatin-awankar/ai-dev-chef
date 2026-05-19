export function createAuthCommand(commandService) {
  return {
    name: "auth",
    description: "Configure local authentication credentials.",
    configure(command) {
      command
        .summary("Save your OpenAI API key locally")
        .description(
          "Prompts for an OpenAI API key and stores it in your local AI-Dev-Chef config."
        )
        .addHelpText("after", "\nExample:\n  aidevchef auth")
        .action(async () => {
          await commandService.auth();
        });
    }
  };
}

export function createChatCommand(commandService) {
  return {
    name: "chat",
    description: "Start an interactive assistant chat session.",
    configure(command) {
      command
        .summary("Open assistant chat")
        .description(
          "Start an interactive chat mode for ongoing development assistance."
        )
        .option("-m, --mode <mode>", "Chat mode profile", "default")
        .option("--session <id>", "Resume an existing session by id")
        .addHelpText(
          "after",
          "\nExample:\n  aidevchef chat --mode default --session local-dev"
        )
        .action(async (options) => {
          await commandService.chat({
            mode: options.mode,
            sessionId: options.session ?? ""
          });
        });
    }
  };
}

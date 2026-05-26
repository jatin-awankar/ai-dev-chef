export function createHistoryCommand(commandService) {
  return {
    name: "history",
    description: "Manage local chat history.",
    configure(command) {
      command
        .summary("View or clear saved chat history")
        .description("Display local Fortify conversation history or clear it.")
        .option("--clear", "Clear all local chat history")
        .addHelpText("after", "\nExamples:\n  fortify history\n  fortify history --clear")
        .action(async (options) => {
          await commandService.history({
            clear: Boolean(options.clear)
          });
        });
    }
  };
}

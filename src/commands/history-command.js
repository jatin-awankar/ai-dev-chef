import { appMetadata } from "../config/app-metadata.js";

export function createHistoryCommand(commandService) {
  return {
    name: "history",
    description: "Manage local chat history.",
    configure(command) {
      command
        .summary("View, inspect, or clear saved chat history")
        .description(`Display local ${appMetadata.displayName} conversation history, inspect a session, or clear history.`)
        .option("--list", "List saved chat sessions (default behavior)")
        .option("--show <session-id>", "Show the full transcript for a specific session")
        .option("--clear", "Clear all local chat history")
        .addHelpText(
          "after",
          `\nExamples:\n  ${appMetadata.cliName} history\n  ${appMetadata.cliName} history --list\n  ${appMetadata.cliName} history --show default\n  ${appMetadata.cliName} history --clear`
        )
        .action(async (options) => {
          await commandService.history({
            list: Boolean(options.list),
            show: options.show,
            clear: Boolean(options.clear)
          });
        });
    }
  };
}

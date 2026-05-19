export function createSummarizeCommand(commandService) {
  return {
    name: "summarize",
    description: "Summarize code, diffs, or project activity.",
    configure(command) {
      command
        .summary("Summarize development context")
        .description(
          "Produce concise summaries from files, diffs, logs, or recent project activity."
        )
        .argument("[source]", "Path or source identifier to summarize")
        .option("-f, --format <format>", "Summary format", "bullet")
        .addHelpText(
          "after",
          "\nExample:\n  ai-dev-chef summarize src --format bullet"
        )
        .action(async (source, options) => {
          await commandService.summarize({
            source,
            format: options.format
          });
        });
    }
  };
}

export function createExplainCommand(commandService) {
  return {
    name: "explain",
    description: "Explain code, errors, or terminal output.",
    configure(command) {
      command
        .summary("Explain technical context")
        .description(
          "Generate an explanation for code snippets, error messages, or command output."
        )
        .argument("[target]", "File path, symbol, or topic to explain")
        .option("-c, --context <text>", "Additional context to improve explanation")
        .addHelpText(
          "after",
          "\nExample:\n  ai-dev-chef explain src/index.js --context \"entrypoint flow\""
        )
        .action(async (target, options) => {
          await commandService.explain({
            target,
            context: options.context ?? ""
          });
        });
    }
  };
}

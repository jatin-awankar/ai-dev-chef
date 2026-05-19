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
        .argument("<file-or-text>", "Stack trace file path or pasted error text")
        .option("-c, --context <text>", "Additional context to improve explanation")
        .addHelpText(
          "after",
          "\nExamples:\n  aidevchef explain ./logs/error.log\n  aidevchef explain \"TypeError: x is not a function\\n    at main (index.js:12:3)\""
        )
        .action(async (targetInput, options) => {
          await commandService.explain({
            target: targetInput,
            context: options.context ?? ""
          });
        });
    }
  };
}

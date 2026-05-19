export function createCommitCommand(commandService) {
  return {
    name: "commit",
    description: "Draft and review commit messages.",
    configure(command) {
      command
        .summary("Prepare commit message drafts")
        .description(
          "Create commit message suggestions from staged changes and repository context."
        )
        .option("-s, --style <style>", "Commit style convention", "conventional")
        .option("--scope <scope>", "Optional commit scope")
        .addHelpText(
          "after",
          "\nExample:\n  ai-dev-chef commit --style conventional --scope cli"
        )
        .action(async (options) => {
          await commandService.commit({
            style: options.style,
            scope: options.scope ?? ""
          });
        });
    }
  };
}

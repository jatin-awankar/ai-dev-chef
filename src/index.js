import { Command } from "commander";
import { registerCommands } from "./commands/index.js";
import { appMetadata } from "./config/app-metadata.js";

export async function runCli(argv = process.argv) {
  const program = new Command();

  program
    .name(appMetadata.cliName)
    .description(appMetadata.description)
    .version(appMetadata.version);

  registerCommands(program);

  await program.parseAsync(argv);
}

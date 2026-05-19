import { getCommandDefinitions } from "./command-loader.js";

export function registerCommands(program) {
  const commandDefinitions = getCommandDefinitions();

  for (const definition of commandDefinitions) {
    const command = program.command(definition.name).description(definition.description);
    definition.configure(command);
  }
}

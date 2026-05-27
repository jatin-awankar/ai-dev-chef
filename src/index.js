import { Command } from "commander";
import { registerCommands } from "./commands/index.js";
import { appMetadata } from "./config/app-metadata.js";
import { createTerminalUI } from "./renderers/index.js";
import {
  isDemoModeEnabled,
  setDemoModeForProcess,
  setDemoProfileForProcess,
} from "./services/demo/index.js";

export async function runCli(argv = process.argv) {
  const program = new Command();
  const terminalUI = createTerminalUI();
  let demoBannerShown = false;

  program
    .name(appMetadata.cliName)
    .description(appMetadata.description)
    .version(appMetadata.version)
    .option("--demo [profile]", "Run in demo mode (optional profile: showcase)");

  program.hook("preAction", (command) => {
    const demoOption = command?.optsWithGlobals?.().demo;
    if (demoOption) {
      setDemoModeForProcess(true);
      if (typeof demoOption === "string") {
        setDemoProfileForProcess(demoOption);
      }
    }

    if (isDemoModeEnabled() && !demoBannerShown) {
      terminalUI.info(`${appMetadata.displayName} [DEMO MODE]`);
      demoBannerShown = true;
    }
  });

  registerCommands(program);

  await program.parseAsync(argv);
}

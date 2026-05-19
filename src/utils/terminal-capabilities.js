export function detectTerminalCapabilities({
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  env = process.env
} = {}) {
  const isTTY = Boolean(stdin?.isTTY && stdout?.isTTY && stderr?.isTTY);
  const isDumbTerminal = env.TERM === "dumb";
  const isNonInteractive = !isTTY || isDumbTerminal;

  const shouldUseColor = !isNonInteractive && !("NO_COLOR" in env);
  const shouldUseSpinner = !isNonInteractive;

  return {
    isTTY,
    isInteractive: !isNonInteractive,
    isNonInteractive,
    shouldUseColor,
    shouldUseSpinner
  };
}

#!/usr/bin/env node
/**
 * Smoke checks before npm publish. Run: npm run verify
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

const errors = [];

if (pkg.private === true) {
  errors.push('package.json: "private" must not be true when publishing.');
}

if (!pkg.files || !Array.isArray(pkg.files) || pkg.files.length === 0) {
  errors.push('package.json: add a "files" array so the tarball is explicit.');
}

if (!pkg.license) {
  errors.push('package.json: add "license" (e.g. "MIT").');
}

if (!pkg.bin || typeof pkg.bin !== "object" || !pkg.bin.fortify) {
  errors.push('package.json: "bin.fortify" must point to the CLI entry.');
}

const help = spawnSync(process.execPath, [path.join(root, "bin", "fortify.js"), "--help"], {
  encoding: "utf8",
  cwd: root,
});

if (help.status !== 0) {
  errors.push(`CLI --help failed: ${help.stderr || help.stdout}`);
}

if (!help.stdout.includes("fortify")) {
  errors.push("CLI --help output should mention fortify.");
}

if (errors.length) {
  console.error("verify-publish failed:\n");
  for (const line of errors) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log("verify-publish: OK");
console.log(`  package: ${pkg.name}@${pkg.version}`);
console.log(`  bin: ${JSON.stringify(pkg.bin)}`);

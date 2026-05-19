import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const CONFIG_DIRECTORY_NAME = ".aidevchef";
const CONFIG_FILE_NAME = "config.json";

const DEFAULT_CONFIG = {
  apiKeys: {
    openai: "",
  },
  modelPreferences: {
    defaultModel: "gpt-5.1",
    fallbackModel: "gpt-5.4-mini",
  },
  theme: {
    name: "default",
    useColor: true,
  },
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeObjects(baseObject, overrideObject) {
  const output = { ...baseObject };

  if (!isPlainObject(overrideObject)) {
    return output;
  }

  for (const [key, value] of Object.entries(overrideObject)) {
    if (isPlainObject(value) && isPlainObject(baseObject[key])) {
      output[key] = mergeObjects(baseObject[key], value);
      continue;
    }

    output[key] = value;
  }

  return output;
}

function normalizeConfig(configObject) {
  return mergeObjects(DEFAULT_CONFIG, configObject);
}

export function getConfigDirectory() {
  return path.join(homedir(), CONFIG_DIRECTORY_NAME);
}

export function getConfigPath() {
  return path.join(getConfigDirectory(), CONFIG_FILE_NAME);
}

export function getDefaultConfig() {
  return structuredClone(DEFAULT_CONFIG);
}

export async function loadConfig() {
  const configPath = getConfigPath();

  try {
    const configFileContent = await readFile(configPath, "utf8");
    const parsedConfig = JSON.parse(configFileContent);
    return normalizeConfig(parsedConfig);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return getDefaultConfig();
    }

    throw error;
  }
}

export async function saveConfig(config) {
  const configDirectory = getConfigDirectory();
  const configPath = getConfigPath();
  const normalizedConfig = normalizeConfig(config);

  await mkdir(configDirectory, { recursive: true });
  await writeFile(
    configPath,
    `${JSON.stringify(normalizedConfig, null, 2)}\n`,
    "utf8",
  );

  return normalizedConfig;
}

export async function updateConfig(configPatch) {
  const currentConfig = await loadConfig();
  const nextConfig = mergeObjects(currentConfig, configPatch);
  return saveConfig(nextConfig);
}

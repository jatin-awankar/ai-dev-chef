import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const HISTORY_DIR_NAME = ".fortify";
const HISTORY_SUBDIR_NAME = "history";
const HISTORY_FILE_EXTENSION = ".json";

const DEFAULT_LIMITS = {
  maxSessionFiles: 200,
  maxMessagesPerSession: 400,
  maxMessageChars: 8_000,
  maxTotalBytes: 8 * 1024 * 1024
};

function normalizeSessionId(sessionId) {
  const fallback = "default";
  if (typeof sessionId !== "string") {
    return fallback;
  }

  const trimmed = sessionId.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80) || fallback;
}

function normalizeMessage(message, limits) {
  const role =
    message?.role === "assistant" || message?.role === "system" || message?.role === "developer"
      ? message.role
      : "user";
  const createdAt = typeof message?.createdAt === "string" ? message.createdAt : new Date().toISOString();
  const rawContent = typeof message?.content === "string" ? message.content : String(message?.content ?? "");

  return {
    role,
    content: rawContent.slice(0, limits.maxMessageChars),
    createdAt
  };
}

function normalizeSessionPayload(payload, limits) {
  const id = normalizeSessionId(payload?.id);
  const createdAt = typeof payload?.createdAt === "string" ? payload.createdAt : new Date().toISOString();
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];

  return {
    id,
    createdAt,
    messages: messages.slice(-limits.maxMessagesPerSession).map((message) => normalizeMessage(message, limits)),
    updatedAt: new Date().toISOString()
  };
}

export class LocalHistoryStore {
  constructor({
    baseDirectory,
    limits = DEFAULT_LIMITS
  } = {}) {
    this.baseDirectory = baseDirectory ?? path.join(homedir(), HISTORY_DIR_NAME, HISTORY_SUBDIR_NAME);
    this.limits = {
      ...DEFAULT_LIMITS,
      ...limits
    };
  }

  getHistoryDirectory() {
    return this.baseDirectory;
  }

  getSessionFilePath(sessionId) {
    const normalizedSessionId = normalizeSessionId(sessionId);
    return path.join(this.getHistoryDirectory(), `${normalizedSessionId}${HISTORY_FILE_EXTENSION}`);
  }

  async ensureHistoryDirectory() {
    await mkdir(this.getHistoryDirectory(), { recursive: true });
  }

  async saveSession(session) {
    const normalizedSession = normalizeSessionPayload(session, this.limits);
    await this.ensureHistoryDirectory();
    await this.#enforceHistoryLimits();

    const filePath = this.getSessionFilePath(normalizedSession.id);
    const serialized = `${JSON.stringify(normalizedSession, null, 2)}\n`;
    await writeFile(filePath, serialized, "utf8");
    return normalizedSession;
  }

  async loadSession(sessionId) {
    const filePath = this.getSessionFilePath(sessionId);

    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      return normalizeSessionPayload(parsed, this.limits);
    } catch (error) {
      if (error?.code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  async listSessions() {
    await this.ensureHistoryDirectory();

    const entries = await readdir(this.getHistoryDirectory(), { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(HISTORY_FILE_EXTENSION))
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left));

    const sessions = [];
    for (const fileName of files.slice(0, this.limits.maxSessionFiles)) {
      const sessionId = fileName.slice(0, -HISTORY_FILE_EXTENSION.length);
      const session = await this.loadSession(sessionId);
      if (session) {
        sessions.push({
          id: session.id,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messageCount: session.messages.length
        });
      }
    }

    sessions.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
    return sessions;
  }

  async clearHistory() {
    await rm(this.getHistoryDirectory(), { recursive: true, force: true });
    await this.ensureHistoryDirectory();
  }

  async #enforceHistoryLimits() {
    const directoryPath = this.getHistoryDirectory();
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(HISTORY_FILE_EXTENSION)) {
        continue;
      }

      const filePath = path.join(directoryPath, entry.name);
      const details = await stat(filePath);
      files.push({
        filePath,
        size: details.size,
        mtimeMs: details.mtimeMs
      });
    }

    files.sort((left, right) => left.mtimeMs - right.mtimeMs);

    let totalBytes = files.reduce((accumulator, item) => accumulator + item.size, 0);
    while (
      files.length >= this.limits.maxSessionFiles ||
      totalBytes > this.limits.maxTotalBytes
    ) {
      const oldest = files.shift();
      if (!oldest) {
        break;
      }

      await rm(oldest.filePath, { force: true });
      totalBytes -= oldest.size;
    }
  }
}

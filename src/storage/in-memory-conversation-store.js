function buildSessionId(sessionId) {
  if (typeof sessionId === "string" && sessionId.trim()) {
    return sessionId.trim();
  }

  return "default";
}

function normalizeRole(role) {
  if (role === "assistant" || role === "system" || role === "developer") {
    return role;
  }

  return "user";
}

export class InMemoryConversationStore {
  constructor() {
    this.sessions = new Map();
  }

  getOrCreateSession(sessionId = "default") {
    const resolvedSessionId = buildSessionId(sessionId);
    const existingSession = this.sessions.get(resolvedSessionId);

    if (existingSession) {
      return existingSession;
    }

    const nextSession = {
      id: resolvedSessionId,
      createdAt: new Date().toISOString(),
      messages: []
    };

    this.sessions.set(resolvedSessionId, nextSession);
    return nextSession;
  }

  addMessage(sessionId, { role, content }) {
    const session = this.getOrCreateSession(sessionId);
    const normalizedContent = typeof content === "string" ? content : String(content ?? "");

    const message = {
      role: normalizeRole(role),
      content: normalizedContent,
      createdAt: new Date().toISOString()
    };

    session.messages.push(message);
    return message;
  }

  toResponseInput(sessionId) {
    const session = this.getOrCreateSession(sessionId);
    return session.messages.map((message) => ({
      role: message.role,
      content: message.content
    }));
  }
}

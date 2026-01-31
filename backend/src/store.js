// store.js — MVP in-memory

// token -> { email, createdAt, consumed, lastIpHash, lastUaHash }
export const accessTokens = new Map();

// sessionId -> { token, email, createdAt, expiresAt }
export const sessions = new Map();

export function createAccessToken(token, email) {
  accessTokens.set(token, {
    email: (email || "").trim().toLowerCase(),
    createdAt: Date.now(),
    consumed: false,
    lastIpHash: null,
    lastUaHash: null,
  });
}

export function getAccessToken(token) {
  return accessTokens.get(token);
}

export function consumeAccessToken(token) {
  const obj = accessTokens.get(token);
  if (!obj) return false;
  obj.consumed = true;
  accessTokens.set(token, obj);
  return true;
}

export function createSession(sessionId, token, email, ttlMs) {
  const now = Date.now();
  sessions.set(sessionId, {
    token,
    email,
    createdAt: now,
    expiresAt: now + ttlMs,
  });
}

export function getSession(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  return s;
}

export function deleteSession(sessionId) {
  sessions.delete(sessionId);
}

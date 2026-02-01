import { redis } from "./redis.js";

const TOKEN_PREFIX = "token:";
const SESS_PREFIX = "sess:";

export async function createAccessToken(token, email, ttlMs) {
  const key = TOKEN_PREFIX + token;
  const value = {
    email: (email || "").trim().toLowerCase(),
    createdAt: Date.now(),
    consumed: false,
  };
  await redis.set(key, value, { ex: Math.ceil(ttlMs / 1000) });
}

export async function getAccessToken(token) {
  return await redis.get(TOKEN_PREFIX + token);
}

export async function consumeAccessToken(token) {
  const key = TOKEN_PREFIX + token;
  const obj = await redis.get(key);
  if (!obj) return false;
  obj.consumed = true;
  // mantém a chave viva (TTL continua existindo, mas é OK para MVP)
  await redis.set(key, obj);
  return true;
}

export async function createSession(sessionId, token, email, ttlMs) {
  const key = SESS_PREFIX + sessionId;
  const value = {
    token,
    email: (email || "").trim().toLowerCase(),
    createdAt: Date.now(),
  };
  await redis.set(key, value, { ex: Math.ceil(ttlMs / 1000) });
}

export async function getSession(sessionId) {
  return await redis.get(SESS_PREFIX + sessionId);
}

export async function deleteSession(sessionId) {
  await redis.del(SESS_PREFIX + sessionId);
}

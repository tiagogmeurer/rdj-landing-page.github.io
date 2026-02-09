import { redis } from "./redis.js";

const TOKEN_PREFIX = "token:";
const SESS_PREFIX = "sess:";
const RECOVER_PREFIX = "recover:"; // recover:<token> -> { email, createdAt }
const ENT_PREFIX = "ent:"; // ent:<email> -> { active, email, updatedAt, ... }

function normEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}


// =====================
// Access token (Kirvano)
// =====================

export async function createAccessToken(token, email, ttlMs) {
  const safeToken = String(token);
  const safeEmail = normEmail(email);

  // TTL default: 24h se vier inválido
  const ttl = Number(ttlMs);
  const safeTtlMs = Number.isFinite(ttl) && ttl > 0 ? ttl : 1000 * 60 * 60 * 24;

  const key = TOKEN_PREFIX + safeToken;

  const value = {
    email: safeEmail,
    createdAt: Date.now(),
    consumed: false,
  };

  await redis.set(key, value, {
    ex: Math.ceil(safeTtlMs / 1000),
  });

  return safeToken;
}


export async function getAccessToken(token) {
  return await redis.get(TOKEN_PREFIX + token);
}

export async function consumeAccessToken(token) {
  const key = TOKEN_PREFIX + token;
  const obj = await redis.get(key);
  if (!obj) return false;

  obj.consumed = true;

  // ✅ preserva TTL
  const ttl = await redis.ttl(key); // segundos
  if (ttl && ttl > 0) {
    await redis.set(key, obj, { ex: ttl });
  } else {
    // fallback: não tinha TTL (ou já expirou)
    await redis.set(key, obj);
  }

  return true;
}

// =====================
// Session
// =====================

export async function createSession(sessionId, token, email, ttlMs) {
  const key = SESS_PREFIX + sessionId;
  const value = {
    token,
    email: normEmail(email),
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

// =====================
// Recovery (Magic link)
// =====================

export async function createRecoverToken(token, email, ttlMs) {
  const key = RECOVER_PREFIX + token;
  const value = {
    email: normEmail(email),
    createdAt: Date.now(),
  };
  await redis.set(key, value, { ex: Math.ceil(ttlMs / 1000) });
}

export async function getRecoverToken(token) {
  return await redis.get(RECOVER_PREFIX + token);
}

// one-time
export async function consumeRecoverToken(token) {
  const key = RECOVER_PREFIX + token;
  const obj = await redis.get(key);
  if (!obj) return null;
  await redis.del(key);
  return obj; // { email, createdAt }
}

// =====================
// Entitlement (direito de acesso)
// =====================

export async function setEntitlementActive(email, meta = {}) {
  const key = ENT_PREFIX + normEmail(email);
  const value = {
    email: normEmail(email),
    active: true,
    updatedAt: Date.now(),
    ...meta,
  };
  await redis.set(key, value); // sem TTL por padrão
}

export async function revokeEntitlement(email, meta = {}) {
  const key = ENT_PREFIX + normEmail(email);
  const value = {
    email: normEmail(email),
    active: false,
    updatedAt: Date.now(),
    ...meta,
  };
  await redis.set(key, value);
}

export async function getEntitlement(email) {
  return await redis.get(ENT_PREFIX + normEmail(email));
}

export async function hasActiveEntitlement(email) {
  const ent = await getEntitlement(email);
  return !!(ent && ent.active === true);
}

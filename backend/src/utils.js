import crypto from "crypto";

export function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

export function hashLight(str) {
  return crypto.createHash("sha256").update(String(str || "")).digest("hex");
}

export function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.socket?.remoteAddress || "";
}

// tenta achar email no payload (cada webhook pode variar)
export function extractEmailFromKirvanoPayload(body) {
  const candidates = [
    body?.customer?.email,
    body?.buyer?.email,
    body?.data?.customer?.email,
    body?.data?.buyer?.email,
    body?.data?.email,
    body?.email,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.includes("@")) return c;
  }
  return null;
}

export function extractEventName(body) {
  return body?.event || body?.type || body?.nome_evento || body?.action || null;
}

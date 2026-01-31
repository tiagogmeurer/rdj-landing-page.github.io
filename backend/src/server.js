import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

import {
  createAccessToken,
  getAccessToken,
  consumeAccessToken,
  createSession,
  getSession,
  deleteSession,
} from "./store.js";

import {
  normalizeEmail,
  extractEmailFromKirvanoPayload,
  extractEventName,
  getClientIp,
  hashLight,
} from "./utils.js";

const app = express();

// ====== ENV ======
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";
const KIRVANO_WEBHOOK_SECRET = process.env.KIRVANO_WEBHOOK_SECRET || "";
const APP_PUBLIC_BASE_URL =
  process.env.APP_PUBLIC_BASE_URL || "http://localhost:3000";

// ✅ NOVO: base pública da API (Render / domínio real)
const API_PUBLIC_BASE_URL =
  process.env.API_PUBLIC_BASE_URL || `http://localhost:${PORT}`;

const COOKIE_NAME = process.env.COOKIE_NAME || "rdj_session";
const COOKIE_DAYS = Number(process.env.COOKIE_DAYS || 30);
const SESSION_TTL_MS = COOKIE_DAYS * 24 * 60 * 60 * 1000;

const isProd = NODE_ENV === "production";

// ====== MIDDLEWARES ======
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// CORS só é necessário se você for fazer fetch do front.
app.use(
  cors({
    origin: APP_PUBLIC_BASE_URL,
    credentials: true,
  })
);

// rate limit básico (anti-abuso)
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ====== HEALTHZ ======
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "robodojob-backend", ts: Date.now() });
});

// ====== WEBHOOK KIRVANO ======
app.post("/webhook/kirvano", (req, res) => {
  const incoming = req.headers["x-kirvano-token"];
  if (!KIRVANO_WEBHOOK_SECRET || incoming !== KIRVANO_WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const event = extractEventName(req.body);
  if (!event || String(event).toLowerCase() !== "compra_aprovada") {
    return res.json({ ok: true, ignored: true, event });
  }

  const emailRaw = extractEmailFromKirvanoPayload(req.body);
  const email = normalizeEmail(emailRaw);

  if (!email) {
    console.log("[kirvano] compra_aprovada SEM email:", JSON.stringify(req.body));
    return res.json({ ok: true, warning: "missing_email" });
  }

  const token = crypto.randomUUID();
  createAccessToken(token, email);

  // ✅ ALTERADO: agora usa a base pública (local ou produção)
  const accessUrl = `${API_PUBLIC_BASE_URL}/acesso/${token}`;

  console.log("[kirvano] aprovado:", { email, token, accessUrl });

  return res.json({ ok: true, accessUrl });
});

// ====== HELPERS ======
function setSessionCookie(res, sessionId) {
  res.cookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

function requireSession(req, res, next) {
  const sid = req.cookies?.[COOKIE_NAME];
  if (!sid) return res.status(401).send("Sem sessão. Volte ao seu link de acesso.");
  const s = getSession(sid);
  if (!s) return res.status(401).send("Sessão expirada. Volte ao seu link de acesso.");
  req.session = s;
  return next();
}

// ====== CONFIRMA E-MAIL (tela simples) ======
app.get("/acesso/:token", (req, res) => {
  const token = req.params.token;
  const record = getAccessToken(token);

  if (!record) {
    return res.status(404).send("Link inválido ou expirado.");
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.end(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Robô do Job — Acesso</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto; background:#0b0b0f; color:#fff; display:flex; min-height:100vh; align-items:center; justify-content:center; }
    .card { width:min(520px, 92vw); background:#12121a; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:24px; }
    input { width:100%; padding:14px; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:#0f0f16; color:#fff; margin:12px 0; }
    button { width:100%; padding:14px; border-radius:12px; border:none; background:#fe3b3b; color:#fff; font-weight:700; cursor:pointer; }
    .muted { color: rgba(255,255,255,.7); font-size:14px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Confirmar e-mail</h2>
    <p class="muted">Digite o e-mail usado na compra para liberar o acesso.</p>
    <form method="POST" action="/acesso/${token}">
      <input type="email" name="email" placeholder="seuemail@exemplo.com" required />
      <button type="submit">Liberar acesso</button>
    </form>
  </div>
</body>
</html>`);
});

app.post(
  "/acesso/:token",
  express.urlencoded({ extended: false }),
  (req, res) => {
    const token = req.params.token;
    const record = getAccessToken(token);
    if (!record) return res.status(404).send("Link inválido ou expirado.");

    const email = normalizeEmail(req.body?.email);
    if (!email || email !== record.email) {
      return res.status(401).send("E-mail não confere com a compra.");
    }

    // token consumível
    consumeAccessToken(token);

    const sessionId = crypto.randomUUID();
    createSession(sessionId, token, email, SESSION_TTL_MS);

    // fingerprint light (opcional)
    record.lastIpHash = hashLight(getClientIp(req));
    record.lastUaHash = hashLight(req.headers["user-agent"] || "");

    setSessionCookie(res, sessionId);
    return res.redirect("/conteudo");
  }
);

// ====== CONTEÚDO PROTEGIDO ======
app.get("/conteudo", requireSession, (req, res) => {
  const email = req.session.email;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.end(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Robô do Job — Conteúdo</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto; background:#0b0b0f; color:#fff; padding:32px; }
    .box { max-width:760px; margin:0 auto; background:#12121a; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:24px; }
    a.btn { display:inline-block; padding:12px 16px; background:#fe3b3b; color:#fff; border-radius:12px; text-decoration:none; font-weight:700; }
    .muted { color: rgba(255,255,255,.7); }
  </style>
</head>
<body>
  <div class="box">
    <h2>Acesso liberado ✅</h2>
    <p class="muted">Sessão vinculada ao e-mail: <b>${email}</b></p>

    <p style="margin-top:18px">Agora é só você plugar seus materiais aqui.</p>

    <p>
      <a class="btn" href="/download/material">Baixar material</a>
    </p>

    <form method="POST" action="/logout">
      <button style="margin-top:16px; padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:transparent; color:#fff; cursor:pointer;">
        Sair
      </button>
    </form>
  </div>
</body>
</html>`);
});

app.get("/download/material", requireSession, (_req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send("Aqui entraria o download real do seu material (protegido por sessão).");
});

app.post("/logout", (req, res) => {
  const sid = req.cookies?.[COOKIE_NAME];
  if (sid) deleteSession(sid);
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.redirect(APP_PUBLIC_BASE_URL);
});

app.listen(PORT, () => {
  console.log(`robodojob-backend on ${API_PUBLIC_BASE_URL}`);
});

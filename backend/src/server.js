import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import fs from "fs";
import path from "path";

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

import { generateSignedUrl } from "./r2.js";

const app = express();

// ====== ENV ======
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";
const KIRVANO_WEBHOOK_SECRET = process.env.KIRVANO_WEBHOOK_SECRET || "";

const APP_PUBLIC_BASE_URL =
  process.env.APP_PUBLIC_BASE_URL || "http://localhost:3000";

// Base pública da API (Render / domínio real)
const API_PUBLIC_BASE_URL =
  process.env.API_PUBLIC_BASE_URL || `http://localhost:${PORT}`;

const COOKIE_NAME = process.env.COOKIE_NAME || "rdj_session";
const COOKIE_DAYS = Number(process.env.COOKIE_DAYS || 30);
const SESSION_TTL_MS = COOKIE_DAYS * 24 * 60 * 60 * 1000;

const isProd = NODE_ENV === "production";

// ====== CONFIG: MANUAL + R2 KEYS ======
// HTML do manual ficará dentro do backend (Render) para controle total:
const MANUAL_HTML_FILENAME =
  process.env.MANUAL_HTML_FILENAME || "RobodoJobManualPrincipal.html";

// R2 keys (paths dentro do bucket)
const R2_MANUAL_PREFIX = "manual/"; // manual/images/...
const R2_VIDEOS_PREFIX = "videos/"; // videos/intro.mp4, videos/guia.mp4

// IDs públicos -> objetos no R2 (allowlist)
const MEDIA_ALLOWLIST = {
  intro: `${R2_VIDEOS_PREFIX}intro.mp4`,
  guia: `${R2_VIDEOS_PREFIX}guia.mp4`,
};

// ====== MIDDLEWARES ======
app.use(
  helmet({
    // 🔥 CSP ajustado para permitir assets do R2 via https (presigned URLs)
    // - imagens/gifs do manual: <img src="https://...">
    // - vídeos do player: <video src="https://...">
    // - fetch do player continua same-origin (/api/media/...)
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),

          // ✅ LIBERA o <script> inline da página /conteudo/videos
        "script-src": ["'self'", "'unsafe-inline'"],

        // Permite imagens locais + data: + remotas (https) (R2)
        "img-src": ["'self'", "data:", "blob:", "https:"],

        // Permite mídia (vídeo/audio) remota via https (R2)
        "media-src": ["'self'", "blob:", "https:"],

        // Se algum asset do manual vier como fonte CSS, isso evita bloqueio
        // (opcional, mas seguro)
        "font-src": ["'self'", "data:", "https:"],

        // Mantém fetch/xhr apenas no mesmo host (sua API)
        // (se um dia você buscar de fora, adiciona aqui)
        "connect-src": ["'self'"],

        // Evita bloqueio por se você abrir o HTML do manual em nova guia
        // e ele tentar navegar para assets / links
        "frame-ancestors": ["'none'"],
      },
    },
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use(
  cors({
    origin: APP_PUBLIC_BASE_URL,
    credentials: true,
  })
);

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
app.post("/webhook/kirvano", async (req, res) => {
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
  await createAccessToken(token, email, SESSION_TTL_MS);

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

async function requireSession(req, res, next) {
  const sid = req.cookies?.[COOKIE_NAME];
  if (!sid)
    return res.status(401).send("Sem sessão. Volte ao seu link de acesso.");

  const s = await getSession(sid);
  if (!s)
    return res.status(401).send("Sessão expirada. Volte ao seu link de acesso.");

  req.session = s;
  return next();
}

// ====== CONFIRMA E-MAIL (tela simples) ======
app.get("/acesso/:token", async (req, res) => {
  const token = req.params.token;
  const record = await getAccessToken(token);

  if (!record) {
    return res.status(404).send("Link inválido ou expirado.");
  }

  if (record.consumed) {
    return res
      .status(410)
      .send("Este link já foi usado. Verifique seu acesso ou solicite um novo.");
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
  async (req, res) => {
    const token = req.params.token;
    const record = await getAccessToken(token);

    if (!record) return res.status(404).send("Link inválido ou expirado.");

    if (record.consumed) {
      return res
        .status(410)
        .send("Este link já foi usado. Verifique seu acesso ou solicite um novo.");
    }

    const email = normalizeEmail(req.body?.email);
    if (!email || email !== record.email) {
      return res.status(401).send("E-mail não confere com a compra.");
    }

    await consumeAccessToken(token);

    const sessionId = crypto.randomUUID();
    await createSession(sessionId, token, email, SESSION_TTL_MS);

    record.lastIpHash = hashLight(getClientIp(req));
    record.lastUaHash = hashLight(req.headers["user-agent"] || "");

    setSessionCookie(res, sessionId);
    return res.redirect("/conteudo");
  }
);

// ====== CONTEÚDO PROTEGIDO (HOME) ======
app.get("/conteudo", requireSession, (req, res) => {
  const email = req.session.email;

  res.setHeader("Cache-Control", "no-store");
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
    .box { max-width:880px; margin:0 auto; background:#12121a; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:24px; }
    a.btn { display:inline-block; padding:12px 16px; background:#fe3b3b; color:#fff; border-radius:12px; text-decoration:none; font-weight:700; margin-right:12px; }
    .muted { color: rgba(255,255,255,.7); }
    .row { display:flex; flex-wrap:wrap; gap:12px; margin-top:16px; }
    .card { border:1px solid rgba(255,255,255,.08); border-radius:14px; padding:16px; background:#0f0f16; }
  </style>
</head>
<body>
  <div class="box">
    <h2>Acesso liberado ✅</h2>
    <p class="muted">Sessão vinculada ao e-mail: <b>${email}</b></p>

    <div class="row">
      <a class="btn" href="/conteudo/manual">Abrir Manual (HTML)</a>
      <a class="btn" href="/conteudo/videos">Assistir Tutoriais</a>
    </div>

    <div style="margin-top:18px" class="card">
      <div class="muted">
        *Importante:* este conteúdo é protegido por sessão. Não compartilhe seu acesso.
      </div>
    </div>

    <form method="POST" action="/logout" style="margin-top:18px">
      <button style="padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:transparent; color:#fff; cursor:pointer;">
        Sair
      </button>
    </form>
  </div>
</body>
</html>`);
});

// ====== MANUAL (HTML no backend) ======
app.get("/conteudo/manual", requireSession, (req, res) => {
  const manualPath = path.join(
    process.cwd(),
    "private",
    "manual",
    MANUAL_HTML_FILENAME
  );

  if (!fs.existsSync(manualPath)) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res
      .status(500)
      .send(
        `Manual não encontrado no backend: private/manual/${MANUAL_HTML_FILENAME}`
      );
  }

  let html = fs.readFileSync(manualPath, "utf8");

  // Reescreve paths do manual: images/... -> /api/manual-assets/images/...
  // (cobre src/href com aspas duplas e simples)
  html = html.replaceAll('src="images/', 'src="/api/manual-assets/images/');
  html = html.replaceAll("src='images/", "src='/api/manual-assets/images/");
  html = html.replaceAll('href="images/', 'href="/api/manual-assets/images/');
  html = html.replaceAll("href='images/", "href='/api/manual-assets/images/");

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");

  return res.send(html);
});

// ====== ASSETS DO MANUAL (imagens/gifs no R2 via redirect assinado) ======
app.get("/api/manual-assets/*", requireSession, async (req, res) => {
  try {
    const assetPath = req.params[0]; // ex: "images/foo.gif"
    if (!assetPath || assetPath.includes("..")) {
      return res.status(400).send("Bad request");
    }

    const key = `${R2_MANUAL_PREFIX}${assetPath}`; // manual/images/...

    const url = await generateSignedUrl(key, 300); // 5 min
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, url);
  } catch (e) {
    console.error("[manual-assets] error:", e);
    return res.status(500).send("Erro ao gerar acesso ao asset");
  }
});

// ====== PÁGINA DE VÍDEOS (player) ======
app.get("/conteudo/videos", requireSession, (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.end(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Robô do Job — Vídeos</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto; background:#0b0b0f; color:#fff; padding:32px; }
    .box { max-width:980px; margin:0 auto; background:#12121a; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:24px; }
    .muted { color: rgba(255,255,255,.7); }
    .row { display:flex; gap:10px; flex-wrap:wrap; margin:14px 0; }
    button { padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:#0f0f16; color:#fff; cursor:pointer; }
    video { width: 100%; border-radius:14px; background:#000; margin-top:12px; }
    a { color:#fff; }
  </style>
</head>
<body>
  <div class="box">
    <h2>Vídeos do Tutorial</h2>
    <p class="muted">Clique para carregar o vídeo. O link expira e é renovado automaticamente quando você troca de vídeo.</p>

    <div class="row">
      <button onclick="loadVideo('intro')">RBDJ Tutorial — Intro</button>
      <button onclick="loadVideo('guia')">RBDJ Tutorial — Guia</button>
      <a href="/conteudo" style="align-self:center; margin-left:auto">← Voltar</a>
    </div>

    <div id="status" class="muted"></div>
    <video id="player" controls playsinline></video>
  </div>

<script>
async function loadVideo(id) {
  const status = document.getElementById('status');
  const player = document.getElementById('player');
  status.textContent = 'Carregando...';

  try {
    const res = await fetch('/api/media/' + id + '/url', { credentials: 'include' });
    if (!res.ok) throw new Error('Falha ao obter URL');
    const data = await res.json();
    if (!data.url) throw new Error('URL inválida');

    player.src = data.url;
    await player.play().catch(() => {});
    status.textContent = 'Pronto ✅';
  } catch (e) {
    status.textContent = 'Erro ao carregar vídeo. Recarregue a página.';
  }
}
</script>
</body>
</html>`);
});

// ====== MEDIA URL (presigned) ======
app.get("/api/media/:id/url", requireSession, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const key = MEDIA_ALLOWLIST[id];

    if (!key) {
      return res.status(404).json({ error: "midia_nao_encontrada" });
    }

    const url = await generateSignedUrl(key, 300); // 5 min
    res.setHeader("Cache-Control", "no-store");
    return res.json({ url });
  } catch (e) {
    console.error("[media-url] error:", e);
    return res.status(500).json({ error: "erro_gerar_url" });
  }
});

// ====== LOGOUT ======
app.post("/logout", async (req, res) => {
  const sid = req.cookies?.[COOKIE_NAME];
  if (sid) await deleteSession(sid);
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.redirect(APP_PUBLIC_BASE_URL);
});

app.listen(PORT, () => {
  console.log(`robodojob-backend on ${API_PUBLIC_BASE_URL}`);
});

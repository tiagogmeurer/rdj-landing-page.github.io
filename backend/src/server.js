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
  setEntitlementActive,
  hasActiveEntitlement,
  createRecoverToken,
  consumeRecoverToken,
} from "./store.js";

import {
  normalizeEmail,
  extractEmailFromKirvanoPayload,
  extractEventName,
  getClientIp,
  hashLight,
} from "./utils.js";

import { generateSignedUrl } from "./r2.js";
import { sendRecoverEmail } from "./mailer.js";

const app = express();

// ====== ENV ======
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";
const KIRVANO_WEBHOOK_SECRET = process.env.KIRVANO_WEBHOOK_SECRET || "";

// ✅ ADMIN seed token (Render env)
const ADMIN_SEED_TOKEN = process.env.ADMIN_SEED_TOKEN || "";

const APP_PUBLIC_BASE_URL =
  process.env.APP_PUBLIC_BASE_URL || "http://localhost:3000";

// Base pública da API (Render / domínio real)
const API_PUBLIC_BASE_URL =
  process.env.API_PUBLIC_BASE_URL || `http://localhost:${PORT}`;

const COOKIE_NAME = process.env.COOKIE_NAME || "rdj_session";
const COOKIE_DAYS = Number(process.env.COOKIE_DAYS || 30);
const SESSION_TTL_MS = COOKIE_DAYS * 24 * 60 * 60 * 1000;

const RECOVER_TTL_MINUTES = Number(process.env.RECOVER_TTL_MINUTES || 15);
const RECOVER_TTL_MS = RECOVER_TTL_MINUTES * 60 * 1000;

const isProd = NODE_ENV === "production";

// ====== CONFIG: MANUAL + R2 KEYS ======
const MANUAL_HTML_FILENAME =
  process.env.MANUAL_HTML_FILENAME || "RobodoJobManualPrincipal.html";

const R2_MANUAL_PREFIX = "manual/"; // manual/images/...
const R2_VIDEOS_PREFIX = "videos/"; // videos/intro.mp4, videos/guia.mp4

const MEDIA_ALLOWLIST = {
  intro: `${R2_VIDEOS_PREFIX}intro.mp4`,
  guia: `${R2_VIDEOS_PREFIX}guia.mp4`,
};

// ====== MIDDLEWARES ======
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),

        // ✅ libera inline script (se ainda tiver algum)
        "script-src": ["'self'", "'unsafe-inline'"],

        "img-src": ["'self'", "data:", "blob:", "https:"],
        "media-src": ["'self'", "blob:", "https:"],
        "font-src": ["'self'", "data:", "https:"],
        "connect-src": ["'self'"],
        "frame-ancestors": ["'none'"],
      },
    },
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ✅ CORS robusto (aceita landing e app; permite requests sem Origin)
const ALLOWED_ORIGINS = new Set([APP_PUBLIC_BASE_URL, API_PUBLIC_BASE_URL]);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // curl / server-to-server
      if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
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

  // ✅ Entitlement (verdade do acesso)
  await setEntitlementActive(email, {
    source: "kirvano",
    event: "compra_aprovada",
  });

  // ✅ Link de primeira entrada (fluxo atual)
  const token = crypto.randomUUID();
  await createAccessToken(token, email, SESSION_TTL_MS);

  const accessUrl = `${API_PUBLIC_BASE_URL}/acesso/${token}`;
  console.log("[kirvano] aprovado:", { email, token, accessUrl });

  return res.json({ ok: true, accessUrl });
});

// ====== HELPERS ======
function setSessionCookie(res, sessionId) {
  const cookieOpts = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  };

  // ✅ só seta domain em produção
  if (isProd) cookieOpts.domain = ".robodojob.com";

  res.cookie(COOKIE_NAME, sessionId, cookieOpts);
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

// ====== ADMIN: seed entitlement manual (para compras antigas) ======
app.post("/admin/entitle", async (req, res) => {
  const t = req.headers["x-admin-token"];
  if (!ADMIN_SEED_TOKEN || t !== ADMIN_SEED_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const email = normalizeEmail(String(req.body?.email || "").slice(0, 254));
  if (!email || !email.includes("@")) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }

  await setEntitlementActive(email, { source: "admin_seed" });
  return res.json({ ok: true, email });
});


// ====== UI: /acessar (recuperar sessão) ======
app.get("/acessar", (req, res) => {
  const e = String(req.query?.e || "").toLowerCase();

  const msgMap = {
    expired: "Seu link expirou ou já foi usado. Solicite um novo abaixo.",
    denied: "Não encontramos um acesso ativo para este e-mail.",
    invalid: "Link inválido. Solicite um novo abaixo.",
    error: "Ocorreu um erro. Tente novamente.",
  };

  const banner = msgMap[e] || "";

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.end(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Robô do Job — Recuperar acesso</title>
  <style>
    :root{
      --bg:#0b0b0f; --card:#12121a; --line:rgba(255,255,255,.10);
      --muted:rgba(255,255,255,.75); --danger:#fe3b3b;
      --ok:#30d158;
    }
    body{
      margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto;
      background:var(--bg); color:#fff; min-height:100vh;
      display:flex; align-items:center; justify-content:center; padding:24px;
    }
    .card{
      width:min(540px, 96vw);
      background:var(--card);
      border:1px solid var(--line);
      border-radius:16px;
      padding:22px;
      box-shadow:0 20px 60px rgba(0,0,0,.35);
    }
    h1{ font-size:22px; margin:0 0 6px; }
    p{ margin:0 0 14px; color:var(--muted); line-height:1.4; }
    .banner{
      border:1px solid rgba(254,59,59,.35);
      background:rgba(254,59,59,.10);
      color:#ffd2d2;
      padding:10px 12px;
      border-radius:12px;
      margin:12px 0 14px;
      display:${banner ? "block" : "none"};
    }
    input{
      width:100%;
      padding:14px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.14);
      background:#0f0f16;
      color:#fff;
      outline:none;
      font-size:15px;
      box-sizing:border-box;
    }
    button{
      width:100%;
      margin-top:12px;
      padding:14px;
      border-radius:12px;
      border:none;
      background:var(--danger);
      color:#fff;
      font-weight:800;
      cursor:pointer;
      font-size:15px;
    }
    button:disabled{ opacity:.65; cursor:not-allowed; }
    .status{
      margin-top:12px;
      color:var(--muted);
      font-size:14px;
      min-height:18px;
    }
    .hint{
      margin-top:14px;
      border-top:1px solid var(--line);
      padding-top:12px;
      font-size:13px;
      color:rgba(255,255,255,.6);
    }
    a{ color:#fff; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Recuperar acesso</h1>
    <p>Digite o e-mail usado na compra. Se existir um acesso ativo, vamos enviar um link temporário.</p>

    <div class="banner">${banner}</div>

    <form id="f" method="POST" action="/acessar" autocomplete="on">
      <input id="email" name="email" type="email" placeholder="seuemail@exemplo.com" required />
      <button id="btn" type="submit">Enviar link de acesso</button>
      <div id="status" class="status"></div>
    </form>

    <div class="hint">
      Dica: o link expira em alguns minutos e pode ser usado apenas uma vez.
    </div>
  </div>

<script>
(() => {
  const form = document.getElementById('f');
  const email = document.getElementById('email');
  const btn = document.getElementById('btn');
  const status = document.getElementById('status');

  function setState(text, ok){
    status.textContent = text || '';
    status.style.color = ok ? 'var(--ok)' : 'var(--muted)';
  }

  form.addEventListener('submit', async (ev) => {
    // tenta via fetch (melhor UX); se falhar, cai no POST normal
    ev.preventDefault();
    const v = (email.value || '').trim();
    if (!v) return;

    btn.disabled = true;
    setState('Enviando...', false);

    try{
      const res = await fetch('/api/recover', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        cache:'no-store',
        body: JSON.stringify({ email: v })
      });

      // resposta sempre neutra
      if (!res.ok) throw new Error('bad_status');

      setState('Se existir uma compra ativa, enviaremos um link para seu e-mail. ✅', true);
      btn.disabled = false;
    }catch(err){
      // fallback: deixa o form postar normalmente
      btn.disabled = false;
      form.submit();
    }
  });
})();
</script>
</body>
</html>`);
});

// ====== Fallback sem JS: POST /acessar -> chama /api/recover e mostra confirmação ======
app.post("/acessar", express.urlencoded({ extended: false }), async (req, res) => {
  // chama a mesma lógica do /api/recover (resposta neutra)
  const email = normalizeEmail(String(req.body?.email || "").slice(0, 254));

  try {
    if (email && email.includes("@")) {
      const entitled = await hasActiveEntitlement(email);
      if (entitled) {
        const token = crypto.randomUUID();
        await createRecoverToken(token, email, RECOVER_TTL_MS);
        const link = `${API_PUBLIC_BASE_URL}/acesso/recover/${token}`;
        await sendRecoverEmail({ to: email, link });
      }
    }
  } catch (e) {
    console.error("[acessar-post] error:", e);
  }

  // UI de confirmação (neutra)
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.end(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Robô do Job — Recuperar acesso</title>
  <style>
    body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto;background:#0b0b0f;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{width:min(540px,96vw);background:#12121a;border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:22px}
    h1{font-size:22px;margin:0 0 10px}
    p{margin:0 0 12px;color:rgba(255,255,255,.75);line-height:1.4}
    a{display:inline-block;margin-top:10px;color:#fff}
  </style>
</head>
<body>
  <div class="card">
    <h1>Pedido enviado ✅</h1>
    <p>Se existir uma compra ativa, enviamos um link temporário para o e-mail informado.</p>
    <p>Confira também a pasta de spam/promoções.</p>
    <a href="/acessar">← Voltar</a>
  </div>
</body>
</html>`);
});



// ====== RECOVER: gera e-mail com link mágico ======
app.post("/api/recover", async (req, res) => {
  // resposta neutra sempre (anti-enumeração)
  const ok = () =>
    res.status(200).json({
      ok: true,
      message:
        "Se existir uma compra ativa, enviaremos um link de acesso para seu e-mail.",
    });

  try {
    const email = normalizeEmail(String(req.body?.email || "").slice(0, 254));
    if (!email || !email.includes("@")) return ok();

    const entitled = await hasActiveEntitlement(email);
    if (!entitled) return ok();

    const token = crypto.randomUUID();
    await createRecoverToken(token, email, RECOVER_TTL_MS);

    const link = `${API_PUBLIC_BASE_URL}/acesso/recover/${token}`;
    await sendRecoverEmail({ to: email, link });

    return ok();
  } catch (e) {
    console.error("[recover] error:", e);
    return ok();
  }
});

// ====== RECOVER: consome token, cria sessão e redireciona ======
app.get("/acesso/recover/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.redirect(`${APP_PUBLIC_BASE_URL}/acessar?e=invalid`);

    const obj = await consumeRecoverToken(token); // one-time
    if (!obj?.email) {
      return res.redirect(`${APP_PUBLIC_BASE_URL}/acessar?e=expired`);
    }

    const email = normalizeEmail(obj.email);

    // hard check
    const entitled = await hasActiveEntitlement(email);
    if (!entitled) {
      return res.redirect(`${APP_PUBLIC_BASE_URL}/acessar?e=denied`);
    }

    const sessionId = crypto.randomUUID();
    await createSession(sessionId, "recover", email, SESSION_TTL_MS);

    setSessionCookie(res, sessionId);
    return res.redirect("/conteudo");
  } catch (e) {
    console.error("[recover-redirect] error:", e);
    return res.redirect(`${APP_PUBLIC_BASE_URL}/acessar?e=error`);
  }
});

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

// ====== ASSETS DO MANUAL (R2) ======
app.get("/api/manual-assets/*", requireSession, async (req, res) => {
  try {
    const assetPath = req.params[0];
    if (!assetPath || assetPath.includes("..")) {
      return res.status(400).send("Bad request");
    }

    const key = `${R2_MANUAL_PREFIX}${assetPath}`;
    const url = await generateSignedUrl(key, 300);

    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, url);
  } catch (e) {
    console.error("[manual-assets] error:", e);
    return res.status(500).send("Erro ao gerar acesso ao asset");
  }
});

// ====== PÁGINA DE VÍDEOS ======
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
    .row { display:flex; gap:10px; flex-wrap:wrap; margin:14px 0; align-items:center; }
    button { padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:#0f0f16; color:#fff; cursor:pointer; }
    video { width: 100%; border-radius:14px; background:#000; margin-top:12px; }
    a { color:#fff; }
  </style>
</head>
<body>
  <div class="box">
    <h2>Vídeos do Tutorial</h2>
    <p class="muted">
      Clique para carregar o vídeo. O link expira e é renovado automaticamente quando você troca de vídeo.
    </p>

    <div class="row">
      <button class="js-load-video" data-id="intro">RBDJ Tutorial — Intro</button>
      <button class="js-load-video" data-id="guia">RBDJ Tutorial — Guia</button>
      <a href="/conteudo" style="margin-left:auto">← Voltar</a>
    </div>

    <div id="status" class="muted"></div>
    <video id="player" controls playsinline></video>
  </div>

  <script src="/assets/videos.js"></script>
</body>
</html>`);
});

// ====== JS EXTERNO ======
app.get("/assets/videos.js", requireSession, (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  return res.end(`
(() => {
  const status = document.getElementById('status');
  const player = document.getElementById('player');

  async function loadVideo(id) {
    status.textContent = 'Carregando...';

    try {
      const res = await fetch('/api/media/' + encodeURIComponent(id) + '/url', {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok) throw new Error('Falha ao obter URL');
      const data = await res.json();
      if (!data.url) throw new Error('URL inválida');

      player.pause();
      player.removeAttribute('src');
      player.load();

      player.src = data.url;
      player.play().catch(() => {});
      status.textContent = 'Pronto ✅';
    } catch (e) {
      console.error(e);
      status.textContent = 'Erro ao carregar vídeo. Tente recarregar a página.';
    }
  }

  document.querySelectorAll('.js-load-video').forEach(btn => {
    btn.addEventListener('click', () => loadVideo(btn.dataset.id));
  });
})();
`);
});

// ====== MEDIA URL (presigned) ======
app.get("/api/media/:id/url", requireSession, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const key = MEDIA_ALLOWLIST[id];

    if (!key) {
      return res.status(404).json({ error: "midia_nao_encontrada" });
    }

    const url = await generateSignedUrl(key, 300);
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

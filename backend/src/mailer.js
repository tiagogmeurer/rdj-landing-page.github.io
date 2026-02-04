import nodemailer from "nodemailer";

// ===== SMTP (opcional) =====
function hasSmtp() {
  return (
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

function buildTransport() {
  if (!hasSmtp()) return null;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

// ===== helpers =====
function isValidFrom(v) {
  // aceita: email@x.com  OU  Nome <email@x.com>
  if (!v) return false;
  const s = String(v).trim();
  const emailOnly = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const nameEmail = /^.+<\s*[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+\s*>$/;
  return emailOnly.test(s) || nameEmail.test(s);
}

function pickFrom() {
  const raw = String(process.env.MAIL_FROM || "").trim();

  // default seguro para Resend sem domínio verificado
  const fallback = "Robô do Job <onboarding@resend.dev>";

  if (isValidFrom(raw)) return raw;
  return fallback;
}

// ===== Resend (HTTP) =====
async function sendViaResend({ to, from, subject, text, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");

  const payload = {
    from,
    to,
    subject,
    text,
    html,
  };

  if (replyTo) payload.reply_to = replyTo;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data?.message || "Resend request failed");
    err.status = r.status;
    err.data = data;
    throw err;
  }

  return data;
}

// ===== public =====
export async function sendRecoverEmail({ to, link }) {
  const subject = "Seu link de acesso ao Robô do Job";

  const text = `Opa! Aqui está seu link de acesso (válido por alguns minutos):
${link}

Se você não solicitou isso, ignore este e-mail.`;

  const html = `
<div style="font-family:Arial,sans-serif;line-height:1.4">
  <h2>Link de acesso</h2>
  <p>Use o botão abaixo para entrar. Esse link expira em alguns minutos.</p>
  <p>
    <a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:12px 16px;border-radius:10px;text-decoration:none">
      Acessar conteúdo
    </a>
  </p>
  <p style="color:#666;font-size:12px">Se você não solicitou isso, ignore este e-mail.</p>
</div>`.trim();

  const from = pickFrom();
  const replyTo = String(process.env.MAIL_REPLY_TO || "").trim() || undefined;

  // 1) Preferir Resend (sem SMTP)
  if (process.env.RESEND_API_KEY) {
    try {
      const resp = await sendViaResend({ to, from, subject, text, html, replyTo });
      console.log("[mailer] resend ok:", { to, id: resp?.id, from });
      return;
    } catch (e) {
      console.error("[mailer] resend failed:", {
        to,
        from,
        status: e?.status,
        data: e?.data,
        message: e?.message,
      });
      throw e;
    }
  }

  // 2) SMTP (fallback)
  const transport = buildTransport();
  if (!transport) {
    console.log("\n=== [DEV] Recover email ===");
    console.log("To:", to);
    console.log("From:", from);
    console.log("Link:", link);
    console.log("=========================\n");
    return;
  }

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html,
    replyTo,
  });
}

// src/mailer.js
// Envio de e-mail por API (Resend) — evita SMTP (Render costuma bloquear 465/587)
import "dotenv/config";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function hasResend() {
  return !!process.env.RESEND_API_KEY;
}

function getFrom() {
  // Para o lançamento: use o padrão do Resend (onboarding@resend.dev)
  // Depois, quando tiver e-mail no domínio, troque para algo tipo:
  // "Robô do Job <suporte@robodojob.com>"
  return (
    process.env.MAIL_FROM ||
    "Robô do Job <onboarding@resend.dev>"
  );
}

function getReplyTo() {
  // Seu e-mail real (pra responderem)
  return process.env.MAIL_REPLY_TO || "tiagogmeurer@gmail.com";
}

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

  // DEV fallback (sem API key)
  if (!hasResend()) {
    console.log("\n=== [DEV] Recover email (sem RESEND_API_KEY) ===");
    console.log("To:", to);
    console.log("Link:", link);
    console.log("=============================================\n");
    return { ok: true, dev: true };
  }

  try {
    const payload = {
      from: getFrom(),
      to: [String(to).trim().toLowerCase()],
      subject,
      text,
      html,
      reply_to: getReplyTo(),
    };

    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("[mailer] resend failed:", {
        to,
        status: res.status,
        data,
      });
      // Não derruba o fluxo de recover — só loga
      return { ok: false, status: res.status, data };
    }

    return { ok: true, id: data?.id };
  } catch (e) {
    console.error("[mailer] resend error:", {
      to,
      message: e?.message,
      name: e?.name,
    });
    // Não derruba o fluxo de recover — só loga
    return { ok: false, error: e?.message || "unknown" };
  }
}

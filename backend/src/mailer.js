import nodemailer from "nodemailer";

function hasSmtp() {
  return (
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.MAIL_FROM
  );
}

function buildTransport() {
  if (!hasSmtp()) return null;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Gmail: porta 587 com STARTTLS (secure=false + requireTLS=true)
  const isGmail = String(host).toLowerCase().includes("gmail");

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = SSL direto, 587 = STARTTLS
    auth: { user, pass },

    ...(isGmail
      ? {
          requireTLS: true,
          tls: {
            // Gmail é ok assim; evita alguns handshakes problemáticos em ambientes restritos
            servername: host,
          },
        }
      : {}),
  });

  return transport;
}

export async function sendRecoverEmail({ to, link }) {
  const transport = buildTransport();

  const from =
    process.env.MAIL_FROM || "Robô do Job <tiagogmeurer@gmail.com>";

  const subject = "Seu link de acesso ao Robô do Job";

  const text = `Aqui está seu link de acesso (válido por alguns minutos):
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

  if (!transport) {
    console.log("\n=== [DEV] Recover email ===");
    console.log("To:", to);
    console.log("Link:", link);
    console.log("=========================\n");
    return;
  }

  try {
    // Ajuda a capturar erro de auth/TLS logo no começo
    await transport.verify();

    const info = await transport.sendMail({
      from,
      to,
      subject,
      text,
      html,
      replyTo: "tiagogmeurer@gmail.com",
    });

    console.log("[mailer] sent:", {
      to,
      messageId: info?.messageId,
      response: info?.response,
      accepted: info?.accepted,
      rejected: info?.rejected,
    });
  } catch (err) {
    console.error("[mailer] failed:", {
      to,
      message: err?.message,
      code: err?.code,
      response: err?.response,
      responseCode: err?.responseCode,
    });
    throw err;
  }
}

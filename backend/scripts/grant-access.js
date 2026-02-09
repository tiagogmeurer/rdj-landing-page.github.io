import "dotenv/config";
import crypto from "crypto";
import { createAccessToken } from "../src/store.js";

async function main() {
  const emailRaw = process.argv[2];
  if (!emailRaw) {
    console.error("Uso: node scripts/grant-access.js email@exemplo.com");
    process.exit(1);
  }

  const email = String(emailRaw).trim().toLowerCase();
  const token = crypto.randomUUID();

  // 24h
  const ttlMs = 1000 * 60 * 60 * 24;

  await createAccessToken(token, email, ttlMs);

  const base = (process.env.API_PUBLIC_BASE_URL || "https://app.robodojob.com").replace(/\/$/, "");
  const url = `${base}/acesso/${token}`;

  console.log("✅ Acesso concedido com sucesso");
  console.log("👤 Email:", email);
  console.log("🔗 Link:", url);
  console.log("⏳ TTL: 24h");
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});

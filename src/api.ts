// src/api.ts

export const BACKEND_BASE_URL =
  "https://rdj-landing-page-github-io.onrender.com";

export const API = {
  health: `${BACKEND_BASE_URL}/healthz`,
  acessar: `${BACKEND_BASE_URL}/acessar`,
  webhookKirvano: `${BACKEND_BASE_URL}/webhook/kirvano`
};

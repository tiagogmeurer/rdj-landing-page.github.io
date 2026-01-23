import React from "react";

export default function App() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <section style={{ maxWidth: 720 }}>
        <h1 style={{ fontSize: 44, margin: 0 }}>RoboDoJob</h1>
        <p style={{ fontSize: 18, lineHeight: 1.5 }}>
          Crie personagens com IA e anime eles para conteúdos em formato vertical.
        </p>
        <button style={{ padding: "12px 16px", borderRadius: 10, border: "none", cursor: "pointer" }}>
          Quero o Kit
        </button>
      </section>
    </main>
  );
}
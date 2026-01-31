/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        "brand-dark": "#0B0B10",
        "brand-card": "#14141C",
        "brand-pink": "#FF007F",
        "brand-accent": "#7C3AED",
      },
      fontFamily: {
        display: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica", "Arial"],
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica", "Arial"],
      },
      boxShadow: {
        glow: "0 0 80px rgba(255,0,127,0.20)",
      },
    },
  },
  plugins: [],
};

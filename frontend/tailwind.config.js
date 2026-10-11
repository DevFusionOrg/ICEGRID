/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        polar: {
          50: "#eff8ff",
          900: "#0b1f33",
        },
        arctic: "#0d5e82",
        glacier: "#cfeaf6",
        frost: "#edf7fb",
        snow: "#f8fbfd",
        iceBlue: "#7ecae8",
        polarSlate: "#4e6473",
        hazardAmber: "#d08a1c",
        statusGreen: "#1d8d5d",
      },
      fontFamily: {
        display: ['"Space Grotesk"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      boxShadow: {
        glow: "0 24px 80px rgba(14, 94, 130, 0.15)",
      },
    },
  },
  plugins: [],
};

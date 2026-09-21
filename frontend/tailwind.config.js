/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        polar: {
          50: "#eff8ff",
          900: "#0b1f33"
        }
      }
    }
  },
  plugins: []
};

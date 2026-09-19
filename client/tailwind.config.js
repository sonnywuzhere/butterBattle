/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FBF3E4",
        butter: "#F5C518",
        gold: "#D4A017",
        crust: "#5C3A1E",
        burnt: "#C45C26",
        ink: "#2A1C12",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Nunito", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

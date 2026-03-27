/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        trivago: {
          orange: "#FF6B00",
          "orange-dark": "#E55F00",
          "orange-light": "#FF8533",
        },
      },
    },
  },
  plugins: [],
};

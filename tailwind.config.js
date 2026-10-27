/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      boxShadow: {
        academic: "0 12px 32px rgba(15, 23, 42, 0.08)",
        "academic-lg": "0 22px 55px rgba(15, 23, 42, 0.16)"
      }
    }
  },
  plugins: []
};

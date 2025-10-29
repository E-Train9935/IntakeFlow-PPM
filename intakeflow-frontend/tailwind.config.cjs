/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Montserrat", "ui-sans-serif", "system-ui"],
      },
      colors: {
        brand: {
          50:  "#f6f5ff",
          100: "#ece9ff",
          200: "#d9d4ff",
          300: "#c0b5ff",
          400: "#9a88ff",
          500: "#7B5CFF",     // primary violet
          600: "#6b49ff",
          700: "#5a36ff",
          800: "#4a2cd6",
          900: "#3b24a8",
        }
      },
      boxShadow: {
        glow: "0 10px 30px -10px rgba(123, 92, 255, .55)",
        soft: "0 8px 24px rgba(0,0,0,.20)",
        inset: "inset 0 1px 0 rgba(255,255,255,.05)",
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem",
      },
      animation: {
        "slow-pulse": "slow-pulse 6s ease-in-out infinite",
      },
      keyframes: {
        "slow-pulse": {
          "0%, 100%": { opacity: .7, transform: "translateY(0px)" },
          "50%": { opacity: 1, transform: "translateY(2px)" },
        },
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./theme/templates/**/*.html",
    "./content/**/*.md",
    "./cms/templates/**/*.html",
    "./src/**/*.css",
    "./cms/static/css/**/*.css",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      colors: {
        // Primary brand — "Tropical Rain Forest"
        "sembcorp-green": {
          DEFAULT: "#006C53",
          light: "#0E846D",
          mid: "#20937C",
          dark: "#005B48",
          darker: "#004E3E",
          wash: "#E6F1EE",
        },
        // Secondary / tertiary brand accents
        "sembcorp-blue": "#0095FF",
        "sembcorp-orange": "#FF6400",
        // Neutrals
        "sembcorp-gray": "#464646",
        "sembcorp-ink": "#1A1A1A",
        "sembcorp-mist": "#F5F6F5",
        "sembcorp-line": "#E5E7E6",
      },
      fontFamily: {
        sans: [
          "Frutiger",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      maxWidth: {
        content: "1280px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,26,26,0.04), 0 12px 32px -12px rgba(0,108,83,0.18)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};

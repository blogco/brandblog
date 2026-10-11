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
        // Siemens-inspired site palette; legacy class names remain for templates.
        "sembcorp-green": {
          DEFAULT: "#009999",
          light: "#009999",
          mid: "#009999",
          dark: "#007F7F",
          darker: "#000028",
          wash: "#F5F7F8",
        },
        // Retained semantic aliases for existing utility classes.
        "sembcorp-blue": "#009999",
        "sembcorp-orange": "#B42318",
        // Neutrals
        "sembcorp-gray": "#666666",
        "sembcorp-ink": "#1A1A1A",
        "sembcorp-mist": "#F5F7F8",
        "sembcorp-line": "#DFE4E8",
      },
      fontFamily: {
        sans: [
          "Siemens Sans",
          "Arial",
          "sans-serif",
        ],
      },
      maxWidth: {
        content: "1280px",
      },
      boxShadow: {
        card: "0 12px 32px rgba(0,0,40,.08)",
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

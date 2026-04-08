/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        bg:             "var(--bg)",
        bg2:            "var(--bg2)",
        bg3:            "var(--bg3)",
        bg4:            "var(--bg4)",
        // Borders
        border:         "var(--border)",
        border2:        "var(--border2)",
        // Gold
        gold:           "var(--gold)",
        "gold-2":       "var(--gold2)",
        "gold-dim":     "var(--gold-dim)",
        // Green
        green:          "var(--green)",
        "green-dim":    "var(--green-dim)",
        "green-bright": "var(--green-bright)",
        // Text
        text:           "var(--text)",
        t2:             "var(--text2)",
        t3:             "var(--text3)",
        // Accents
        red:            "var(--red)",
        amber:          "var(--amber)",
      },
      fontFamily: {
        display: ["Bebas Neue", "sans-serif"],
        serif:   ["Cormorant Garamond", "serif"],
        mono:    ["DM Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

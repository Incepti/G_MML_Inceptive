import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        editor: {
          bg: "#0a0f1f",
          sidebar: "#0d1326",
          panel: "#121a33",
          border: "#223052",
          accent: "#14b8a6",
          "accent-hover": "#0f9a8a",
          text: "#e6f1ff",
          "text-muted": "#8aa0c4",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        parentA: "#2563eb",
        parentB: "#e11d48",
        paper: "#f8fafc",
      },
    },
  },
  plugins: [],
};

export default config;

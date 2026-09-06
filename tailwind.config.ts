import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand palette sampled directly from the Daily Dose logo
        // (deep navy/indigo gradient, white mark).
        brand: {
          50: "#eef0fb",
          100: "#dbdff7",
          500: "#4641d2",
          600: "#302cb7",
          700: "#24219c",
        },
      },
      fontFamily: {
        sans: ["var(--font-cairo)", "Tahoma", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

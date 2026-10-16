
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Mr Supplement — Premium Black & White Brand
        brand: {
          50: "#F5F5F5",
          100: "#E5E5E5",
          500: "#525252",
          600: "#171717",
          700: "#0A0A0A",
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

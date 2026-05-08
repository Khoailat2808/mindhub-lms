import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        muted: "#5d667a",
        line: "#d9dee8",
        surface: "#f7f8fb",
        brand: "#082f6f",
        brandOrange: "#ff6b00"
      }
    }
  },
  plugins: []
};

export default config;

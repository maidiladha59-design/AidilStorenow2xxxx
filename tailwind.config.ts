import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base — dark navy/black world, bukan pure black agar tetap "hangat" untuk tech brand
        ink: {
          950: "#070B14", // background utama (hero, footer)
          900: "#0C1220",
          800: "#121A2C",
          700: "#1B2540",
          600: "#2A3556",
        },
        // Blue — warna utama brand, dipakai untuk CTA & link
        signal: {
          500: "#2F6FED",
          600: "#2558C7",
          400: "#5C8FF5",
        },
        // Gold — accent langka: rating, badge premium, garis pemisah penting
        gold: {
          500: "#E8B44C",
          400: "#F0C874",
        },
        // Red — accent langka: warning deadline, status ditolak
        flag: {
          500: "#E14B4B",
          600: "#C63B3B",
        },
        paper: {
          50: "#F7F8FA",
          100: "#EFF1F5",
          200: "#E3E7EE",
        },
      },
      fontFamily: {
        display: ["var(--font-sora)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        card: "0 6px 24px -8px rgba(7, 11, 20, 0.18)",
        "card-hover": "0 12px 32px -8px rgba(7, 11, 20, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;

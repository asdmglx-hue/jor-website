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
        purple: {
          DEFAULT: "#534AB7",
          deep: "#3D35A0",
          light: "#EEEDFE",
          mid: "#D4D1F7",
        },
        teal: {
          DEFAULT: "#0F6E56",
          light: "#E1F5EE",
        },
        amber: {
          DEFAULT: "#E8620A",
          light: "#FEEDE3",
        },
        rose: {
          DEFAULT: "#E11D48",
          light: "#FFE4E6",
        },
        ink: {
          DEFAULT: "#1A1830",
          light: "#6B6893",
          faint: "#B0ADCB",
        },
        surface: "#FAF9FF",
        card: "#FFFFFF",
        border: "#E8E6F5",
        green: {
          DEFAULT: "#16A34A",
          light: "#DCFCE7",
        },
        red: {
          DEFAULT: "#DC2626",
          light: "#FEE2E2",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
      },
    },
  },
  plugins: [],
};

export default config;

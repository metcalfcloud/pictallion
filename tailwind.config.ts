import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

export default {
  darkMode: "class",
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        orange: colors.orange,
        // add other color families as needed
      },
    },
  },
  safelist: [
    'bg-orange-400',
    'text-orange-400',
    // add any other classes you need
  ],
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;

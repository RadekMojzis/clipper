/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070A0E",
          900: "#0B1017",
          850: "#0F1620",
          800: "#141D2A",
        }
      },
      boxShadow: {
        glowG: "0 0 0 1px rgba(34,197,94,.25), 0 0 22px rgba(34,197,94,.20)",
        glowA: "0 0 0 1px rgba(245,158,11,.25), 0 0 22px rgba(245,158,11,.18)",
      },
      keyframes: {
        floaty: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-1px)" },
        },
        sheen: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" },
        },
        pulseSoft: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: ".6" },
        },
      },
      animation: {
        floaty: "floaty 2.2s ease-in-out infinite",
        sheen: "sheen 1.4s ease-in-out infinite",
        pulseSoft: "pulseSoft 1.2s ease-in-out infinite",
      },
    },
  },
};

import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  base: "/planner/",
  server: {
    host: "127.0.0.1", port: 5316, strictPort: true,
    proxy: { "/api": "http://127.0.0.1:5300" },
  },
  optimizeDeps: {
    exclude: [
      "@jordiorriols/ui",
      "@jordiorriols/ui/hooks",
      "@jordiorriols/ui/icons",
      "@jordiorriols/ui/radix",
    ],
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

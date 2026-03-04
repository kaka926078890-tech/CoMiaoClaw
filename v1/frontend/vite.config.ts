import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/chat": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/config": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/models": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/memory": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/session": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/workspace": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/sessions": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/session": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/scheduled-tasks": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import glsl from "vite-plugin-glsl";

// https://tauri.app/start/frontend/vite/
const host = process.env.TAURI_DEV_HOST;

// Path to the web app's source — we import editor components directly from here
const webSrc = path.resolve(__dirname, "../web/src");

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), glsl()],
  resolve: {
    alias: {
      // Point @/ to web app's src so all editor imports resolve
      "@": webSrc,
      // Shim Next.js modules that don't exist in Vite/Tauri
      "next/navigation": path.resolve(__dirname, "src/shims/next-navigation.ts"),
      "next/image": path.resolve(__dirname, "src/shims/next-image.tsx"),
      "next/link": path.resolve(__dirname, "src/shims/next-link.tsx"),
      "next/font/google": path.resolve(__dirname, "src/shims/next-font.ts"),
    },
  },
  // Prevent vite from obscuring Rust errors
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));

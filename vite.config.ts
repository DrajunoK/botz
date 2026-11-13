import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  root: ".",
  base: "/",
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: "dist",
    target: "es2020",
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifest: false, // public/manifest.webmanifest is the source of truth
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,woff2,webmanifest}"],
        // about.html / privacy.html are real pages, not the game shell
        navigateFallbackDenylist: [/^\/about\.html$/, /^\/privacy\.html$/],
        // Supabase calls must always hit the network
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

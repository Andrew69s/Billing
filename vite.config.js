import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon-32.png", "favicon-64.png", "apple-touch-icon.png"],
      manifest: {
        name: "Dnipro-M · Мотивація ТМ",
        short_name: "Dnipro-M",
        description: "Мотивація, показники території, склад і готівка мережі салонів Dnipro-M",
        lang: "uk",
        dir: "ltr",
        start_url: "/?utm=pwa",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#161E29",
        theme_color: "#161E29",
        categories: ["business", "productivity"],
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Показники території", short_name: "Показники", url: "/?w=1", icons: [{ src: "/pwa-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        importScripts: ["/push-sw.js"],
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        // не кешувати запити до Supabase — завжди свіжі дані
        navigateFallbackDenylist: [/^\/api/, /supabase\.co/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: { cacheName: "google-fonts", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});

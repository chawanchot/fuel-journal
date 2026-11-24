import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const path = (env.VITE_BASE_PATH ?? "/").trim().replace(/^\/+|\/+$/g, "");

  if (
    /[?#\\:\s]/.test(path) ||
    path.split("/").some((part) => part === "." || part === "..")
  ) {
    throw new Error(
      "VITE_BASE_PATH must be an absolute URL pathname, such as / or /fuel/.",
    );
  }

  const base = path ? `/${path}/` : "/";

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        base,
        scope: base,
        filename: "sw.js",
        registerType: "prompt",
        injectRegister: false,
        includeAssets: ["icon.svg", "apple-touch-icon.png"],
        manifest: {
          id: base,
          name: "เติมไป · สมุดเติมน้ำมัน",
          short_name: "เติมไป",
          description:
            "บันทึกเติมน้ำมันและคำนวณค่าเดินทาง สมุดส่วนตัวที่ใช้ได้ออฟไลน์",
          lang: "th",
          start_url: base,
          scope: base,
          display: "standalone",
          background_color: "#F7F4ED",
          theme_color: "#23594B",
          icons: [
            {
              src: `${base}icon.svg`,
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: `${base}pwa-192x192.png`,
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: `${base}pwa-512x512.png`,
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: `${base}maskable-512x512.png`,
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
          skipWaiting: false,
          clientsClaim: true,
        },
      }),
    ],
  };
});

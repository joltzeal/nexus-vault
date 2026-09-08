import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

const packageJson = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf8"),
) as { version?: string };
const appVersion =
  process.env.VITE_APP_VERSION?.trim() || packageJson.version || "0.0.0";

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    tailwindcss(),
    svgr(),
    cloudflare({ inspectorPort: false }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@the-convocation/twitter-scraper": path.resolve(
        import.meta.dirname,
        "./node_modules/@the-convocation/twitter-scraper/dist/default/esm/index.mjs",
      ),
      "tough-cookie": path.resolve(
        import.meta.dirname,
        "./worker/lib/tough-cookie-workers.ts",
      ),
    },
  },
});

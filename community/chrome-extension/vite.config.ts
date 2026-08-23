import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const nexusVaultOrigin =
  process.env.NEXUS_VAULT_ORIGIN ??
  process.env.VITE_NEXUS_VAULT_ORIGIN ??
  "https://nexus-vault.stacklabs.space"

export default defineConfig({
  root: __dirname,
  define: {
    __NEXUS_VAULT_ORIGIN__: JSON.stringify(nexusVaultOrigin),
  },
  plugins: [react(), tailwindcss()],
  publicDir: "public",
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, "popup.html"),
        background: path.resolve(__dirname, "src/background.ts"),
      },
      output: {
        assetFileNames: "assets/[name][extname]",
        chunkFileNames: "assets/[name].js",
        entryFileNames: "[name].js",
      },
    },
  },
})

import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "next/dynamic": path.resolve(__dirname, "src/shims/next-dynamic.tsx"),
      "next/link": path.resolve(__dirname, "src/shims/next-link.tsx"),
      "next/navigation": path.resolve(__dirname, "src/shims/next-navigation.ts"),
      "next-themes": path.resolve(__dirname, "src/shims/next-themes.ts"),
    },
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
})

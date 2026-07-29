import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { Toaster } from "@/components/ui/toast"
import { App } from "@/client/app"

import "@/app/globals.css"

const root = document.getElementById("root")

if (!root) {
  throw new Error("Root element not found.")
}

createRoot(root).render(
  <StrictMode>
    <Toaster>
      <App />
    </Toaster>
  </StrictMode>,
)

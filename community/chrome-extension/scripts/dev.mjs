import { spawn } from "node:child_process"

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
const commands = [
  ["exec", "vite", "build", "--config", "vite.config.ts", "--watch"],
  ["exec", "vite", "build", "--config", "vite.content.config.ts", "--watch"],
]

const children = commands.map((args) =>
  spawn(pnpm, args, {
    cwd: process.cwd(),
    stdio: "inherit",
  }),
)

let shuttingDown = false

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill("SIGINT")
  }
  process.exit(code)
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (shuttingDown) return
    shutdown(code ?? (signal ? 1 : 0))
  })
}

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))

/* global console, process */

import { spawn } from "node:child_process"

const children = [
  spawnCommand("client", ["dev:client"]),
  spawnCommand("worker", ["dev:worker"]),
]

let shuttingDown = false

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (shuttingDown) return
    shuttingDown = true
    for (const item of children) {
      if (item.pid !== child.pid && !item.killed) item.kill("SIGTERM")
    }
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (shuttingDown) return
    shuttingDown = true
    for (const child of children) {
      if (!child.killed) child.kill("SIGTERM")
    }
    process.exit(0)
  })
}

function spawnCommand(label, args) {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
  const child = spawn(command, args, {
    env: process.env,
    stdio: "inherit",
  })

  child.on("error", (error) => {
    console.error(`[${label}] failed to start`, error)
  })

  return child
}

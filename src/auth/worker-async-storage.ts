import { AsyncLocalStorage } from "node:async_hooks"

type BetterAuthGlobal = {
  context: Record<string, unknown>
  epoch: number
  version: string
}

const key = Symbol.for("better-auth:global")
const holder = globalThis as unknown as Record<symbol, BetterAuthGlobal | undefined>
const shared = (holder[key] ??= {
  context: {},
  epoch: 0,
  version: "worker-seed",
})

shared.context.requestStateAsyncStorage ??= new AsyncLocalStorage()
shared.context.endpointContextAsyncStorage ??= new AsyncLocalStorage()
shared.context.adapterAsyncStorage ??= new AsyncLocalStorage()

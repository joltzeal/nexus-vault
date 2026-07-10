import type { Context } from "hono"
import type { z } from "zod"

import { validationFailed } from "@/server/api/errors"
import type { ApiEnv } from "@/server/api/types"

export async function parseJson<TSchema extends z.ZodType>(
  c: Context<ApiEnv>,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  const body = await c.req.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    throw validationFailed(parsed.error.flatten())
  }

  return parsed.data
}

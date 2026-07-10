import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"

import { ApiError } from "@/server/api/errors"
import type { ApiEnv } from "@/server/api/types"

export function ok<T>(c: Context<ApiEnv>, data: T, status: ContentfulStatusCode = 200) {
  return c.json(
    {
      success: true,
      data,
      error: null,
    },
    status
  )
}

export function fail(c: Context<ApiEnv>, error: ApiError) {
  return c.json(
    {
      success: false,
      data: null,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    },
    error.status
  )
}

export function failUnknown(c: Context<ApiEnv>) {
  return c.json(
    {
      success: false,
      data: null,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "The API request failed.",
      },
    },
    500
  )
}

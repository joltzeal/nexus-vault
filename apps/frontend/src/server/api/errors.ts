import type { ContentfulStatusCode } from "hono/utils/http-status"

export class ApiError extends Error {
  readonly code: string
  readonly status: ContentfulStatusCode
  readonly details?: unknown

  constructor(
    code: string,
    message: string,
    status: ContentfulStatusCode = 400,
    details?: unknown
  ) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
    this.details = details
  }
}

export function notFound(message: string) {
  return new ApiError("NOT_FOUND", message, 404)
}

export function validationFailed(details: unknown) {
  return new ApiError("VALIDATION_ERROR", "Request body is invalid.", 422, details)
}

export function conflict(message: string) {
  return new ApiError("CONFLICT", message, 409)
}

export function forbidden(message = "Forbidden.") {
  return new ApiError("FORBIDDEN", message, 403)
}

export function unauthorized(message = "Authentication required.") {
  return new ApiError("UNAUTHORIZED", message, 401)
}

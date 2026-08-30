export class AppError
  extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Compatibility error used by handlers migrated from the Next.js runtime. */
export class ApiError extends AppError {
  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(code, status, message, details);
    this.name = "ApiError";
  }
}

export const unauthorized =
  (message = "Authentication required") =>
    new AppError(
      "UNAUTHORIZED",
      401,
      message,
    );

export const forbidden =
  (message = "Forbidden") =>
    new AppError(
      "FORBIDDEN",
      403,
      message,
    );

export const notFound =
  (message = "Resource not found") =>
    new AppError(
      "NOT_FOUND",
      404,
      message,
    );

export const validationFailed = (details: unknown) =>
	new AppError("VALIDATION_ERROR", 422, "Request body is invalid", details);

export const conflict = (message: string) => new AppError("CONFLICT", 409, message);

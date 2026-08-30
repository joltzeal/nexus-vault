import type { ErrorHandler } from "hono";

export const errorHandler: ErrorHandler =
  (error, c) => {
    console.error(
      JSON.stringify({
        requestId:
          c.get("requestId"),
        error:
          error instanceof Error
            ? error.message
            : String(error),
      }),
    );

    return c.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Internal server error",
        },
        requestId:
          c.get("requestId"),
      },
      500,
    );
  };
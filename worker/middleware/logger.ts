import { createMiddleware } from "hono/factory";

import type { AppEnv } from "../types/context";

export const loggerMiddleware =
  createMiddleware<AppEnv>(
    async (c, next) => {
      const start = Date.now();

      await next();

      const duration =
        Date.now() - start;

      console.log(
        JSON.stringify({
          requestId:
            c.var.requestId,

          method: c.req.method,

          path: new URL(
            c.req.url,
          ).pathname,

          status:
            c.res.status,

          duration,
        }),
      );
    },
  );
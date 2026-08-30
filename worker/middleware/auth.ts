import { createMiddleware } from "hono/factory";

import type { AppEnv } from "../types/context";

export const authMiddleware =
  createMiddleware<AppEnv>(
    async (c, next) => {
      const session =
        await c.var.auth.api.getSession({
          headers: c.req.raw.headers,
        });

      if (!session) {
        return c.json(
          {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message:
                "Authentication required",
            },
            requestId:
              c.var.requestId,
          },
          401,
        );
      }

      c.set("user", {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      });

      await next();
    },
  );
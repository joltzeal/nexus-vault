import { Hono } from "hono";

import type { AppEnv } from "../types/context";

export const healthRoute =
  new Hono<AppEnv>();

healthRoute.get(
  "/",
  (c) => {
    return c.json({
      success: true,

      data: {
        status: "ok",
        service: "nexus-vault-api",
        timestamp:
          new Date().toISOString(),
      },
    });
  },
);
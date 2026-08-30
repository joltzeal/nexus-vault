import { createMiddleware } from "hono/factory";

import type { AppEnv } from "../types/context";
import { createDb } from "../db";
import { createAuth } from "../auth/auth";

export const dbMiddleware =
  createMiddleware<AppEnv>(
    async (c, next) => {
      const { db, client } =
        await createDb(c.env);

      c.set("db", db);
      c.set("auth", createAuth(db, c.env));

      try {
        await next();
      } finally {
        await client.end();
      }
    },
  );

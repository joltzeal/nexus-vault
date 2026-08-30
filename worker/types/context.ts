import type { createDb } from "../db";
import type { createAuth } from "../auth/auth";

export type Database = Awaited<
  ReturnType<typeof createDb>
>["db"];

export type Auth = ReturnType<typeof createAuth>;

export type AppVariables = {
  db: Database;
  auth: Auth;

  requestId: string;

  user: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export type AppEnv = {
  // `Env` is generated globally by `wrangler types` from wrangler.jsonc.
  Bindings: Env;
  Variables: AppVariables;
};

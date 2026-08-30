import { Hono } from "hono";

import type { AppEnv } from "../types/context";

export const authRoute = new Hono<AppEnv>();

authRoute.on(["GET", "POST"], "/*", (c) => {
	return c.var.auth.handler(c.req.raw);
});

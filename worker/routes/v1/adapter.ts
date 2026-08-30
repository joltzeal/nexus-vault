import type { Hono } from "hono";
import type { AppEnv } from "../../types/context";

import { withApiRuntime } from "../../lib/http";

type LegacyContext = { params: Record<string, string> };
type LegacyHandler = (request: Request, context: LegacyContext) => Response | Promise<Response>;
type LegacyModule = Partial<Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE", unknown>>;

export function registerLegacyRoute(
	router: Hono<AppEnv>,
	path: string,
	module: LegacyModule,
	options: { wildcardParam?: string } = {},
) {
	for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
		const handler = module[method] as LegacyHandler | undefined;
		if (!handler) continue;
		router.on(method, path, async (c) => {
            const params = { ...c.req.param() } as Record<string, string>;
			if (options.wildcardParam && params["*"] !== undefined) {
				params[options.wildcardParam] = params["*"];
				delete params["*"];
			}
			return withApiRuntime(
				{ env: c.env, executionCtx: c.executionCtx },
				() => handler(c.req.raw, { params }),
			);
		});
	}
}

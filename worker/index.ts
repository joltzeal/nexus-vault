// hono root router

import { Hono } from "hono";

import type { AppEnv } from "./types/context";

import { api } from "./routes";

import { loggerMiddleware } from "./middleware/logger";
import { requestIdMiddleware } from "./middleware/request-id";
import { errorHandler } from "./middleware/error-handler";
import { consumeQueueBatch } from "./queues/worker-consumer";
import { runScheduledCloudDriveChecks } from "./services/cloud-drive-check-service";

const app =
  new Hono<AppEnv>();

/**
 * Global middleware
 */
app.use(
  "*",
  requestIdMiddleware,
);

app.use(
  "*",
  loggerMiddleware,
);

/**
 * Error handler
 */
app.onError(errorHandler);

/**
 * API
 */
app.route(
  "/api",
  api,
);

/**
 * 404
 */
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
      requestId:
        c.var.requestId,
    },
    404,
  );
});

const handler: ExportedHandler<Env> = {
  fetch: app.fetch,

  async queue(batch, env) {
    await consumeQueueBatch(batch, env);
  },

  async scheduled(controller, env) {
    await runScheduledCloudDriveChecks(env, {
      cron: controller.cron,
      scheduledTime: controller.scheduledTime,
    });
  },
};

export { app };
export default handler;

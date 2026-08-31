// hono root router

import { Hono } from "hono";

import type { AppEnv } from "./types/context";

import { api } from "./routes";

import { loggerMiddleware } from "./middleware/logger";
import { requestIdMiddleware } from "./middleware/request-id";
import { errorHandler } from "./middleware/error-handler";
import { consumeQueueBatch } from "./queues/worker-consumer";
import { runScheduledCloudDriveChecks } from "./services/cloud-drive-check-service";
import { runScheduledMagnetMediaRetries } from "./services/metadata-service";

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
    const [cloudDriveResult, magnetMediaResult] = await Promise.allSettled([
      runScheduledCloudDriveChecks(env, {
        cron: controller.cron,
        scheduledTime: controller.scheduledTime,
      }),
      runScheduledMagnetMediaRetries(env),
    ])
    if (cloudDriveResult.status === "rejected") {
      console.error("Cloud drive scheduled check failed", cloudDriveResult.reason)
    }
    if (magnetMediaResult.status === "rejected") {
      console.error("Magnet media scheduled retry failed", magnetMediaResult.reason)
    }
    console.log("Scheduled maintenance completed", {
      cron: controller.cron,
      scheduledTime: controller.scheduledTime,
      cloudDrive:
        cloudDriveResult.status === "fulfilled" ? cloudDriveResult.value : undefined,
      magnetMedia:
        magnetMediaResult.status === "fulfilled" ? magnetMediaResult.value : undefined,
    })
  },
};

export { app };
export default handler;

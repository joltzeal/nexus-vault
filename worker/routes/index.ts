import { Hono } from "hono";

import type { AppEnv } from "../types/context";

import { healthRoute } from "./health";
import { dbMiddleware } from "../middleware/db";
import { authRoute } from "./auth";
import { apiV1 } from "./v1";
export const api =
  new Hono<AppEnv>();


  
/**
 * Public / no database
 */
api.route(
  "/health",
  healthRoute,
);

api.use("/auth/*", dbMiddleware);
api.route("/auth", authRoute);
api.route("/v1", apiV1);
/**
 * Database-backed APIs
 */

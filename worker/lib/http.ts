import { AsyncLocalStorage } from "node:async_hooks";
import type { z } from "zod";

import { createAuth } from "../auth/auth";
import { createDb } from "../db";
import { unauthorized, validationFailed, type AppError } from "./errors";
import type { Actor, ApiExecutionContext, Db } from "../types/legacy-api";

type AuthMode = "none" | "optional" | "required";

type RuntimeContext = {
	env: Env;
	executionCtx: ApiExecutionContext;
};

export type RequestContext = {
	actor?: Actor;
	db: Db;
	env: Env;
	executionCtx: ApiExecutionContext;
	request: Request;
	url: URL;
};

const runtimeStorage = new AsyncLocalStorage<RuntimeContext>();

export async function handleApiRequest(
	request: Request,
	options: { auth?: AuthMode } = {},
	handler: (context: RequestContext) => Promise<Response> | Response,
) {
	const runtime = runtimeStorage.getStore();
	if (!runtime) throw new Error("Legacy API route invoked without a Worker runtime context");

	let database: Awaited<ReturnType<typeof createDb>> | undefined;
	try {
		database = await createDb(runtime.env);
		const authMode = options.auth ?? "required";
		let actor: Actor | undefined;

		if (authMode !== "none") {
			const auth = createAuth(database.db, runtime.env);
			const session = await auth.api.getSession({ headers: request.headers });
			if (session) {
				actor = {
					id: session.user.id,
					email: session.user.email,
					name: session.user.name,
				};
			}
			if (authMode === "required" && !actor) throw unauthorized();
		}

    const response = await handler({
			actor,
			db: database.db,
			env: runtime.env,
			executionCtx: runtime.executionCtx,
			request,
			url: new URL(request.url),
    });
    response.headers.set("cache-control", "no-store, max-age=0");
    response.headers.set("pragma", "no-cache");
    return response;
	} catch (error) {
		if (isAppError(error)) return failure(error);
		console.error("API request failed", {
			method: request.method,
			path: new URL(request.url).pathname,
			error: error instanceof Error ? { name: error.name, message: error.message } : error,
		});
		return failure(new Error("The API request failed."));
	} finally {
		await database?.client.end().catch((error) => console.error("Database session close failed", error));
	}
}

export function requireActor(actor: Actor | undefined) {
	if (!actor) throw unauthorized();
	return actor;
}

export async function parseJson<TSchema extends z.ZodType>(request: Request, schema: TSchema): Promise<z.infer<TSchema>> {
	const body = await request.json().catch(() => null);
	const parsed = schema.safeParse(body);
	if (!parsed.success) throw validationFailed(parsed.error.flatten());
	return parsed.data;
}

export function ok(data: unknown, status = 200, headers?: HeadersInit) {
	return Response.json({ success: true, data, error: null }, { status, headers });
}

export function getCookie(request: Request, name: string) {
	const header = request.headers.get("cookie");
	if (!header) return undefined;
	const prefix = `${name}=`;
	const value = header.split(";").map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(prefix))?.slice(prefix.length);
	return value ? decodeURIComponent(value) : undefined;
}

export function serializeCookie(name: string, value: string, options: { httpOnly?: boolean; maxAge?: number; path?: string; sameSite?: string; secure?: boolean } = {}) {
	const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? "/"}`];
	if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
	if (options.httpOnly) parts.push("HttpOnly");
	if (options.secure) parts.push("Secure");
	if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
	return parts.join("; ");
}

export function withApiRuntime<T>(runtime: RuntimeContext, callback: () => T) {
	return runtimeStorage.run(runtime, callback);
}

function isAppError(error: unknown): error is AppError {
	return typeof error === "object" && error !== null && "status" in error && "code" in error;
}

function failure(error: AppError | Error) {
	const appError = isAppError(error) ? error : undefined;
  const response = Response.json(
		{
			success: false,
			data: null,
			error: {
				code: appError?.code ?? "INTERNAL_SERVER_ERROR",
				message: appError?.message ?? "The API request failed.",
				details: appError?.details,
			},
		},
		{ status: appError?.status ?? 500 },
  );
  response.headers.set("cache-control", "no-store, max-age=0");
  response.headers.set("pragma", "no-cache");
  return response;
}

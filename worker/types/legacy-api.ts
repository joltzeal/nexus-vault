import type { createDb } from "../db";

export type Db = Awaited<ReturnType<typeof createDb>>["db"];
export type ApiBindings = Env;

export type Actor = {
	id: string;
	email: string;
	name?: string | null;
};

export type ApiExecutionContext = {
	waitUntil(promise: Promise<unknown>): void;
};

export type ApiContext = {
	env: ApiBindings;
	executionCtx: ApiExecutionContext;
};

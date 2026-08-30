import { createAuth } from "./auth";
import type { Db, Actor } from "../types/legacy-api";

export async function resolveViewerFromRequest(
	request: Request,
	env: Env,
	db: Db,
): Promise<Actor | undefined> {
	const session = await createAuth(db, env).api.getSession({ headers: request.headers });
	if (!session) return undefined;
	return {
		id: session.user.id,
		email: session.user.email,
		name: session.user.name,
	};
}

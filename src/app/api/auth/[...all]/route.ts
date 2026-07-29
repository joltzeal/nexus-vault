import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createAuthSession } from "@/auth";

export const dynamic = "force-dynamic";

async function handler(request: Request) {
	const env = await getRuntimeEnv();
	const session = await createAuthSession(env as never);
	return session.handle(request);
}

async function getRuntimeEnv() {
	try {
		const { env } = await getCloudflareContext({ async: true });
		return env;
	} catch {
		return process.env;
	}
}

export {
	handler as DELETE,
	handler as GET,
	handler as PATCH,
	handler as POST,
	handler as PUT,
};

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: globalThis.location?.origin,
});

export const auth = authClient;

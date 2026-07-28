import { getCloudflareContext } from "@opennextjs/cloudflare";
import { redirect } from "next/navigation";

import { getRegistrationMode, type RegistrationEnv } from "@/auth/registration";
import { getViewer } from "@/auth/session";
import { Home } from "@/features/components/home";

export const dynamic = "force-dynamic";

export default async function Page() {
	const env = await getRuntimeEnv();
	const viewer = await getViewer(env);
	if (viewer) redirect("/dashboard");

	const registrationMode = await getRegistrationMode(env);

	return <Home registrationMode={registrationMode} />;
}

async function getRuntimeEnv(): Promise<RegistrationEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env;
  } catch {
    return process.env as RegistrationEnv;
  }
}

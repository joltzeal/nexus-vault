import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: [
		"@nexus-vault/auth",
		"@nexus-vault/db",
		"@nexus-vault/providers",
		"@nexus-vault/shared",
		"@nexus-vault/ui",
	],
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
if (process.env.NODE_ENV === "development") {
	initOpenNextCloudflareForDev();
}

import { notFound } from "next/navigation"
import { cookies } from "next/headers"
import type { Metadata } from "next"
import { getCloudflareContext } from "@opennextjs/cloudflare"

import { createDbSession } from "@nexus-vault/db"
import { ShareUnavailableClient } from "@/features/vault-workspace/components/share-unavailable-client"
import { ShareUnlockClient } from "@/features/vault-workspace/components/share-unlock-client"
import { VaultWorkspaceClient } from "@/features/vault-workspace/vault-workspace-client"
import { mapVaultDetail } from "@/features/vault-workspace/mappers"
import {
  getShareUnlockCookieName,
  getShareVaultTitleBySlug,
  getUnlockedSharedVaultDetail,
} from "@/server/services/share-service"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const cloudflare = await getCloudflareContext({ async: true })
  const dbSession = await createDbSession(cloudflare.env)
  const title = await getShareVaultTitleBySlug(dbSession.db, slug).finally(() =>
    dbSession.close()
  )

  return {
    title: `${title ?? "Vault 不可用"} · NexusVault`,
  }
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cloudflare = await getCloudflareContext({ async: true })
  const dbSession = await createDbSession(cloudflare.env)
  const turnstileSiteKey = getTurnstileSiteKey(cloudflare.env)
  const cookieStore = await cookies()
  const unlockToken = cookieStore.get(getShareUnlockCookieName(slug))?.value
  const share = await getUnlockedSharedVaultDetail(
    dbSession.db,
    cloudflare.env,
    slug,
    unlockToken
  ).finally(() => dbSession.close())

  if (!share) notFound()

  if (share.unavailable) {
    return <PrivateShareUnavailable />
  }

  if (share.passwordRequired) {
    return <ShareUnlockClient slug={slug} turnstileSiteKey={turnstileSiteKey} />
  }

  const hydratedSet = mapVaultDetail(share.detail)

  return (
    <VaultWorkspaceClient
      initialData={{
        sets: [hydratedSet],
        activeSetId: hydratedSet.id,
        mode: "share",
        shareSlug: slug,
        turnstileSiteKey,
      }}
    />
  )
}

function PrivateShareUnavailable() {
  return <ShareUnavailableClient />
}

function getTurnstileSiteKey(env: CloudflareEnv) {
  return (env as CloudflareEnv & { TURNSTILE_SITE_KEY?: string }).TURNSTILE_SITE_KEY
}

import { eq } from "drizzle-orm"

import { userIntegrationSettings, type UserIntegrationSettingsData } from "../db/schema"
import { ApiError } from "../lib/errors"
import type { Db } from "../types/legacy-api"
import { userIntegrationSettingsDataSchema } from "../schemas/account-integrations"

export type AccountIntegrationsSummary = {
  xCom: {
    cookieConfigured: boolean
    updatedAt: string | null
  }
}

export async function getAccountIntegrationsSummary(db: Db, userId: string) {
  return summarizeIntegrationData(await getUserIntegrationData(db, userId))
}

export async function updateUserXComCookie(
  db: Db,
  input: {
    cookieString: string
    userId: string
  },
) {
  const now = new Date().toISOString()
  const current = await getUserIntegrationData(db, input.userId)
  const nextData: UserIntegrationSettingsData = {
    ...current,
    xCom: input.cookieString
      ? {
          cookieString: input.cookieString,
          updatedAt: now,
        }
      : {
          updatedAt: now,
        },
  }

  await db
    .insert(userIntegrationSettings)
    .values({
      userId: input.userId,
      dataJson: nextData,
    })
    .onConflictDoUpdate({
      target: userIntegrationSettings.userId,
      set: {
        dataJson: nextData,
        updatedAt: now,
      },
    })

  return summarizeIntegrationData(nextData)
}

export async function getUserXComCookieString(db: Db, userId: string) {
  const data = await getUserIntegrationData(db, userId)
  const cookie = data.xCom?.cookieString?.trim()
  return cookie || undefined
}

export async function requireUserXComCookieString(
  db: Db,
  userId: string | null | undefined,
) {
  const cookie = userId ? await getUserXComCookieString(db, userId) : undefined
  if (!cookie) {
    throw new ApiError(
      "X_COM_COOKIE_REQUIRED",
      "请先在 Settings > Integrations 中配置自己的 x.com Cookie。",
      422,
    )
  }
  return cookie
}

async function getUserIntegrationData(db: Db, userId: string) {
  const [row] = await db
    .select({
      dataJson: userIntegrationSettings.dataJson,
    })
    .from(userIntegrationSettings)
    .where(eq(userIntegrationSettings.userId, userId))
    .limit(1)

  const parsed = userIntegrationSettingsDataSchema.safeParse(row?.dataJson ?? {})
  return parsed.success ? parsed.data : {}
}

function summarizeIntegrationData(data: UserIntegrationSettingsData): AccountIntegrationsSummary {
  return {
    xCom: {
      cookieConfigured: Boolean(data.xCom?.cookieString?.trim()),
      updatedAt: data.xCom?.cookieString ? data.xCom.updatedAt ?? null : null,
    },
  }
}

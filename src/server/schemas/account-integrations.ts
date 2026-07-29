import { z } from "zod"

const COOKIE_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

export const xComCookieStringSchema = z
  .string()
  .max(8000, "Cookie 内容过长。")
  .transform((value) => value.trim())
  .refine((value) => !/[\r\n]/.test(value), "Cookie 必须是单行内容。")
  .refine((value) => value === "" || isCookieHeaderValue(value), {
    message: "Cookie 格式应为 name=value; name=value。",
  })

export const updateXComCookieSchema = z.object({
  cookieString: xComCookieStringSchema,
})

export const userIntegrationSettingsDataSchema = z
  .object({
    xCom: z
      .object({
        cookieString: xComCookieStringSchema.optional(),
        updatedAt: z.string().datetime().optional(),
      })
      .optional(),
  })
  .strict()

function isCookieHeaderValue(value: string) {
  const parts = value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return false

  return parts.every((part) => {
    const separator = part.indexOf("=")
    if (separator <= 0) return false

    const name = part.slice(0, separator).trim()
    const cookieValue = part.slice(separator + 1).trim()

    return COOKIE_NAME_RE.test(name) && cookieValue.length > 0
  })
}

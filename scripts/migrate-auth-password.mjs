import postgres from "postgres"

const email = process.argv[2]?.trim().toLowerCase()
const password = process.env.AUTH_MIGRATION_PASSWORD
const connectionString = process.env.DATABASE_URL

if (!email) {
  throw new Error("Usage: pnpm auth:migrate-password -- user@example.com")
}
if (!password || password.length < 8) {
  throw new Error("AUTH_MIGRATION_PASSWORD must contain at least 8 characters.")
}
if (new TextEncoder().encode(password).byteLength > 72) {
  throw new Error("AUTH_MIGRATION_PASSWORD must not exceed 72 UTF-8 bytes.")
}
if (!connectionString) {
  throw new Error("DATABASE_URL is required.")
}

const sql = postgres(connectionString, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
})

try {
  await sql`create extension if not exists pgcrypto`

  const [result] = await sql.begin(async (tx) => {
    const rows = await tx`
      update "account" as a
      set
        "password" = crypt(${password}, gen_salt('bf', 12)),
        "updatedAt" = now()
      from "user" as u
      where
        a."userId" = u."id"
        and a."providerId" = 'credential'
        and lower(u."email") = ${email}
      returning a."userId"
    `

    if (rows.length === 0) {
      throw new Error(`Credential account not found for ${email}.`)
    }

    await tx`delete from "session" where "userId" = ${rows[0].userId}`
    return rows
  })

  console.log(`Password migrated and existing sessions revoked for ${email}.`, {
    userId: result.userId,
  })
} finally {
  await sql.end({ timeout: 1 })
}

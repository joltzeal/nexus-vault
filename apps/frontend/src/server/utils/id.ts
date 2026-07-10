export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

export function newToken() {
  return crypto.randomUUID()
}

export function newShareSlug() {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)

  return Array.from(bytes)
    .map((byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 8)
}

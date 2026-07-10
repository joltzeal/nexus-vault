declare global {
  interface CloudflareEnv {
    DB: D1Database
    CACHE: KVNamespace
    MEDIA: R2Bucket
    METADATA_QUEUE: Queue
    NOTIFICATION_QUEUE: Queue
    BETTER_AUTH_SECRET: string
    BETTER_AUTH_URL?: string
    NEXTJS_ENV?: string
    TWITTER_REQUEST_PROXY_URL?: string
    TWITTER_COOKIE_STRING?: string
  }
}

export {}

import { BadgeCheck } from "lucide-react"

export function XUserHeader({
  avatarUrl,
  href,
  name,
  screenName,
  verified = false,
}: {
  avatarUrl?: string
  href: string
  name: string
  screenName: string
  verified?: boolean
}) {
  const normalizedScreenName = screenName.replace(/^@/, "")

  return (
    <div className="flex min-w-0 items-center gap-3">
      <a
        className="shrink-0"
        href={href}
        onClick={(event) => event.stopPropagation()}
        rel="noreferrer"
        target="_blank"
      >
        {avatarUrl ? (
          <img
            alt={normalizedScreenName}
            className="size-12 overflow-hidden rounded-full border border-border/50 object-cover"
            height={48}
            loading="lazy"
            src={avatarUrl}
            title={`Profile picture of ${name}`}
            width={48}
          />
        ) : (
          <span className="grid size-12 place-items-center rounded-full border border-border/50 bg-muted text-sm text-muted-foreground">
            {getInitials(name || normalizedScreenName)}
          </span>
        )}
      </a>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <a
          className="flex min-w-0 items-center font-medium whitespace-nowrap text-foreground transition-opacity hover:opacity-80"
          href={href}
          onClick={(event) => event.stopPropagation()}
          rel="noreferrer"
          target="_blank"
        >
          <span className="truncate">{truncate(name, 20)}</span>
          {verified && (
            <BadgeCheck
              aria-label="已认证账号"
              className="ml-1 size-4 shrink-0 text-blue-500"
            />
          )}
        </a>
        <a
          className="truncate text-sm text-muted-foreground transition-colors hover:text-foreground"
          href={href}
          onClick={(event) => event.stopPropagation()}
          rel="noreferrer"
          target="_blank"
        >
          @{truncate(normalizedScreenName, 16)}
        </a>
      </div>
    </div>
  )
}

function truncate(value: string, maxLength: number) {
  const characters = Array.from(value)
  return characters.length > maxLength
    ? `${characters.slice(0, maxLength).join("")}...`
    : value
}

function getInitials(value: string) {
  return value.trim().replace(/^@/, "").slice(0, 2).toUpperCase() || "X"
}

import {
  createBaseResourceMetadata,
} from "../../domain/resources/metadata"
import { parseGitHubLink } from "../../domain/resources/input"

import {
  RetryableMetadataError,
  type MetadataProvider,
} from "../metadata-provider"

type GitHubApiOptions = {
  githubToken?: string
}

const GITHUB_PAGE_SIZE = 100
const MAX_GITHUB_REPOSITORY_PAGES = 5

export const githubMetadataProvider: MetadataProvider = {
  name: "github",
  supports: (resource) => parseGitHubLink(resource.url) !== null,
  async resolve(resource, options) {
    const parsed = parseGitHubLink(resource.url)
    const base = createBaseResourceMetadata({ type: resource.type, title: resource.title })

    if (!parsed) {
      return {
        provider: "github",
        status: "failed",
        data: base,
        errorMessage: "Invalid GitHub URL.",
      }
    }

    const preview = createFallbackPreview(parsed)
    try {
      const api = await fetchGitHubApi(parsed, {
        githubToken: options?.githubToken,
      })
      if (!api.ok) {
        return {
          provider: "github",
          status: "failed",
          data: {
            ...base,
            identifiers: getIdentifiers(parsed),
            source: { name: "github.com", url: parsed.url },
            preview,
          },
          errorMessage: api.error,
        }
      }

      const supplementary = await fetchGitHubSupplementaryData(
        parsed,
        options?.githubToken,
        api.data,
      )
      const data = normalizeGitHubPreview(parsed, api.data, supplementary)
      return {
        provider: "github",
        status: "completed",
        data: {
          ...base,
          title: getPreviewTitle(parsed, data),
          description: getPreviewDescription(data),
          identifiers: getIdentifiers(parsed),
          source: { name: "github.com", url: parsed.url },
          preview: { kind: preview.kind, data },
        },
      }
    } catch (error) {
      let caughtError = error
      if (caughtError instanceof RetryableMetadataError && options?.retryTransient) {
        throw error
      }
      if (isTransientNetworkError(caughtError)) {
        const retryable = new RetryableMetadataError(
          `GitHub request failed temporarily: ${getErrorMessage(caughtError)}`,
        )
        if (options?.retryTransient) throw retryable
        caughtError = retryable
      }
      return {
        provider: "github",
        status: "failed",
        data: {
          ...base,
          identifiers: getIdentifiers(parsed),
          source: { name: "github.com", url: parsed.url },
          preview,
        },
        errorMessage: caughtError instanceof Error ? caughtError.message : "GitHub request failed.",
      }
    }
  },
}

async function fetchGitHubApi(
  parsed: NonNullable<ReturnType<typeof parseGitHubLink>>,
  options: GitHubApiOptions,
) {
  let path: string
  if (parsed.kind === "user") path = `/users/${encodeURIComponent(parsed.login)}`
  else if (parsed.kind === "repository") {
    path = `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repository)}`
  } else if (parsed.tag) {
    path = `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repository)}/releases/tags/${encodeURIComponent(parsed.tag)}`
  } else {
    path = `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repository)}/releases/latest`
  }

  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "NexusVaultMetadata/1.0",
      "x-github-api-version": "2022-11-28",
      ...(options.githubToken ? { authorization: `Bearer ${options.githubToken}` } : {}),
    },
    signal: AbortSignal.timeout(8_000),
  })

  if (!response.ok) {
    if (isTransientGitHubResponse(response)) {
      throw new RetryableMetadataError(
        `GitHub API returned retryable HTTP ${response.status}.`,
      )
    }
    return {
      ok: false as const,
      error: `GitHub API returned HTTP ${response.status}.`,
      data: null,
    }
  }

  const data: unknown = await response.json()
  if (!data || typeof data !== "object" || !isValidGitHubPayload(parsed, data as Record<string, unknown>)) {
    return { ok: false as const, error: "GitHub API returned invalid JSON.", data: null }
  }

  return { ok: true as const, data: data as Record<string, unknown> }
}

function isValidGitHubPayload(
  parsed: NonNullable<ReturnType<typeof parseGitHubLink>>,
  value: Record<string, unknown>,
) {
  if (parsed.kind === "user") return typeof value.login === "string"
  if (parsed.kind === "repository") return typeof value.name === "string"
  return typeof value.tag_name === "string" || typeof value.name === "string"
}

function createFallbackPreview(
  parsed: NonNullable<ReturnType<typeof parseGitHubLink>>,
) {
  if (parsed.kind === "user") {
    return {
      kind: "github_user" as const,
      data: { login: parsed.login, url: parsed.url },
    }
  }
  if (parsed.kind === "repository") {
    return {
      kind: "github_repository" as const,
      data: { owner: parsed.owner, name: parsed.repository, url: parsed.url },
    }
  }
  return {
    kind: "github_release" as const,
    data: {
      owner: parsed.owner,
      repository: parsed.repository,
      tag: parsed.tag ?? "latest",
      url: parsed.url,
    },
  }
}

function normalizeGitHubPreview(
  parsed: NonNullable<ReturnType<typeof parseGitHubLink>>,
  value: Record<string, unknown>,
  supplementary?: GitHubSupplementaryData,
) {
  if (parsed.kind === "user") {
    const repositories = supplementary?.repositories ?? []
    const hasCompleteRepositoryStats = supplementary?.repositoriesComplete === true
    const languageCounts = new Map<string, number>()
    for (const repository of repositories) {
      const language = stringValue(repository.language)
      if (language) languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1)
    }
    return {
      avatarUrl: stringValue(value.avatar_url),
      bio: stringValue(value.bio),
      blog: stringValue(value.blog),
      company: stringValue(value.company),
      followers: numberValue(value.followers),
      following: numberValue(value.following),
      location: stringValue(value.location),
      login: stringValue(value.login) ?? parsed.login,
      name: stringValue(value.name),
      publicRepos: numberValue(value.public_repos),
      totalForks: hasCompleteRepositoryStats
        ? sumValues(repositories, "forks_count")
        : undefined,
      totalStars: hasCompleteRepositoryStats
        ? sumValues(repositories, "stargazers_count")
        : undefined,
      topLanguages: hasCompleteRepositoryStats
        ? [...languageCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([language]) => language)
        : undefined,
      popularRepositories: hasCompleteRepositoryStats
        ? [...repositories]
            .sort(
              (a, b) =>
                (numberValue(b.stargazers_count) ?? 0) -
                (numberValue(a.stargazers_count) ?? 0),
            )
            .slice(0, 3)
            .map((repository) => ({
              forks: numberValue(repository.forks_count),
              name: stringValue(repository.name) ?? "repository",
              stars: numberValue(repository.stargazers_count),
              url: stringValue(repository.html_url),
            }))
        : undefined,
      type: value.type === "Organization" ? "Organization" as const : "User" as const,
      url: parsed.url,
    }
  }

  if (parsed.kind === "repository") {
    const owner = isRecord(value.owner) ? stringValue(value.owner.login) : undefined
    const license = isRecord(value.license) ? stringValue(value.license.spdx_id) : undefined
    return {
      archived: value.archived === true,
      avatarUrl: isRecord(value.owner) ? stringValue(value.owner.avatar_url) : undefined,
      defaultBranch: stringValue(value.default_branch),
      description: stringValue(value.description),
      contributors: (supplementary?.contributors ?? []).slice(0, 12).flatMap((contributor) => {
        const login = stringValue(contributor.login)
        if (!login) return []
        return [{ avatarUrl: stringValue(contributor.avatar_url), login }]
      }),
      forks: numberValue(value.forks_count),
      language: stringValue(value.language),
      languages: Object.keys(supplementary?.languages ?? {}).slice(0, 6),
      license: license === "NOASSERTION" ? undefined : license,
      name: stringValue(value.name) ?? parsed.repository,
      openIssues: numberValue(value.open_issues_count),
      owner: owner ?? parsed.owner,
      stars: numberValue(value.stargazers_count),
      topics: Array.isArray(value.topics)
        ? value.topics.filter((topic): topic is string => typeof topic === "string").slice(0, 6)
        : undefined,
      url: parsed.url,
      watchers: numberValue(value.subscribers_count) ?? numberValue(value.watchers_count),
    }
  }

  return {
    assetsCount: Array.isArray(value.assets) ? value.assets.length : 0,
    authorAvatarUrl: isRecord(value.author) ? stringValue(value.author.avatar_url) : undefined,
    authorLogin: isRecord(value.author) ? stringValue(value.author.login) : undefined,
    body: stringValue(value.body),
    draft: value.draft === true,
    name: stringValue(value.name),
    owner: parsed.owner,
    prerelease: value.prerelease === true,
    publishedAt: stringValue(value.published_at),
    repository: parsed.repository,
    tag: stringValue(value.tag_name) ?? parsed.tag ?? "latest",
    url: parsed.url,
  }
}

type GitHubSupplementaryData = {
  contributors?: Record<string, unknown>[]
  languages?: Record<string, unknown>
  repositories?: Record<string, unknown>[]
  repositoriesComplete?: boolean
}

async function fetchGitHubSupplementaryData(
  parsed: NonNullable<ReturnType<typeof parseGitHubLink>>,
  githubToken?: string,
  primary?: Record<string, unknown>,
): Promise<GitHubSupplementaryData | undefined> {
  if (parsed.kind === "release") return undefined
  if (parsed.kind === "user") {
    const publicRepositoryCount = numberValue(primary?.public_repos)
    if (
      typeof publicRepositoryCount !== "number" ||
      publicRepositoryCount > GITHUB_PAGE_SIZE * MAX_GITHUB_REPOSITORY_PAGES
    ) {
      return { repositoriesComplete: false }
    }

    const repositories = await fetchAllGitHubRepositories(
      parsed.login,
      primary?.type === "Organization",
      publicRepositoryCount,
      githubToken,
    )
    return repositories
  }

  const basePath = `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repository)}`
  const [contributors, languages] = await Promise.all([
    fetchGitHubJson(`${basePath}/contributors?per_page=12`, githubToken),
    fetchGitHubJson(`${basePath}/languages`, githubToken),
  ])
  return {
    contributors: Array.isArray(contributors) ? contributors.filter(isRecord) : [],
    languages: isRecord(languages) ? languages : {},
  }
}

async function fetchGitHubJson(path: string, githubToken?: string): Promise<unknown> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "NexusVaultMetadata/1.0",
      "x-github-api-version": "2022-11-28",
      ...(githubToken ? { authorization: `Bearer ${githubToken}` } : {}),
    },
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) {
    if (isTransientGitHubResponse(response)) {
      throw new RetryableMetadataError(
        `GitHub supplementary API returned retryable HTTP ${response.status}.`,
      )
    }
    return undefined
  }
  return response.json()
}

async function fetchAllGitHubRepositories(
  login: string,
  isOrganization: boolean,
  expectedCount: number,
  githubToken?: string,
): Promise<GitHubSupplementaryData> {
  if (expectedCount === 0) {
    return { repositories: [], repositoriesComplete: true }
  }

  const repositories: Record<string, unknown>[] = []
  const pages = Math.max(1, Math.ceil(expectedCount / GITHUB_PAGE_SIZE))
  const basePath = isOrganization
    ? `/orgs/${encodeURIComponent(login)}/repos`
    : `/users/${encodeURIComponent(login)}/repos`
  const repositoryType = isOrganization ? "public" : "owner"

  for (let page = 1; page <= pages; page += 1) {
    const payload = await fetchGitHubJson(
      `${basePath}?per_page=${GITHUB_PAGE_SIZE}&page=${page}&sort=updated&type=${repositoryType}`,
      githubToken,
    )
    if (!Array.isArray(payload)) {
      return { repositories, repositoriesComplete: false }
    }
    repositories.push(...payload.filter(isRecord))
  }

  return {
    repositories,
    repositoriesComplete: repositories.length >= expectedCount,
  }
}

function isTransientGitHubResponse(response: Response) {
  return (
    response.status === 408 ||
    response.status === 425 ||
    response.status === 429 ||
    response.status >= 500 ||
    (response.status === 403 &&
      (response.headers.get("x-ratelimit-remaining") === "0" ||
        response.headers.has("retry-after")))
  )
}

function isTransientNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    error instanceof TypeError ||
    /\b(timeout|timed out|network|fetch|econn|enotfound|eai_again)\b/.test(message)
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Network request failed."
}

function sumValues(items: Record<string, unknown>[], key: string) {
  return items.reduce((total, item) => total + (numberValue(item[key]) ?? 0), 0)
}

function getIdentifiers(
  parsed: NonNullable<ReturnType<typeof parseGitHubLink>>,
): Record<string, string> {
  if (parsed.kind === "user") return { login: parsed.login }
  if (parsed.kind === "repository") return { owner: parsed.owner, repository: parsed.repository }
  return parsed.tag
    ? { owner: parsed.owner, repository: parsed.repository, tag: parsed.tag }
    : { owner: parsed.owner, repository: parsed.repository }
}

function getPreviewTitle(
  parsed: NonNullable<ReturnType<typeof parseGitHubLink>>,
  data: Record<string, unknown>,
) {
  if (parsed.kind === "user") return stringValue(data.name) ?? stringValue(data.login)
  if (parsed.kind === "repository") return `${String(data.owner)}/${String(data.name)}`
  return stringValue(data.name) ?? stringValue(data.tag)
}

function getPreviewDescription(data: Record<string, unknown>) {
  return stringValue(data.bio) ?? stringValue(data.description) ?? stringValue(data.body)
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object")
}

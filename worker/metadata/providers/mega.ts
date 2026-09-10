import { File as MegaFile } from "megajs"

import {
  createBaseResourceMetadata,
  type ResourceFileTreeNode,
  type ResourceFileType,
  type ResourceMediaMetadata,
} from "../../domain/resources/metadata"
import { parseMegaLink } from "../../domain/resources/input"

import type { MetadataProvider } from "../metadata-provider"

const MEGA_MAX_FILES = 5_000
const MEGA_MAX_DEPTH = 32

type MegaNode = {
  directory: boolean
  name: string
  size?: number
  timestamp?: number
  downloadId?: string | string[]
  nodeId?: string
  children?: MegaNode[]
  link: (options: boolean) => Promise<string>
}

type MegaFileEntry = {
  file: MegaNode
  name: string
  path: string
}

export const megaMetadataProvider: MetadataProvider = {
  name: "mega",
  supports: (resource) => resource.type === "mega" || parseMegaLink(resource.url) !== null,
  async resolve(resource) {
    const parsed = parseMegaLink(resource.url)
    const base = createBaseResourceMetadata({ type: "mega", title: resource.title })

    if (!parsed) {
      return {
        provider: "mega",
        status: "failed",
        data: base,
        errorMessage: "Invalid MEGA link. A folder or file link with a key is required.",
      }
    }

    try {
      const root = await loadMegaRoot(parsed.url) as unknown as MegaNode
      const files: MegaFileEntry[] = []
      const tree = collectMegaTree(root, "", files, 0)
      const media = await Promise.all(files.map((file) => toMedia(file, parsed.url)))
      const rootName = root.name || resource.title || "MEGA folder"
      const title = root.directory ? rootName : files[0]?.name ?? rootName

      return {
        provider: "mega",
        status: "completed",
        data: {
          ...createBaseResourceMetadata({ type: "mega", title }),
          title,
          size: getTotalSize(files),
          fileCount: files.length,
          fileType: getResourceFileType(files, root.directory),
          media: media.flat(),
          tree,
          identifiers: {
            handle: parsed.handle,
            key: parsed.key,
            kind: parsed.kind,
          },
          source: {
            name: "mega",
            url: parsed.url,
            attribution: { label: "MEGA", url: "https://mega.nz/" },
          },
        },
      }
    } catch (error) {
      return {
        provider: "mega",
        status: "failed",
        data: {
          ...base,
          identifiers: {
            handle: parsed.handle,
            key: parsed.key,
            kind: parsed.kind,
          },
          source: { name: "mega", url: parsed.url },
        },
        errorMessage: getMegaErrorMessage(error),
      }
    }
  },
}

function getMegaErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "MEGA metadata request failed."
  const cause = error.cause
  if (cause instanceof Error && cause.message && cause.message !== error.message) {
    return `${error.message}: ${cause.message}`
  }
  if (cause && typeof cause === "object" && "code" in cause) {
    const code = (cause as { code?: unknown }).code
    if (typeof code === "string") return `${error.message} (${code})`
  }
  return error.message || "MEGA metadata request failed."
}

async function loadMegaRoot(url: string) {
  const file = MegaFile.fromURL(url)
  return new Promise<unknown>((resolve, reject) => {
    file.loadAttributes((error, loadedFile) => {
      if (error) {
        reject(error)
      } else {
        resolve(loadedFile)
      }
    })
  })
}

function collectMegaTree(
  node: MegaNode,
  parentPath: string,
  files: MegaFileEntry[],
  depth: number,
): ResourceFileTreeNode[] {
  if (!node.directory) {
    if (files.length >= MEGA_MAX_FILES) {
      throw new Error(`MEGA folder contains more than ${MEGA_MAX_FILES} files.`)
    }
    const name = node.name || "Unnamed MEGA file"
    const path = parentPath ? `${parentPath}/${name}` : name
    files.push({ file: node, name, path })
    return [{ name, type: getResourceFileTypeForFile(node), size: node.size }]
  }

  if (depth > MEGA_MAX_DEPTH) {
    throw new Error(`MEGA folder nesting exceeds ${MEGA_MAX_DEPTH} levels.`)
  }

  const name = node.name || "Unnamed MEGA folder"
  const currentPath = parentPath ? `${parentPath}/${name}` : name
  const children = (node.children ?? []).map((child) => {
    const childTree = collectMegaTree(child, currentPath, files, depth + 1)
    return childTree[0] ?? { name: child.name || "Unnamed MEGA content" }
  })

  return [{ name, type: "folder", children }]
}

async function toMedia(entry: MegaFileEntry, sourceUrl: string): Promise<ResourceMediaMetadata[]> {
  const url = await entry.file.link(false)
  const kind = getMediaKind(entry.file.name)
  const metadata: Record<string, unknown> = { path: entry.path }
  if (entry.file.nodeId) metadata.nodeId = entry.file.nodeId
  if (entry.file.timestamp !== undefined) {
    metadata.timestamp = entry.file.timestamp
    metadata.createdAt = new Date(entry.file.timestamp * 1000).toISOString()
  }

  return [{
    kind,
    provider: "mega",
    sourceId: entry.file.nodeId,
    sourceUrl,
    url,
    fileName: entry.name,
    ...(entry.file.size !== undefined ? { size: entry.file.size } : {}),
    metadata,
  }]
}

function getResourceFileType(files: MegaFileEntry[], isFolder: boolean): ResourceFileType | undefined {
  if (isFolder) return "folder"
  return files[0] ? getResourceFileTypeForFile(files[0].file) : undefined
}

function getResourceFileTypeForFile(file: MegaNode): ResourceFileType {
  const kind = getMediaKind(file.name)
  if (kind === "image") return "image"
  if (kind === "video") return "video"
  if (kind === "audio") return "audio"
  if (kind === "document") return "document"
  return "unknown"
}

function getMediaKind(fileName: string): ResourceMediaMetadata["kind"] {
  const extension = fileName.match(/\.([a-z0-9]{1,12})$/i)?.[1]?.toLowerCase()
  if (["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg"].includes(extension ?? "")) return "image"
  if (["mp4", "mkv", "webm", "mov", "m4v", "avi", "wmv", "flv"].includes(extension ?? "")) return "video"
  if (["mp3", "flac", "wav", "aac", "ogg", "m4a", "opus"].includes(extension ?? "")) return "audio"
  if (["txt", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "epub"].includes(extension ?? "")) return "document"
  return "unknown"
}

function getTotalSize(files: MegaFileEntry[]) {
  const sizes = files.map((file) => file.file.size).filter((size): size is number => typeof size === "number")
  return sizes.length === files.length ? sizes.reduce((total, size) => total + size, 0) : undefined
}

import { createBaseResourceMetadata } from "@/domain/resources/metadata"
import { parseEd2kLink, parseFtpLink, parseThunderLink } from "@/domain/resources/input"

import type { MetadataProvider } from "../metadata-provider"

export const localLinkMetadataProvider: MetadataProvider = {
  name: "local-link-parser",
  supports: (resource) => {
    const url = resource.url.trim().toLowerCase()
    return url.startsWith("ed2k://") || url.startsWith("ftp://") || url.startsWith("thunder://")
  },
  async resolve(resource) {
    const ftp = parseFtpLink(resource.url)
    if (ftp) {
      return {
        provider: "local-ftp-parser",
        status: "completed",
        data: {
          ...createBaseResourceMetadata({
            type: resource.type,
            title: ftp.fileName ?? resource.title,
          }),
          title: ftp.fileName ?? resource.title,
          fileCount: ftp.fileName ? 1 : undefined,
          fileType: ftp.fileType,
          tree: ftp.fileName
            ? [
                {
                  name: ftp.fileName,
                  type: ftp.fileType,
                },
              ]
            : [],
          source: {
            name: "local-ftp-parser",
            url: ftp.url,
          },
          extra: {
            ftp: {
              host: ftp.host,
              path: ftp.path,
              port: ftp.port,
              fileName: ftp.fileName,
              fileExtension: ftp.fileExtension,
              fileType: ftp.fileType,
              availability: {
                status: "not_checked",
                reason: "FTP size probing is not available in the Worker fetch runtime.",
              },
            },
          },
        },
      }
    }

    const ed2k = parseEd2kLink(resource.url)
    if (ed2k) {
      return {
        provider: "local-ed2k-parser",
        status: "completed",
        data: {
          ...createBaseResourceMetadata({
            type: resource.type,
            title: ed2k.fileName,
          }),
          title: ed2k.fileName,
          size: ed2k.fileSize,
          fileCount: 1,
          fileType: ed2k.fileType,
          tree: [
            {
              name: ed2k.fileName,
              type: ed2k.fileType,
              size: ed2k.fileSize,
            },
          ],
          identifiers: {
            ed2kHash: ed2k.hash,
          },
          source: {
            name: "local-ed2k-parser",
          },
          extra: {
            ed2k,
          },
        },
      }
    }

    const thunder = parseThunderLink(resource.url)

    return {
      provider: "local-thunder-parser",
      status: "completed",
      data: {
        ...createBaseResourceMetadata({
          type: resource.type,
          title: thunder?.fileName ?? resource.title,
        }),
        title: thunder?.fileName ?? resource.title,
        fileCount: thunder?.fileName ? 1 : undefined,
        fileType: thunder?.fileType,
        tree: thunder?.fileName
          ? [
              {
                name: thunder.fileName,
                type: thunder.fileType,
              },
            ]
          : [],
        source: {
          name: "local-thunder-parser",
        },
        extra: {
          thunder: {
            ...thunder,
            availability: {
              status: "not_checked",
              strategy: "HEAD, then Range GET bytes=0-0",
            },
          },
        },
      },
    }
  },
}

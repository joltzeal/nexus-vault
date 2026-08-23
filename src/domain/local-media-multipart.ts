export type LocalMediaUploadSource = {
  clientId: string
  fileName: string
  mimeType: string
  size: number
  thumbnail?: {
    clientId: string
    fileName: string
    mimeType: string
    size: number
  }
}

export type LocalMediaMultipartUpload = {
  clientId: string
  key: string
  uploadId: string
}

export type LocalMediaMultipartPlan = {
  resourceId: string
  uploads: LocalMediaMultipartUpload[]
}

export type UploadedLocalMediaFile = {
  clientId: string
  fileName: string
  mimeType: string
  objectKey: string
  size: number
  thumbnail?: {
    clientId: string
    mimeType: string
    objectKey: string
    size: number
  }
}

export type LocalMediaResourceFields = {
  description?: string
  referer?: string
  spaceId?: string
  title?: string
}

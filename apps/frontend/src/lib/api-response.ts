type ApiError = {
  code: string
  message: string
  details?: unknown
}

export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json(
    {
      success: true,
      data,
      error: null,
    },
    init
  )
}

export function fail(error: ApiError, init?: ResponseInit) {
  return Response.json(
    {
      success: false,
      data: null,
      error,
    },
    {
      status: init?.status ?? 400,
      headers: init?.headers,
    }
  )
}

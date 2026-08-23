declare namespace chrome {
  namespace runtime {
    const lastError: { message?: string } | undefined
    const id: string

    function getURL(path: string): string
    function sendMessage(message: unknown): Promise<unknown>

    const onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: unknown,
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ): void
    }
  }

  namespace storage {
    type StorageArea = {
      get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>
      set(items: Record<string, unknown>): Promise<void>
      remove(keys: string | string[]): Promise<void>
    }

    const local: StorageArea
  }

  namespace tabs {
    function create(createProperties: { active?: boolean; url: string }): Promise<unknown>
  }
}

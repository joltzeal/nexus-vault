import { useEffect } from "react";

const defaultDocumentTitle = "Nexus Vault";

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title?.trim() || defaultDocumentTitle;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}


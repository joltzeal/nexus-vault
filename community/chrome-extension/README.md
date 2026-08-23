# Nexus Vault Chrome Extension

Manifest V3 extension for saving x.com tweets into Nexus Vault.

## Build

```bash
pnpm --filter @nexus-vault/chrome-extension build
```

Load `community/chrome-extension/dist` in Chrome via `chrome://extensions` with Developer Mode enabled.

## Behavior

- The popup checks `https://nexus-vault.stacklabs.space` auth through the extension background worker.
- If the Nexus Vault session cookie is missing or expired, the popup opens the Nexus Vault home page for login.
- The last selected Vault/Space is saved in `chrome.storage.local`.
- On x.com/twitter.com, each tweet card gets a Nexus Vault icon in the lower-right corner. Clicking it opens a ResourceTransferDialog-style target picker and creates a `twitter` resource in the selected Space.

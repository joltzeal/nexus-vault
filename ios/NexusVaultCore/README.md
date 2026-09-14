# NexusVaultCore

The iOS core is intentionally a Swift Package so the host iOS app, Share Extension, and tests can consume the same API, model, session, retry, and cache behavior.

- `SessionStore` owns the signed-out, restoring, authenticated, expired, and failure states. Call `handleForeground()` from `scenePhase` changes and wire API 401 callbacks to `handleUnauthorized()`.
- `ExtensionAuthCoordinator` returns the login deep link for unauthenticated Share Extension work and persists the original destination in `ExtensionRetryQueue`. Call `retry` after a successful login.
- `MetadataCache` persists metadata state across launches and exposes atomic status updates for polling or push refreshes.

Run `swift test` from this directory. The package requires iOS 16 or newer.

# Browser source layout

This directory follows the Nexus Vault frontend convention. It is intentionally a scaffold: business behavior belongs in feature folders and pages should only compose features.

- `app/`: router, providers, and public/dashboard layouts
- `pages/`: route-level composition
- `features/`: auth, vault, space, resource, search, and settings domains
- `components/`: shared layout, navigation, overlays, display, and shadcn primitives
- `hooks/`, `lib/`, `types/`, `styles/`: cross-feature utilities and contracts

Add implementation files as each feature is built; keep the existing application entrypoint independent until the new router is ready.

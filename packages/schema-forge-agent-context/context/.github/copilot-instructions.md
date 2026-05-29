# Copilot Instructions - Schema Forge Consumers

- Treat Schema Forge packages as public package boundaries.
- Prefer package imports over copied source or monorepo-relative paths.
- Keep generated contracts and generated windows in the consuming project.
- Keep `@etendosoftware/app-shell-core` free of app-specific business logic.
- Use `sf-stack doctor` to check package and peer dependency resolution.
- Use `sf-stack install-agent-context --dry-run` before installing packaged agent context.

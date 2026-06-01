# Copilot Review Instructions - Schema Forge Consumers

Flag these issues in downstream projects:

- Imports from internal monorepo paths instead of package names.
- Generated windows or contracts placed inside reusable core packages.
- Runtime code that assumes a specific generated window exists in app-shell core.
- Missing peer dependencies required by `@etendosoftware/app-shell-core`.
- Agent context installers that overwrite existing files without explicit force.
- Package changes without pack or consumer smoke validation.

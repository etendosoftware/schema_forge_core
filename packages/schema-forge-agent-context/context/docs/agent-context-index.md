# Schema Forge Agent Context Index

This package installs a curated context set for downstream agent work.

## Files

- `AGENTS.md`: default operational rules and architecture boundaries.
- `CLAUDE.md`: package split, consumer expectations, and validation habits.
- `.github/copilot-instructions.md`: short coding guidance for consumer repos.
- `.github/copilot-review-instructions.md`: review checklist for package-boundary regressions.
- `docs/architecture-overview.md`: compact architecture summary.

## Usage

Run `sf-agent-context list` to inspect packaged files.
Run `sf-agent-context install --target <repo> --dry-run` before installing.
Run `sf-agent-context install --target <repo> --force` only when replacing existing context files is intentional.

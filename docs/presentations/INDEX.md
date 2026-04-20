# docs/presentations

Slide-deck style documents (Marp-compatible Markdown) meant to be presented
to the team or stakeholders. They summarise a proposal, feature, or epic
in a digestible walkthrough; the authoritative reference stays in
`docs/proposals/` or `docs/plans/`.

## How to render

These are Markdown files with a Marp frontmatter header. Render options:

- **VS Code:** install the `Marp for VS Code` extension, open the file, click "Open Preview".
- **CLI:** `npx @marp-team/marp-cli@latest <file>.md -o <file>.pdf` (or `--html`).
- **Plain Markdown:** still readable as a regular document without a renderer.

## Index

| File | Audience | Summary |
|------|----------|---------|
| [etendo-apps-sdk-demo.md](etendo-apps-sdk-demo.md) | Team + stakeholders | Walkthrough of the Etendo Apps SDK (packages, JWT bridge, styling) with the `quick-order-app` as the first real consumer. |

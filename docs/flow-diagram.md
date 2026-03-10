# Schema Forge → NEO Headless Flow

All diagrams are in Mermaid format (`.mmd` files) in `docs/diagrams/`.

## Diagrams

| File | Description |
|------|-------------|
| [`complete-pipeline.mmd`](diagrams/complete-pipeline.mmd) | Full pipeline from AD extraction to runtime API, including parallel code generation and testing paths |
| [`visibility-model.mmd`](diagrams/visibility-model.mmd) | How the 4 Schema Forge visibility states map to 2 NEO Headless flags and API behavior |
| [`request-lifecycle.mmd`](diagrams/request-lifecycle.mmd) | Sequence diagram of a request through NeoServlet (auth → resolve → filter → handler → response) |
| [`webhook-config-flow.mmd`](diagrams/webhook-config-flow.mmd) | How Schema Forge configures NEO Headless via webhooks (no restart needed) |

## Rendering

- **VS Code**: Install "Mermaid Preview" extension, then open any `.mmd` file
- **GitHub**: `.mmd` files render automatically in the browser
- **CLI**: `npx @mermaid-js/mermaid-cli mmdc -i docs/diagrams/complete-pipeline.mmd -o pipeline.svg`

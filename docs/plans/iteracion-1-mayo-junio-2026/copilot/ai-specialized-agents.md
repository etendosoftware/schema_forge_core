# AI Specialized Agents + Full Integration

> Tema: Copilot · Dev: D · Semanas: post S6 · Prioridad: 🟠 P3

## Intent

Build the Copilot infrastructure that powers AI features across the app (OCR, reconciliation suggestions, dunning text generation, financial Q&A) AND ship a small set of specialized agents users can invoke directly: "Ask the data" agent for ad-hoc questions, "Draft email" agent for one-off communication, "Audit assistant" agent for anomaly detection.

## Scope (What this should do)

- Agent infrastructure: registry of agents, per-agent system prompts + tool sets, per-org config (model, temperature, allowed tools).
- Tool gateway: agents can call tightly-scoped read tools (list invoices, get aging, search products) — never arbitrary writes without explicit user confirmation.
- Chat surface: floating Copilot panel available on every window, with context-aware suggestions ("you're on a sales-invoice; try: 'Why is this overdue?'").
- Specialized agents:
  - **Ask the data**: NL questions over the org's financial / operational data, returning numbers + sources.
  - **Draft email**: composes emails for collections, quotations, supplier follow-ups using the org's template style.
  - **Audit assistant**: nightly scan for anomalies (duplicate invoices, mismatched bank/invoice totals, unusual GL postings) and surface them as alerts.
- Audit log of all agent calls (prompt, tools used, output) for compliance.

## Subtareas (How)

1. Pick the agent runtime: Anthropic SDK (Claude) is recommended for tool-use quality and Spanish-language fluency.
2. Implement `AgentRegistry` Java service with per-org config and a small DSL for tool-binding.
3. Build the tool gateway exposing safe read endpoints — start with: `searchInvoices`, `getAging`, `searchProducts`, `getStockLevel`, `getJournalLines`. NO write tools in v1.
4. Chat panel UI: floating bottom-right, context-aware (passes the current window + record id to the agent), streaming responses.
5. Specialized agents = agent definitions (system prompt + allowed tools), not separate code paths.
6. Nightly Audit job invokes the Audit agent with a fixed prompt and writes findings to the alerts table.
7. Org config screen for: enable/disable Copilot, model choice, monthly token budget cap, opt-in to send data to provider.

## Dependencies

- LLM provider account (Anthropic) + per-org API key
- `../finanzas/ai-reconciliation-suggestions.md` — also uses agents but for a single purpose
- `../compras/ocr-smart-scan.md` — uses agents for vision OCR
- Audit log / alert infrastructure

## Acceptance criteria

- [ ] User opens the Copilot panel on a sales invoice and asks "What's our typical payment time for this customer?" — agent answers with a number + cites the source documents.
- [ ] Draft-email agent produces a polished, on-brand reminder email in <5s.
- [ ] Audit agent flags a duplicate invoice scenario in the nightly run.
- [ ] No write tool call goes through without an explicit user confirmation step.
- [ ] Token budget cap blocks calls when the monthly limit is hit and surfaces a clear message.
- [ ] All agent calls logged with prompt, tools, output, latency, cost.

## Related windows / artifacts

- `../finanzas/ai-reconciliation-suggestions.md`
- `../compras/ocr-smart-scan.md`
- `../finanzas/financial-reports.md` — drill-down target for agent answers
- `../inventario/inventory-movements-alerts.md` — alerts surface

## Notes / Risks

- Tool-use precision is the key quality bar — invest in tight tool descriptions and sample-driven evals.
- Privacy: be explicit with customers about what data goes to the LLM provider; provide per-org opt-in/opt-out.
- Cost: tool-using agents can balloon if loops aren't bounded. Hard-cap turns per call (e.g. 6).
- v1 = read-only. Write actions wait until v2 with proper guardrails.

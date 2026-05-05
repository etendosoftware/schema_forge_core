# Iteration 1 Review Mocks

This folder contains a small Vite app for reviewable May-June 2026 iteration mocks.

## Run

```bash
npm run dev
```

Then open the local Vite URL.

## Scope

- Progressive timeline from S1 through post-S6.
- Separate review pages for Finance, Fiscal Localization, Sales, Purchasing, Inventory, Products, Assets, Copilot AI, and Setup.
- Task-level navigation that maps back to the planning documents.
- Static sample data only; this app does not call NEO Headless or any backend service.
- Every area page includes notes and feedback prompts so reviewers can comment on intent, workflow, data, risks, and missing states.

## Design System Applied

The review tool uses the Etendo design-system bundle exported from Claude Design:

- Inter typography with 14px body rhythm and 20px page titles.
- Etendo logo vector inside the yellow tile gradient.
- 56px icon rail plus secondary navigation.
- Page chrome background `#F5F7F9`, white edged cards, 1px neutral borders, and no card shadows.
- Primary actions in ink `#121217`; yellow is reserved for logo and selected states.
- Tables, tabs, buttons, badges, and KPI cards follow the bundle token direction.

## Update Rules

- Keep mock copy in English.
- Keep the screen list aligned with the task files in this plan folder.
- Use these mocks for product review only; implementation decisions still belong in the task documents and Schema Forge specs.

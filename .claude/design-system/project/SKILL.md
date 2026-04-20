---
name: etendo-design
description: Use this skill to generate well-branded interfaces and assets for Etendo (a Spanish-language SMB SaaS / ERP suite — Facturas, Contactos, CRM, Ventas, Compras, Pedidos, Presupuestos + a Copilot assistant), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out of `assets/` and `ui_kits/web-app/` and create static HTML files for the user to view. The tokens in `colors_and_type.css` are the single source of truth for color, type, spacing, radius, and shadow.

If working on production code, copy assets and read the rules in `README.md` (Content fundamentals, Visual foundations, Iconography) to become an expert in designing with this brand.

**Key reminders:**
- UI copy is Spanish, informal (tú, never usted). No emoji. Sentence case. Eyebrow labels are UPPERCASE with letter-spacing.
- One brand accent: amber yellow `#F2CB00`. Primary buttons are ink-black `#19191D`, not yellow. Yellow is reserved for state (active nav, logo).
- Cards are edged (1px border, 12px radius, no shadow) — not floated.
- No gradients, no illustrations, no patterns. The UI steps back; the data is the subject.
- Icons: Lucide line set, 1.75 stroke. Never emoji or unicode dingbats.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions (audience, screens/surface, Spanish or translated, variations desired), and act as an expert designer who outputs HTML artifacts or production code, depending on the need.

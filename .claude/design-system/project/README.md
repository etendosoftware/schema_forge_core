# Etendo Design System

A design system derived from the **Etendo SaaS** product — a Spanish-language
SMB management / ERP suite (Facturas, Contactos, CRM, Ventas, Compras, Pedidos,
Presupuestos) with an embedded AI assistant named **Copilot**.

The product presents a classic three-pane app shell — a slim icon sidebar on
the left, a global search + AI actions in the top rail, and a content canvas
with data tables, cards, and empty states. The visual tone is quiet and
enterprise-trustworthy with a single, confident **amber-yellow** brand accent
dropped into an otherwise near-monochrome palette.

---

## Sources

Only screenshots were provided — no code, no Figma. All tokens, type, spacing,
and iconography guidance were reverse-engineered from pixel sampling of the
following frames (stored in `_source/` for reference):

| Surface            | File                              |
| ------------------ | --------------------------------- |
| Marketing + signup | `_source/Onboarding.png`          |
| Home dashboard     | `_source/Inicio_CasoNormal.png`   |
| Contacts list      | `_source/Contactos_HappyPath.png` |
| Contacts empty     | `_source/Contactos_EmptyState.png`|
| Import modal       | `_source/Contactos_Importar.png`  |
| Import confirm     | `_source/Contactos_DobleConfirmacion.png` |
| Import loader      | `_source/Contactos_Loader.png`    |
| Import error       | `_source/Contactos_UnhappyPath.png` |
| Results w/ errors  | `_source/Contactos_HuboErrores.png` |
| Sales invoices     | `_source/FacturasVenta.png`       |
| Purchase invoices  | `_source/FacturasCompra.png`      |
| Filters            | `_source/FiltrosAplicados.png`    |
| Save filter toast  | `_source/GuardarFiltro.png`       |
| Search             | `_source/Buscar.png`              |

---

## Index

| Path                           | What it is                                         |
| ------------------------------ | -------------------------------------------------- |
| `colors_and_type.css`          | Tokens — colors, type ramp, spacing, radii, shadow |
| `assets/`                      | Logo mark + wordmark extracted from screenshots    |
| `fonts/`                       | *(none local — uses Google Fonts; see caveat)*     |
| `preview/`                     | Design-system cards (one HTML per token family)    |
| `ui_kits/web-app/`             | React recreation of the Etendo SaaS app            |
| `SKILL.md`                     | Entrypoint when this folder is used as an Agent Skill |
| `_source/`                     | Original screenshot references                     |

---

## Content fundamentals

**Language:** Spanish (castellano, informal European tone — "tu empresa",
"¿Ya tienes una cuenta?"). Tú, not usted.

**Tone:** Friendly-operational. The app talks to a small-business owner as a
helpful colleague. Short sentences. Action-oriented titles (verbs first when
there's a CTA, noun phrases when describing state).

**Casing:** Sentence case everywhere except eyebrow labels over tables/cards,
which are SMALLCAPS-style uppercase with letter-spacing (`TAREAS PENDIENTES`,
`ACCESOS RÁPIDOS`, `CLIENTES DESTACADOS`, `RESUMEN FINANCIERO`). Buttons and
nav items are sentence case.

**Vocabulary examples (lifted verbatim):**
- "Hola, Jhon Doe"
- "Estas son tus tareas pendientes"
- "¿En qué te puedo ayudar hoy?" (Copilot CTA)
- "Crea tu cuenta gratis — Empieza en menos de 1 minuto"
- "Gestiona tu negocio con ayuda de Copilot"
- "Empieza agregando tus contactos / Puedes crearlos manualmente o importarlos en segundos"
- "Arrastra tu archivo aquí — o selecciona un archivo. Formatos compatibles: XLS, CSV o TXT"
- "Aprende cómo importar tus contactos de forma rápida y sencilla → Ver guía"
- "Pídeselo a Copilot" (secondary CTA alongside "+ Nuevo contacto")
- "112 contactos importados correctamente" (success toast)
- "No se pudo completar la importación / Ocurrió un problema al procesar el archivo. Verifica el formato e inténtalo nuevamente."
- "Descarga los errores ahora, ya que no podrás consultarlos nuevamente." (warning)
- "Filtro guardado correctamente" (success toast)

**Tone rules:**
- **I vs. you:** always _tú_. Never _usted_. "Pídeselo a Copilot" treats the AI
  as a teammate, not a feature.
- **Errors** explain *what* went wrong and give one clear retry action. No
  blame on the user ("Verifica el formato" — not "corrige tu archivo").
- **Emoji:** none in product copy. None in toasts. None in empty states.
- **No emoji decoration on headings.** Icons carry visual cues instead.
- **Numbers:** European formatting — `€12.400.000` in marketing, `EUR 12.4M` /
  `EUR 324.000,00` in-app. Comma decimal separator, period thousands.
  Currency code `EUR` preferred over `€` symbol inside the app.

**The "vibe":** a quiet, competent financial workspace. Nothing screams. The
yellow is the one place the brand asserts itself; everywhere else the UI steps
back and lets the data and the user's work be the subject.

---

## Visual foundations

**Palette strategy.** Monochrome ink + cool-gray neutrals + one amber-yellow
accent + four muted semantic tints. Semantic badges use soft pastel fills
(never saturated), with a matching darker text tone — e.g. pending invoice
pill: `#FFF9EB` fill / `#8A6E25` text. The `Nueva factura` primary button is
near-black `#19191D`, not yellow — yellow is reserved for **state** (active
nav, logo, selected row highlight).

**Backgrounds.** Flat white `#FFFFFF` for the canvas. The side rail and
chrome elements sit on the cool `#F5F7F9` tint. **No gradients, no
illustrations, no patterns, no photographic imagery.** The only hero-style
visual in the entire system is the marketing onboarding page, where the
right panel shows a cropped product screenshot floating on the `#F5F7F9`
tint — literally a dogfooded preview, not an illustration.

**Type.** A single humanist neo-grotesk used across both marketing and app.
Weights used: 400 (body, table rows), 500 (labels, chip text), 600 (section
headers, H2), 700 (page title, big numbers). Tight negative tracking on
display sizes (`-0.02em` at 40px), neutral tracking in body. Uppercase
eyebrow labels use `+0.06em`. Big financial numbers are the most emphatic
type on the page — larger than the page title itself.

**Spacing.** 4px base unit. Cards sit on a 16/24px outer padding. Table rows
are ~44px tall (a 4xbase + 12px ascender/descender). The icon rail is
exactly **48px** wide with 44px hit-targets. Layout gutters between cards
are 16px; between columns, 24px.

**Borders.** Hairline 1px `#E3E7EC` everywhere structural — card edges, table
header underline, input borders, modal frames. Dividers inside cards step up
to `#EEF1F5`. **Never** a colored accent border. **Never** a left-edge color
bar on cards (explicitly avoid this AI-ish pattern).

**Corner radii.** 8px on buttons/inputs/badges, 12px on cards and menus,
16px on modals. Pills (status badges like `Pendiente`, tag chips like
`Servicios reconocido…`) use full `999px`.

**Cards.** White fill, 1px border, 12px radius, no shadow in the base state.
Shadow only on floating objects (dropdowns, modals, toasts). This is key —
Etendo cards are *edged*, not *floated*.

**Shadows.**
- `xs` for raised buttons-with-chevron split menus
- `sm` for dropdown menus and tooltips
- `md` for toasts and popovers
- `lg` for modals (`Importar contactos`, `Confirmar importación`)
No inner shadows. No neumorphism.

**Focus.** 3px yellow ring at 35% opacity (`--shadow-focus`) matching brand
accent. Keyboard-only; not shown on click.

**Hover states.**
- Buttons (primary): ink lightens by ~6% (`#19191D → #2A2A30`)
- Buttons (secondary/tertiary): bg shifts from transparent → `#F5F7F9`
- Table rows: bg shifts from white → `#EEF1F5`
- Sidebar items: bg shifts to `#FFFFFF` (pops out of the `#F5F7F9` chrome)
- Links (marketing only): black → amber yellow

**Press states.** Primary button uses slightly darker ink `#121217`. No
scale-transform, no shrink. Checkboxes and radio use the amber-yellow as
their fill-when-checked, with a black tick.

**Animation.** Near-zero. 120–160ms ease-out on hovers, 200ms on menu/modal
open (fade + 4px translate-down). **No bouncy springs, no parallax, no
micro-interactions with personality** — this is a professional tool and the
motion language reflects that. Loaders use a determinate progress bar
(`Importando contactos… 20%`) over a spinner whenever the work has a known
duration.

**Transparency & blur.** Not used anywhere in the current product. Modals
sit on a solid black-at-24%-opacity overlay; no backdrop-filter blur.

**Fixed elements.** The left icon rail and top-bar are fixed. Nothing else
is sticky. Toasts pin to bottom-center.

**Imagery tone.** Not applicable — there is no marketing/editorial imagery
in the current product. If/when it's added, it should stay cool, neutral,
and avoid warm color casts so the amber accent remains the one warm note.

---

## Iconography

Icons in the sourced screenshots are a consistent **1.5px-stroke line set**
reminiscent of Feather / Lucide — outlined, rounded caps, rounded joins,
24×24 box. No filled icons except the **active sidebar item**, where the
icon sits inside a filled yellow square background (`#F2CB00`) and the icon
itself becomes black-on-yellow.

**Substitution flagged:** since no icon sprite or font was available in the
source, this system ships with **[Lucide](https://lucide.dev)** (CDN) as the
closest match. Strokes, corner style, proportions, and the set of glyphs
used in the product (Home, Star, Contact, Share, TrendingUp, FileText, Box,
Briefcase, Landmark, Headphones, User, Bell, Plus, Search, Mic, Sparkles,
Filter, Upload, ArrowUpDown, Eye, ChevronDown, X, CheckCircle2, AlertTriangle,
XCircle, BookOpen, Play) all map cleanly. **If an official icon set exists,
swap `ui_kits/web-app/icons.jsx` to read from it.**

**Emoji:** never used in product copy or UI.
**Unicode dingbats:** never used. Arrows are Lucide `ArrowUp`/`ArrowDown`.
**Bullet points in text** use hyphens or real `<ul>`, never `✓` glyphs (the
onboarding checkmarks in "Sin tarjeta de crédito / Prueba gratuita / Acceso
inmediato" are rendered as Lucide `Check` inside a pill, not as text `✓`).

**Logo.** Extracted from the Onboarding screen and saved to
`assets/logo-mark.png`, `assets/logo-mark-lg.png`, and
`assets/logo-wordmark.png`. The mark is a rounded-square yellow tile with a
stylized inverted-E glyph; it's small (~24–32px in-app) and is the single
piece of branded color outside of state-color usage.

---

## Caveats & substitutions

- **Font substitution:** no TTF/OTF was shipped with the source. The
  product's UI font closely resembles **Inter** (or a near-neighbor like
  TT Commons / Söhne). This system uses **Inter** from Google Fonts as the
  substitute. **Ask:** share the actual `.woff2` family and I'll swap it in.
- **Icon substitution:** Lucide via CDN. If there's an internal icon
  library, point me at it.
- **Logo:** the mark was raster-cropped from the onboarding PNG (not an
  SVG). **Ask:** provide a vector logo (SVG) and I'll replace `logo-mark.png`.
- **No codebase / Figma access** — tokens were pixel-sampled, which is
  accurate for color but estimative for spacing and line-heights. Final
  specs should be validated against the Figma source of truth.
- Several screens not covered by source screenshots (CRM detail, Ventas
  detail, settings, Presupuestos) are *not* included in the UI kit. They'd
  be fabrication rather than recreation — ask and I'll extend.

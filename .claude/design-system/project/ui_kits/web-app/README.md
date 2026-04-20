# Etendo Web App — UI Kit

Click-through recreation of the Etendo SaaS web app at ~1440px wide.

**Screens implemented (based on provided screenshots):**
- `Inicio` — dashboard with tasks, quick access, top clients, financial summary, recent sales, cobros y pagos
- `Contactos` — list view + empty state + Import flow (map → confirm → loader → success toast)
- `Facturas de venta` — table with filters; "Guardar filtro" toast swaps in a narrowed view with the Estado column
- `Facturas de compra` — empty state with video-tutorial helpstrip

**Components (reusable):**
- `Shell.jsx` — `AppShell`, `Topbar`, `IconRail`, `SideNav` (toggleable)
- `Primitives.jsx` — `Button`, `SplitButton`, `IconButton`, `Pill`, `Select`, `Toast`, `Modal`, `Card`, `CardHead`
- `Icons.jsx` — 30+ Lucide-ish line icons (1.75 stroke)

Sidebar toggle (top-left) switches between the 48px icon rail and the 240px expanded nav. Any section not backed by a source screenshot shows a "Próximamente" placeholder rather than fabricating UI.

Open `index.html` to interact.

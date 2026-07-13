import React from 'react';
// Menu icons must be EXACTLY the ones the real app sidebar uses. That menu
// (SideMenu.jsx) resolves each item's icon from @phosphor-icons/react via its
// ICON_MAP, so we pull the same phosphor icons here.
import {
  House,
  Star,
  IdentificationCard,
  TrendUp,
  Receipt,
  Package,
  Bank,
  Plug,
  Gear,
  Flask,
} from '@phosphor-icons/react';
// Non-menu / decorative chrome stays on lucide (same as the rest of the shell).
import {
  Headphones,
  ChevronDown,
  ChevronRight,
  Search,
  Calendar,
  SlidersHorizontal,
  PanelLeftClose,
} from 'lucide-react';

// Figma-exact skeleton tokens (see docs/... onboarding right-panel mockup).
const SKELETON_BG = 'bg-[#E8EAEF]';
const ICON_COLOR = 'text-[#828FA3]';

// Navigation rail menu groups: [heading skeleton width, items].
// Each item is [Icon, valueBarWidth, hasTrailingChevron].
// Icons/count/order mirror the real app menu (Inicio, Favoritos, Contactos,
// Ventas, Compras, Inventario, Finanzas, Conectar con Claude, Configuración,
// Prueba de Concepto). Labels stay skeletons so the preview is locale-agnostic.
const MENU_GROUPS = [
  {
    headingWidth: 44, // General
    items: [
      [House, 52, false], // Inicio
      [Star, 78, true],   // Favoritos
    ],
  },
  {
    headingWidth: 57, // Comercial
    items: [
      [IdentificationCard, 90, false], // Contactos
      [TrendUp, 62, true],             // Ventas
    ],
  },
  {
    headingWidth: 72, // Operaciones
    items: [
      [Receipt, 80, true],  // Compras
      [Package, 94, true],  // Inventario
    ],
  },
  {
    headingWidth: 51, // Finanzas
    items: [
      [Bank, 72, true], // Finanzas
    ],
  },
  {
    headingWidth: 50, // Sistema
    items: [
      [Plug, 130, false],  // Conectar con Claude
      [Gear, 100, true],   // Configuración
      [Flask, 120, true],  // Prueba de Concepto
    ],
  },
];

// Table body rows: header-ish row + one selected/checked row, both with
// per-column skeleton bar widths — then N empty checkbox-only rows.
const TABLE_ROW_1 = [35, 29, 73, 90, 90];
const TABLE_ROW_2 = [84, 54, 108, 130, 130];
const EMPTY_ROW_COUNT = 10;
const CELL_WIDTHS = [112, 96, 132, 200, 200];

function Bar({ width }) {
  // inline-block so height/width apply even when the wrapper isn't a flex box.
  return <span className={`inline-block h-3 rounded-full ${SKELETON_BG}`} style={{ width: `${width}px` }} />;
}

function RailMenuItem({ icon: Icon, width, hasChevron }) {
  return (
    <div className="flex h-8 items-center px-2">
      <span className={`flex w-7 flex-none items-center pl-1 ${ICON_COLOR}`}>
        <Icon size={20} weight="regular" />
      </span>
      <span className="min-w-0 flex-1 px-2">
        <Bar width={width} />
      </span>
      <span className={`flex w-7 flex-none items-center justify-center pr-1 ${ICON_COLOR}`}>
        {hasChevron && <ChevronDown className="h-[18px] w-[18px]" strokeWidth={1.7} />}
      </span>
    </div>
  );
}

// Static replica of the Core Checkbox (app-shell-core/components/ui/checkbox.jsx)
// so the preview's rows use the same box + check mark as the real app.
function Checkbox({ checked }) {
  return (
    <div
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-[1.5px] ${
        checked
          ? 'border-[#121217] bg-[#121217]'
          : 'border-[#D1D4DB] bg-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)]'
      }`}>
      {checked && (
        <svg width="8" height="6" viewBox="-0.5 -0.5 8 6" fill="none">
          <path d="M0.5 2.5 L2.5 4.5 L6.5 0.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function TableRow({ widths, tall, checked }) {
  return (
    <div className={`flex items-center border-b border-[#E8EAEF] ${tall ? 'h-[52px]' : 'h-10'}`}>
      <div className="flex w-8 flex-none justify-center pl-2">
        <Checkbox checked={checked} />
      </div>
      {widths.map((barWidth, i) => (
        <div key={i} className="flex flex-none items-center px-3" style={{ width: `${CELL_WIDTHS[i]}px` }}>
          <Bar width={barWidth} />
        </div>
      ))}
    </div>
  );
}

/**
 * Dynamic skeleton mockup of the app dashboard shown in the onboarding right
 * panel. Everything is a static skeleton except the USER row in the nav rail
 * footer, which reflects `userName` live as the person types their name.
 */
export function SetupPreviewMockup({ userName, orgName, variant = 'profile', ...props }) {
  // profile (step 1): live user in the footer, top fades.
  // company (step 2): live company in the org header (top), bottom fades — a mirror.
  const isCompany = variant === 'company';
  const trimmedName = (userName || '').trim();
  const displayName = trimmedName || 'Tu nombre';
  const initial = (trimmedName[0] || '?').toUpperCase();
  const trimmedOrg = (orgName || '').trim();

  return (
    <div className="relative h-screen w-full overflow-hidden" data-testid="SetupPreviewMockup__79cf84" {...props}>
      {/* Both gradient masks (Figma "Rectangle 10") are always mounted; their
          opacity cross-fades with the variant so the transition between steps
          feels like a continuous scroll rather than a hard swap.
          profile → top fade (focus is the footer/user at the bottom).
          company → bottom fade (focus is the org header at the top). */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[330px] transition-opacity duration-500 ease-in-out motion-reduce:transition-none"
        style={{
          opacity: isCompany ? 0 : 1,
          background:
            'linear-gradient(180deg, #f4f6fa 0%, #f4f6fa 34%, rgba(244,246,250,.65) 62%, rgba(244,246,250,0) 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[330px] transition-opacity duration-500 ease-in-out motion-reduce:transition-none"
        style={{
          opacity: isCompany ? 1 : 0,
          background:
            'linear-gradient(0deg, #f4f6fa 0%, #f4f6fa 34%, rgba(244,246,250,.65) 62%, rgba(244,246,250,0) 100%)',
        }}
      />

      {/* Unified card: nav rail + content, Figma-exact radius/shadow. Vertical
          anchoring depends on the variant (see the className below). */}
      <div
        className={
          'absolute left-10 flex w-[1000px] overflow-hidden rounded-[20px] border border-[#E4E7EC] bg-[#F5F7F9] transition-[top,bottom,box-shadow] duration-500 ease-in-out motion-reduce:transition-none xl:left-12 2xl:left-16 ' +
          (isCompany
            // company: header revealed at top (small top gap); content bleeds off
            // the bottom edge. Shadow cast UPWARD so it lands on the visible top edge.
            ? 'top-16 bottom-[-140px] shadow-[0px_-8px_20px_-4px_rgba(18,18,23,0.12),0px_-3px_8px_-2px_rgba(18,18,23,0.08)] xl:top-20 2xl:top-28'
            // profile: fills down to a bottom gap; top fades. Shadow cast downward.
            : 'top-0 bottom-16 shadow-[0px_10px_15px_-3px_rgba(18,18,23,0.08),0px_4px_6px_-2px_rgba(18,18,23,0.05)] xl:bottom-20 2xl:bottom-28')
        }>
        {/* Navigation Rail */}
        <aside className="flex w-[240px] flex-none flex-col bg-[#F6F7F9]">
          <div className="flex h-[63px] flex-none items-center gap-1.5 px-2">
            <div className="mx-2 flex h-full flex-1 items-center justify-between border-b border-[#E8EAEF] pl-1">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {/* Header always shows the org (favicon + name). Single-card model:
                    it's a skeleton until a company name is typed, then live. In the
                    profile framing it lives under the top fade, so it reads as part
                    of the same continuous dashboard being scrolled. */}
                <img src="/favicon.png" alt="" className="h-6 w-6 flex-none rounded-md object-contain" />
                {trimmedOrg
                  // Fixed max-width rather than flex-1 — otherwise the name grows to
                  // fill the header's free space and never truncates. 108px ≈ matches
                  // the real SideMenu's truncation point at its 240px rail width.
                  ? <span className="block max-w-[108px] truncate text-sm font-semibold text-[#121217]">{trimmedOrg}</span>
                  : <span className={`inline-block h-2.5 w-[90px] rounded-full ${SKELETON_BG}`} />}
              </div>
              <span className={ICON_COLOR}>
                <ChevronDown className="h-5 w-5" strokeWidth={1.7} />
              </span>
            </div>
            <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-md ${ICON_COLOR}`}>
              <PanelLeftClose className="h-5 w-5" strokeWidth={1.7} />
            </span>
          </div>

          <nav className="flex flex-1 flex-col gap-3 overflow-hidden py-2 pl-2">
            {MENU_GROUPS.map((group, gi) => (
              <div key={gi} className="flex flex-col gap-1">
                <div className="flex h-8 items-center px-4">
                  <Bar width={group.headingWidth} />
                </div>
                {group.items.map(([Icon, width, hasChevron], ii) => (
                  <RailMenuItem key={ii} icon={Icon} width={width} hasChevron={hasChevron} />
                ))}
              </div>
            ))}
          </nav>

          <div className="flex-none p-2">
            <div className="flex flex-col gap-1 border-t border-[#E8EAEF] pt-2">
              <div className="flex h-8 items-center px-2">
                <span className={`flex w-7 flex-none items-center pl-1 ${ICON_COLOR}`}>
                  <Headphones className="h-[18px] w-[18px]" strokeWidth={1.7} />
                </span>
                <span className="min-w-0 flex-1 px-2">
                  <Bar width={105} />
                </span>
                <span className="w-7 flex-none" />
              </div>
              <div className="flex h-8 items-center px-2">
                {/* Footer always shows the user (avatar initial + name, live from
                    step 1). In the company framing it sits below the fold. */}
                <span
                  className={`ml-1 flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-bold text-[#121217] ${SKELETON_BG}`}>
                  {initial}
                </span>
                <span className="flex-1 truncate px-2 text-sm leading-6 text-[#121217]">{displayName}</span>
                <span className={`flex w-7 flex-none items-center justify-center pr-1 ${ICON_COLOR}`}>
                  <ChevronRight className="h-[18px] w-[18px]" strokeWidth={1.7} />
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[62px] flex-none items-center gap-3.5 px-2">
            <div className="flex flex-col gap-1.5">
              <span className={`inline-block h-3.5 w-20 rounded-full ${SKELETON_BG}`} />
              <span className={`inline-block h-2.5 w-12 rounded-full ${SKELETON_BG}`} />
            </div>
            <div className="flex h-10 w-[392px] items-center gap-2 rounded-full bg-white px-3">
              <span className={`flex-none ${ICON_COLOR}`}>
                <Search className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </span>
              <span className={`inline-block h-3 w-44 rounded-full ${SKELETON_BG}`} />
            </div>
          </div>
          <div className="flex-1 pb-2 pr-2">
            <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white">
              <div className="flex flex-none items-center gap-2 px-2 pb-2 pt-4">
                <div className="flex h-10 flex-none items-center gap-1.5 rounded-lg border border-[#D1D4DB] bg-white px-3 shadow-[0px_1px_2px_rgba(18,18,23,0.05)]">
                  <Bar width={122} />
                  <ChevronDown className={`h-[18px] w-[18px] ${ICON_COLOR}`} strokeWidth={1.7} />
                </div>
                <div className={`flex h-10 flex-none items-center gap-1.5 rounded-lg border border-[#D1D4DB] bg-white px-3 shadow-[0px_1px_2px_rgba(18,18,23,0.05)] ${ICON_COLOR}`}>
                  <Calendar className="h-5 w-5" strokeWidth={1.7} />
                  <Bar width={122} />
                  <ChevronDown className="h-[18px] w-[18px]" strokeWidth={1.7} />
                </div>
                <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-[#D1D4DB] bg-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] ${ICON_COLOR}`}>
                  <SlidersHorizontal className="h-5 w-5" strokeWidth={1.7} />
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <TableRow widths={TABLE_ROW_1} tall={false} checked={false} />
                <TableRow widths={TABLE_ROW_2} tall checked />
                {Array.from({ length: EMPTY_ROW_COUNT }).map((_, i) => (
                  <div key={i} className="flex h-[52px] items-center border-b border-[#E8EAEF]">
                    <div className="flex w-8 flex-none justify-center pl-2">
                      <Checkbox checked={false} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SetupPreviewMockup;

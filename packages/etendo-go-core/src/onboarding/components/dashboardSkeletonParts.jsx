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
import { ChevronDown } from 'lucide-react';

// Figma-exact skeleton tokens (see docs/... onboarding right-panel mockup).
export const SKELETON_BG = 'bg-[#E8EAEF]';
export const ICON_COLOR = 'text-[#828FA3]';

// Navigation rail menu groups: [heading skeleton width, items].
// Each item is [Icon, valueBarWidth, hasTrailingChevron].
// Icons/count/order mirror the real app menu (Inicio, Favoritos, Contactos,
// Ventas, Compras, Inventario, Finanzas, Conectar con Claude, Configuración,
// Prueba de Concepto). Labels stay skeletons so the preview is locale-agnostic.
export const MENU_GROUPS = [
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
export const TABLE_ROW_1 = [35, 29, 73, 90, 90];
export const TABLE_ROW_2 = [84, 54, 108, 130, 130];
export const EMPTY_ROW_COUNT = 10;
export const CELL_WIDTHS = [112, 96, 132, 200, 200];

export function Bar({ width }) {
  // inline-block so height/width apply even when the wrapper isn't a flex box.
  return <span className={`inline-block h-3 rounded-full ${SKELETON_BG}`} style={{ width: `${width}px` }} />;
}

export function RailMenuItem({ icon: Icon, width, hasChevron }) {
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
export function Checkbox({ checked }) {
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

export function TableRow({ widths, tall, checked }) {
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

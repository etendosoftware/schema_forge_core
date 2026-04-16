import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KPIHeader, KPICard } from '@/components/contract-ui/KPIHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import LocaleSwitcher from '@/components/LocaleSwitcher.jsx';
import { UserAvatarButton } from '@/components/UserAvatarButton.jsx';
import {
  DollarSign,
  CreditCard,
  TrendingUp,
  FileText,
  ShoppingCart,
  Users,
  Box,
  Truck,
  ShoppingBag,
  FileInput,
  AlertTriangle,
  Info,
  ChevronRight,
  ChevronUp,
  Clock,
  Search,
  Sparkles,
  Plus,
  Bell,
  Mic,
  LayoutGrid,
  LineChart,
  BarChart2,
  GripVertical,
} from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useCopilot } from '@/components/CopilotContext';
import { useUI } from '@/i18n';
import { useMenuLabel, useLocaleSwitch } from '@/i18n';
import { useAuth } from '@/auth/AuthContext.jsx';
import { formatAmount } from '@/lib/formatAmount';
import { createDashboardNavigation, resolveDashboardNavigation } from '@/lib/dashboardNavigation.js';

/* ------------------------------------------------------------------
 * Icon lookup
 * ----------------------------------------------------------------*/

const ICON_MAP = { DollarSign, CreditCard, TrendingUp, Clock, FileText, ShoppingCart, Users, Box, Truck, ShoppingBag, FileInput };

/* ------------------------------------------------------------------
 * Widget Registry
 * ----------------------------------------------------------------*/

const WIDGET_REGISTRY = [
  // Row 1: 3 KPI cards + Quick Actions (1 col each → fills all 4 cols)
  { id: 'kpi-revenue',          labelKey: 'revenueThisMonth',      defaultSize: 'small',  defaultVisible: true  },
  { id: 'kpi-expenses',         labelKey: 'expensesThisMonth',     defaultSize: 'small',  defaultVisible: true  },
  { id: 'kpi-profit',           labelKey: 'netProfit',             defaultSize: 'small',  defaultVisible: true  },
  { id: 'quick-actions',        labelKey: 'quickActions',          defaultSize: 'small',  defaultVisible: true  },
  // Row 2: Revenue chart (2 cols) + Pending Tasks (1) + Top Clients (1)
  { id: 'revenue-chart',        labelKey: 'revenueVsExpenses',     defaultSize: 'medium', defaultVisible: true  },
  { id: 'pending-tasks',        labelKey: 'pendingTasks',          defaultSize: 'small',  defaultVisible: true  },
  { id: 'top-clients',          labelKey: 'topClients',            defaultSize: 'small',  defaultVisible: true  },
  { id: 'collections-payments', labelKey: 'collectionsPayments',   defaultSize: 'small',  defaultVisible: true  },
  { id: 'recent-invoices',      labelKey: 'recentInvoices',        defaultSize: 'medium', defaultVisible: true  },
  { id: 'best-sellers',         labelKey: 'bestSellers',           defaultSize: 'medium', defaultVisible: true  },
];

const DEFAULT_WIDGET_CONFIG = [
  { id: 'kpi-revenue', visible: true, size: 'small' },
  { id: 'kpi-expenses', visible: true, size: 'small' },
  { id: 'kpi-profit', visible: true, size: 'small' },
  { id: 'quick-actions', visible: true, size: 'small' },
  { id: 'revenue-chart', visible: true, size: 'medium' },
  { id: 'pending-tasks', visible: true, size: 'small' },
  { id: 'top-clients', visible: true, size: 'small' },
  { id: 'collections-payments', visible: true, size: 'medium', height: 240 },
  { id: 'recent-invoices', visible: true, size: 'medium', height: 240 },
  { id: 'best-sellers', visible: true, size: 'medium', height: 240 },
];

function getWidgetMeta(id) {
  return WIDGET_REGISTRY.find((w) => w.id === id);
}

function resolvePendingTaskKey(task) {
  const text = String(task?.text ?? '').toLowerCase();
  const windowName = task?.navigation?.window;
  const filter = task?.navigation?.filter;
  const docStatus = task?.navigation?.params?.DocStatus;

  if (task?.taskKey) return task.taskKey;
  if ((windowName === 'sales-invoice' && filter === 'overdue') || task?.link === '/sales-invoice' || text.includes('overdue invoices')) {
    return task?.count === 1 ? 'overdueInvoices' : 'overdueInvoices_plural';
  }
  if ((windowName === 'goods-shipment' && docStatus === 'DR') || task?.link === '/goods-shipment' || text.includes('pending shipment')) {
    return task?.count === 1 ? 'pendingShipments' : 'pendingShipments_plural';
  }
  if ((windowName === 'purchase-order' && docStatus === 'DR') || task?.link === '/purchase-order' || text.includes('purchase orders to confirm')) {
    return task?.count === 1 ? 'purchaseOrdersToConfirm' : 'purchaseOrdersToConfirm_plural';
  }
  if (task?.link === '/physical-inventory' || text.includes('low stock alert')) {
    return task?.count === 1 ? 'lowStockAlert' : 'lowStockAlerts';
  }
  return null;
}

function resolveQuickActionLabel(ui, tMenu, action) {
  switch (action?.to) {
    case '/sales-invoice': return `+ ${ui('quickActionSalesInvoice')}`;
    case '/sales-order': return `+ ${ui('quickActionSalesOrder')}`;
    case '/contacts': return `+ ${tMenu('Contact')}`;
    case '/product': return `+ ${tMenu('Product')}`;
    default: return action?.label ?? '';
  }
}

function resolveQuickActionRoute(route) {
  switch (route) {
    case '/sales-invoice':
    case '/sales-order':
    case '/contacts':
      return `${route}/new`;
    default:
      return route;
  }
}

function resolveDashboardTarget({ navigation, link, fallback = '/dashboard' }) {
  return resolveDashboardNavigation(navigation) || link || fallback;
}

function useDashboardCurrency(token, selectedOrg, apiBaseUrl = '') {
  const [currencyLabel, setCurrencyLabel] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadCurrency() {
      if (!token) {
        setCurrencyLabel('');
        return;
      }
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const base = apiBaseUrl || '/sws/neo';
        const endpoints = [
          `${base}/sales-invoice/header/defaults`,
          `${base}/sales-order/header/defaults`,
          `${base}/purchase-invoice/header/defaults`,
        ];

        for (const endpoint of endpoints) {
          const res = await fetch(endpoint, { headers });
          if (!res.ok) continue;
          const data = await res.json();
          const defaults = data?.defaults ?? {};
          const value = defaults['currency$_identifier']
            ?? defaults.currency$_identifier
            ?? defaults.currencyIdentifier
            ?? defaults.currency
            ?? defaults.C_Currency_ID$_identifier;
          if (value) {
            if (!cancelled) setCurrencyLabel(String(value));
            return;
          }
        }
      } catch {
        // Best effort only.
      }
      if (!cancelled) setCurrencyLabel('');
    }

    loadCurrency();
    return () => {
      cancelled = true;
    };
  }, [token, selectedOrg?.id, apiBaseUrl]);

  return currencyLabel;
}

function formatDashboardAmount(value, currencyLabel) {
  return formatAmount(value, currencyLabel);
}

function formatDashboardCompact(value, currencyLabel) {
  const num = Number(value) || 0;
  if (!currencyLabel) return num.toLocaleString('en-US');
  if (Math.abs(num) >= 1_000_000) return `${formatAmount(num / 1_000_000, currencyLabel)}M`;
  if (Math.abs(num) >= 1_000) return `${formatAmount(num / 1_000, currencyLabel)}K`;
  return formatAmount(num, currencyLabel);
}

function formatAxisTick(value, locale = 'en-US') {
  const num = Number(value) || 0;
  const abs = Math.abs(num);

  const formatPlain = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const formatCompact = (divisor, suffix) => {
    const compact = num / divisor;
    const hasFraction = Math.abs(compact) < 100 && Math.abs(compact % 1) >= 0.05;
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: hasFraction ? 1 : 0,
    });
    return `${formatter.format(compact)}${suffix}`;
  };

  if (abs >= 1_000_000_000) return formatCompact(1_000_000_000, 'B');
  if (abs >= 1_000_000) return formatCompact(1_000_000, 'M');
  if (abs >= 1_000) return formatCompact(1_000, 'K');
  return formatPlain.format(num);
}

/* ------------------------------------------------------------------
 * Widget config hook (localStorage persistence)
 * ----------------------------------------------------------------*/

function useWidgetConfig() {
  const [config, setConfig] = useState(() => DEFAULT_WIDGET_CONFIG);

  useEffect(() => {
    localStorage.removeItem('dashboard_widget_config');
  }, []);

  const update = (newConfig) => {
    setConfig(newConfig);
  };

  const toggle = (id) => {
    update(config.map((c) => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const moveUp = (id) => {
    const idx = config.findIndex((c) => c.id === id);
    if (idx <= 0) return;
    const next = [...config];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    update(next);
  };

  const moveDown = (id) => {
    const idx = config.findIndex((c) => c.id === id);
    if (idx >= config.length - 1) return;
    const next = [...config];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    update(next);
  };

  const reorder = (fromId, toId) => {
    if (fromId === toId) return;
    const fromIdx = config.findIndex((c) => c.id === fromId);
    const toIdx   = config.findIndex((c) => c.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...config];
    const [removed] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, removed);
    update(next);
  };

  /**
   * Swap two widgets: exchange their positions AND their sizes.
   * e.g. Revenue (wide, pos 0) swapped with Pending Tasks (side, pos 2):
   *   → pos 0: Pending Tasks widget with size 'wide'
   *   → pos 2: Revenue widget with size 'side'
   */
  const swap = (idA, idB) => {
    if (idA === idB) return;
    const idxA = config.findIndex((c) => c.id === idA);
    const idxB = config.findIndex((c) => c.id === idB);
    if (idxA === -1 || idxB === -1) return;
    const next = [...config];
    const a = { ...next[idxA] };
    const b = { ...next[idxB] };
    next[idxA] = { ...b, size: a.size };
    next[idxB] = { ...a, size: b.size };
    update(next);
  };

  const reset = () => {
    const defaults = DEFAULT_WIDGET_CONFIG;
    update(defaults);
  };

  const reorderToIndex = (fromId, targetIndex) => {
    const fromIdx = config.findIndex((c) => c.id === fromId);
    if (fromIdx === -1) return;
    const next = [...config];
    const [removed] = next.splice(fromIdx, 1);
    const adjusted = fromIdx < targetIndex ? targetIndex - 1 : targetIndex;
    next.splice(Math.max(0, Math.min(adjusted, next.length)), 0, removed);
    update(next);
  };

  return { config, toggle, moveUp, moveDown, reorder, reorderToIndex, swap, reset };
}

/* ------------------------------------------------------------------
 * Widget Preview Thumbnails (mini SVG representations)
 * ----------------------------------------------------------------*/

const WIDGET_PREVIEWS = {
  'kpi-revenue': (
    <svg viewBox="0 0 280 100" className="w-full h-full">
      <rect width="280" height="100" fill="#f8fafc" />
      <rect x="14" y="16" width="90" height="8" rx="4" fill="#cbd5e1" />
      <rect x="14" y="32" width="130" height="18" rx="5" fill="#1e293b" opacity="0.8" />
      <rect x="226" y="12" width="40" height="40" rx="8" fill="#dcfce7" />
      <circle cx="246" cy="32" r="8" fill="#16a34a" opacity="0.7" />
      <rect x="14" y="58" width="20" height="8" rx="4" fill="#ef4444" opacity="0.7" />
      <rect x="38" y="58" width="60" height="8" rx="4" fill="#ef4444" opacity="0.4" />
      <rect x="14" y="72" width="110" height="7" rx="3.5" fill="#e2e8f0" />
    </svg>
  ),
  'kpi-expenses': (
    <svg viewBox="0 0 280 100" className="w-full h-full">
      <rect width="280" height="100" fill="#f8fafc" />
      <rect x="14" y="16" width="100" height="8" rx="4" fill="#cbd5e1" />
      <rect x="14" y="32" width="60" height="18" rx="5" fill="#1e293b" opacity="0.8" />
      <rect x="226" y="12" width="40" height="40" rx="8" fill="#fee2e2" />
      <rect x="233" y="28" width="26" height="12" rx="3" fill="#ef4444" opacity="0.7" />
      <rect x="14" y="58" width="20" height="8" rx="4" fill="#94a3b8" opacity="0.5" />
      <rect x="38" y="58" width="50" height="8" rx="4" fill="#e2e8f0" />
    </svg>
  ),
  'kpi-profit': (
    <svg viewBox="0 0 280 100" className="w-full h-full">
      <rect width="280" height="100" fill="#f8fafc" />
      <rect x="14" y="16" width="72" height="8" rx="4" fill="#cbd5e1" />
      <rect x="14" y="32" width="130" height="18" rx="5" fill="#1e293b" opacity="0.8" />
      <rect x="226" y="12" width="40" height="40" rx="8" fill="#dbeafe" />
      <polyline points="233,36 240,28 248,32 256,22" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="14" y="58" width="20" height="8" rx="4" fill="#ef4444" opacity="0.7" />
      <rect x="38" y="58" width="60" height="8" rx="4" fill="#ef4444" opacity="0.4" />
      <rect x="14" y="72" width="110" height="7" rx="3.5" fill="#e2e8f0" />
    </svg>
  ),
  'kpi-pending': (
    <svg viewBox="0 0 280 100" className="w-full h-full">
      <rect width="280" height="100" fill="#f8fafc" />
      <rect x="14" y="16" width="100" height="8" rx="4" fill="#cbd5e1" />
      <rect x="14" y="32" width="50" height="18" rx="5" fill="#1e293b" opacity="0.8" />
      <rect x="226" y="12" width="40" height="40" rx="8" fill="#fef3c7" />
      <circle cx="246" cy="32" r="9" fill="none" stroke="#d97706" strokeWidth="2.5" />
      <line x1="246" y1="26" x2="246" y2="32" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
      <circle cx="246" cy="36" r="1.5" fill="#d97706" />
    </svg>
  ),
  'revenue-chart': (ui) => (
    <svg viewBox="0 0 280 100" className="w-full h-full">
      <rect width="280" height="100" rx="0" fill="#f8fafc" />
      {[0,1,2,3].map((i) => (
        <line key={i} x1="30" y1={15 + i * 20} x2="270" y2={15 + i * 20} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 3" />
      ))}
      {[0,20,40,60,80,90,70,60,80,85,75,90].map((v, i) => (
        <text key={i} x={30 + i * 20} y="96" textAnchor="middle" fontSize="7" fill="#94a3b8">{['A','M','J','J','A','S','O','N','D','J','F','M'][i]}</text>
      ))}
      <polyline points="30,75 50,65 70,70 90,55 110,60 130,45 150,50 170,60 190,48 210,42 230,50 250,35" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" />
      <path d="M30,75 50,65 70,70 90,55 110,60 130,45 150,50 170,60 190,48 210,42 230,50 250,35 L250,88 L30,88 Z" fill="#4f46e5" opacity="0.08" />
      <polyline points="30,80 50,80 70,80 90,78 110,77 130,76 150,74 170,72 190,68 210,65 230,62 250,58" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />
    </svg>
  ),
  'top-clients': (
    <svg viewBox="0 0 280 100" className="w-full h-full">
      <rect width="280" height="100" rx="0" fill="#f8fafc" />
      {[['Empresa ABC', 0.85], ['Grupo XYZ', 0.65], ['Dist. Norte', 0.5], ['Rest. Luna', 0.35]].map(([name, pct], i) => (
        <g key={i} transform={`translate(10, ${12 + i * 22})`}>
          <text x="0" y="10" fontSize="8" fill="#64748b">{i + 1}</text>
          <text x="14" y="10" fontSize="8" fill="#334155">{name}</text>
          <rect x="100" y="3" width={160 * pct} height="8" rx="4" fill="#4f46e5" opacity={0.5 + pct * 0.4} />
        </g>
      ))}
    </svg>
  ),
  'pending-tasks': (ui, tMenu) => (
    <svg viewBox="0 0 280 100" className="w-full h-full">
      <rect width="280" height="100" rx="0" fill="#f8fafc" />
      {[['#f59e0b', ui('overdueInvoices_plural', { count: 3 })], ['#3b82f6', ui('pendingShipments_plural', { count: 2 })], ['#3b82f6', ui('purchaseOrdersToConfirm_plural', { count: 5 })], ['#f59e0b', ui('lowStockAlert', { count: 1 })]].map(([color, text], i) => (
        <g key={i} transform={`translate(12, ${10 + i * 22})`}>
          <circle cx="6" cy="7" r="5" fill={color} opacity="0.8" />
          <rect x="18" y="3" width="110" height="7" rx="3.5" fill="#cbd5e1" />
          <text x="20" y="9" fontSize="7" fill="#475569">{text}</text>
          <rect x="238" y="3" width="22" height="7" rx="3.5" fill={color} opacity="0.3" />
        </g>
      ))}
    </svg>
  ),
  'quick-actions': (ui, tMenu) => (
    <svg viewBox="0 0 280 100" className="w-full h-full">
      <rect width="280" height="100" rx="0" fill="#f8fafc" />
      {[`+ ${ui('quickActionSalesInvoice')}`, `+ ${ui('quickActionSalesOrder')}`, `+ ${tMenu('Contact')}`, `+ ${tMenu('Product')}`].map((label, i) => (
        <g key={i} transform={`translate(${10 + (i % 2) * 135}, ${10 + Math.floor(i / 2) * 44})`}>
          <rect width="120" height="34" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
          <rect x="12" y="10" width="14" height="14" rx="3" fill="#e0e7ff" />
          <rect x="32" y="13" width="50" height="8" rx="4" fill="#cbd5e1" />
          <text x="32" y="28" fontSize="7" fill="#64748b">{label}</text>
        </g>
      ))}
    </svg>
  ),
  'collections-payments': (
    <svg viewBox="0 0 280 100" className="w-full h-full">
      <rect width="280" height="100" rx="0" fill="#f8fafc" />
      <rect x="10" y="15" width="120" height="70" rx="8" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
      <rect x="150" y="15" width="120" height="70" rx="8" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
      <rect x="22" y="28" width="60" height="8" rx="4" fill="#cbd5e1" />
      <rect x="22" y="44" width="80" height="16" rx="4" fill="#22c55e" opacity="0.5" />
      <rect x="22" y="66" width="50" height="7" rx="3.5" fill="#e2e8f0" />
      <rect x="162" y="28" width="60" height="8" rx="4" fill="#cbd5e1" />
      <rect x="162" y="44" width="80" height="16" rx="4" fill="#ef4444" opacity="0.4" />
      <rect x="162" y="66" width="50" height="7" rx="3.5" fill="#e2e8f0" />
    </svg>
  ),
  'recent-invoices': (
    <svg viewBox="0 0 280 100" className="w-full h-full">
      <rect width="280" height="100" rx="0" fill="#f8fafc" />
      <rect x="10" y="8" width="260" height="12" rx="3" fill="#e2e8f0" />
      {[0,1,2,3].map((i) => (
        <g key={i} transform={`translate(10, ${26 + i * 18})`}>
          <rect width="100" height="8" rx="4" fill="#cbd5e1" />
          <rect x="110" y="0" width="50" height="8" rx="4" fill="#e2e8f0" />
          <rect x="170" y="0" width="40" height="8" rx="4" fill="#4f46e5" opacity={i === 1 || i === 3 ? 0.3 : 0.7} />
          <rect x="220" y="0" width="30" height="8" rx="4" fill={i === 1 || i === 3 ? '#fef9c3' : '#dcfce7'} />
        </g>
      ))}
    </svg>
  ),
  'best-sellers': (
    <svg viewBox="0 0 280 100" className="w-full h-full">
      <rect width="280" height="100" rx="0" fill="#f8fafc" />
      <rect x="180" y="8" width="36" height="12" rx="6" fill="#e0e7ff" />
      <rect x="220" y="8" width="50" height="12" rx="6" fill="#eef2ff" />
      {[0,1,2,3,4].map((i) => (
        <g key={i} transform={`translate(10, ${26 + i * 14})`}>
          <rect width="150" height="8" rx="4" fill="#cbd5e1" opacity={1 - i * 0.12} />
          <rect x="190" y="0" width="28" height="8" rx="4" fill="#4f46e5" opacity={0.8 - i * 0.12} />
          <rect x="226" y="0" width="40" height="8" rx="4" fill="#94a3b8" opacity={0.65 - i * 0.08} />
        </g>
      ))}
    </svg>
  ),
};

/* ------------------------------------------------------------------
 * Widget Catalog (replaces WidgetManagerSheet)
 * ----------------------------------------------------------------*/

// Column span map — full class strings required for Tailwind purging
const SIZE_COLS = { large: 4, wide: 3, medium: 2, small: 1 };
const COL_SPAN_CLASS = { 1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4' };
const SIZE_CYCLE = { small: 'medium', medium: 'wide', wide: 'large', large: 'small' };

// Discrete height rows — widget height snaps to multiples of ROW_STEP
const ROW_STEP = 80;  // px per row unit
const MIN_ROWS = 2;   // 160px minimum
const MAX_ROWS = 8;   // 640px maximum
const snapToRows = (px) =>
  Math.max(MIN_ROWS, Math.min(MAX_ROWS, Math.round(px / ROW_STEP))) * ROW_STEP;

// Widgets that default to 4 rows instead of 2
const TALL_DEFAULT = new Set(['pending-tasks', 'top-clients']);

function WidgetManagerSheet({ open, onClose, config, toggle, reorder, onReset, ui }) {
  const tMenu = useMenuLabel();
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const handleDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Needed for Firefox
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== draggingId) setDragOverId(id);
  };

  const handleDrop = (e, toId) => {
    e.preventDefault();
    if (draggingId && draggingId !== toId) reorder(draggingId, toId);
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[560px] sm:max-w-[560px] flex flex-col p-0 overflow-hidden">
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle>{ui('customizeDashboard')}</SheetTitle>
          <p className="text-xs text-muted-foreground">{ui('dragCardsToReorder')}</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            {config.map((item) => {
              const meta = getWidgetMeta(item.id);
              if (!meta) return null;
              const preview = WIDGET_PREVIEWS[item.id];
              const renderedPreview = typeof preview === 'function' ? preview(ui, tMenu) : preview;
              const isDragging = draggingId === item.id;
              const isOver = dragOverId === item.id;

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onDragOver={(e) => handleDragOver(e, item.id)}
                  onDrop={(e) => handleDrop(e, item.id)}
                  onDragEnd={handleDragEnd}
                  className={`rounded-xl border overflow-hidden transition-all select-none
                    ${item.visible ? 'border-primary/40 shadow-sm' : 'border-border'}
                    ${isDragging ? 'opacity-40 scale-95' : 'opacity-100 scale-100'}
                    ${isOver && !isDragging ? 'ring-2 ring-primary ring-offset-1' : ''}
                    cursor-grab active:cursor-grabbing`}
                >
                  {/* Drag handle bar */}
                  <div className="h-6 bg-slate-50 border-b flex items-center justify-center">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </div>

                  {/* Preview */}
                  <div className="h-[84px] bg-slate-50 overflow-hidden flex items-center justify-center">
                    {renderedPreview || <div className="w-full h-full bg-muted" />}
                  </div>

                  {/* Card footer */}
                  <div className="p-2.5 bg-white space-y-2">
                    {/* Name + toggle */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium leading-tight truncate">{ui(meta.labelKey)}</span>
                      <Switch
                        checked={item.visible}
                        onCheckedChange={() => toggle(item.id)}
                        id={`widget-toggle-${item.id}`}
                        className="shrink-0 scale-90"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-3 border-t shrink-0 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{ui('changesSavedAutomatically')}</p>
          <button
            onClick={onReset}
            className="text-xs text-destructive hover:text-destructive/80 font-medium transition-colors shrink-0"
          >
            {ui('resetToDefaults')}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------
 * SVG Revenue Chart
 * ----------------------------------------------------------------*/

const CHART_W = 600;
const CHART_H = 220;
const PAD_X = 40;
const PAD_Y = 20;
const PAD_BOTTOM = 30;
const BAR_PAD_X = 20;
const BAR_PAD_Y = 10;
const BAR_PAD_BOTTOM = 28;

const WIDGET_HEADER_CLASS = 'pt-4 pb-2 flex-none';
const WIDGET_TITLE_CLASS = 'text-xs font-medium text-muted-foreground';

function RevenueChart({ labels = [], values = [], expenseValues = [], currencyLabel = '' }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const { locale } = useLocaleSwitch();
  const [chartType, setChartType] = useState(() => localStorage.getItem('dashboard_chart_type') || 'line');
  const [tooltip, setTooltip] = useState(null);

  // Generate locale-aware month abbreviations for the same window as the incoming labels
  const bcp47 = locale === 'es_ES' ? 'es-ES' : 'en-US';
  const fmt = new Intl.DateTimeFormat(bcp47, { month: 'short' });
  const localizedLabels = labels.map((_, i) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - (labels.length - 1 - i), 1);
    const s = fmt.format(d);
    return s.charAt(0).toUpperCase() + s.slice(1).replace('.', '');
  });

  const switchChartType = (type) => {
    setChartType(type);
    localStorage.setItem('dashboard_chart_type', type);
  };

  const normalizedExpenseValues = values.map((_, idx) => {
    const n = Number(expenseValues?.[idx] ?? 0);
    return Number.isFinite(n) ? n : 0;
  });
  const hasExpenses = normalizedExpenseValues.some((v) => Math.abs(v) > 0);

  const fmtTooltip = (n) => formatDashboardAmount(n, currencyLabel);

  const showTooltip = (x, y, i) =>
    setTooltip({ x, y, label: localizedLabels[i], revenue: values[i], expense: hasExpenses ? normalizedExpenseValues[i] : null });
  const allValues = hasExpenses ? [...values, ...normalizedExpenseValues] : values;
  const maxVal = Math.max(...allValues, 0);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  const plotW = CHART_W - PAD_X * 2;
  const plotH = CHART_H - PAD_Y - PAD_BOTTOM;

  const toPoint = (v, i, len) => ({
    x: PAD_X + (i / (len - 1)) * plotW,
    y: PAD_Y + plotH - ((v - minVal) / range) * plotH,
  });

  const revPoints = values.map((v, i) => toPoint(v, i, values.length));
  const expPoints = hasExpenses ? normalizedExpenseValues.map((v, i) => toPoint(v, i, normalizedExpenseValues.length)) : [];

  const toPolyline = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');
  const toFillPath = (pts) => {
    if (pts.length === 0) return '';
    return [
      `M ${pts[0].x},${pts[0].y}`,
      ...pts.slice(1).map((p) => `L ${p.x},${p.y}`),
      `L ${pts[pts.length - 1].x},${PAD_Y + plotH}`,
      `L ${pts[0].x},${PAD_Y + plotH}`,
      'Z',
    ].join(' ');
  };

  // Bar chart metrics — uses PAD_X for the left offset so bars align with the Y-axis labels
  const barPlotW = CHART_W - PAD_X - BAR_PAD_X;
  const barPlotH = CHART_H - BAR_PAD_Y - BAR_PAD_BOTTOM;
  const barAllValues = hasExpenses ? [...values, ...normalizedExpenseValues] : values;
  const barMaxVal = Math.max(...barAllValues, 1);
  const barSlotW = barPlotW / (values.length || 1);
  const barGroupW = barSlotW * 0.72;
  const barInnerGap = hasExpenses ? Math.min(6, barGroupW * 0.14) : 0;
  const barW = hasExpenses ? Math.max((barGroupW - barInnerGap) / 2, 2) : barGroupW;
  const lastIdx = values.length - 1;

  return (
    <Card>
      <CardHeader className={WIDGET_HEADER_CLASS}>
        <div className="flex items-center justify-between">
          <CardTitle className={WIDGET_TITLE_CLASS}>
            {ui('revenueVsExpenses12m')}
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasExpenses && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  {tMenu('Revenue')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-destructive" />
                  {tMenu('Expenses')}
                </span>
              </div>
            )}
            <div className="flex items-center border rounded-md overflow-hidden">
              <button
                onClick={() => switchChartType('line')}
                className={`p-1 transition-colors ${chartType === 'line' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                title="Line chart"
              >
                <LineChart className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => switchChartType('bar')}
                className={`p-1 transition-colors ${chartType === 'bar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                title="Bar chart"
              >
                <BarChart2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {chartType === 'line' ? (
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              className="w-full h-auto"
              role="img"
              aria-label={ui('invoiceTrendLabel')}
            >
              <defs>
                <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="expense-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const y = PAD_Y + plotH - frac * plotH;
                const val = minVal + frac * range;
                return (
                  <g key={frac}>
                    <line x1={PAD_X} y1={y} x2={CHART_W - PAD_X} y2={y} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />
                    <text x={PAD_X - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize="9">
                      {formatAxisTick(val, bcp47)}
                    </text>
                  </g>
                );
              })}

              {hasExpenses && (
                <>
                  <path d={toFillPath(expPoints)} fill="url(#expense-gradient)" />
                  <polyline points={toPolyline(expPoints)} fill="none" stroke="hsl(var(--destructive))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3" />
                  {expPoints.map((p, i) => (
                    <g key={i} onMouseEnter={() => showTooltip(p.x, p.y, i)} onMouseLeave={() => setTooltip(null)} style={{ cursor: 'crosshair' }}>
                      <circle cx={p.x} cy={p.y} r="10" fill="transparent" />
                      <circle cx={p.x} cy={p.y} r="2.5" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="1.5" />
                    </g>
                  ))}
                </>
              )}

              <path d={toFillPath(revPoints)} fill="url(#chart-gradient)" />
              <polyline points={toPolyline(revPoints)} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {revPoints.map((p, i) => (
                <g key={i} onMouseEnter={() => showTooltip(p.x, p.y, i)} onMouseLeave={() => setTooltip(null)} style={{ cursor: 'crosshair' }}>
                  <circle cx={p.x} cy={p.y} r="10" fill="transparent" />
                  <circle cx={p.x} cy={p.y} r="3" fill="hsl(var(--background))" stroke="#10b981" strokeWidth="2" />
                </g>
              ))}

              {localizedLabels.map((m, i) => {
                const x = PAD_X + (i / (localizedLabels.length - 1)) * plotW;
                return (
                  <text key={i} x={x} y={CHART_H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
                    {m}
                  </text>
                );
              })}

              {tooltip && (() => {
                const boxW = 145;
                const lineH = 15;
                const numLines = hasExpenses ? 3 : 2;
                const boxH = 10 + numLines * lineH + 2;
                const tipX = Math.min(Math.max(tooltip.x - boxW / 2, PAD_X), CHART_W - PAD_X - boxW);
                const tipY = Math.max(tooltip.y - boxH - 10, PAD_Y);
                return (
                  <g pointerEvents="none">
                    <rect x={tipX} y={tipY} width={boxW} height={boxH} rx="4" ry="4" fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth="1" />
                    <text x={tipX + boxW / 2} y={tipY + 12} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">{tooltip.label}</text>
                    <text x={tipX + boxW / 2} y={tipY + 12 + lineH} textAnchor="middle" fontSize="10" fontWeight="600" fill="#10b981">{`${tMenu('Revenue')}: ${fmtTooltip(tooltip.revenue)}`}</text>
                    {hasExpenses && (
                      <text x={tipX + boxW / 2} y={tipY + 12 + lineH * 2} textAnchor="middle" fontSize="10" fontWeight="600" fill="hsl(var(--destructive))">{`${tMenu('Expenses')}: ${fmtTooltip(tooltip.expense)}`}</text>
                    )}
                  </g>
                );
              })()}
            </svg>
          ) : (
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-auto" role="img" aria-label={ui('barChartAria')}>
              {/* Y-axis grid lines (same as line chart) */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const y = BAR_PAD_Y + barPlotH - frac * barPlotH;
                const val = frac * barMaxVal;
                return (
                  <g key={frac}>
                    <line x1={PAD_X} y1={y} x2={CHART_W - BAR_PAD_X} y2={y} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />
                    <text x={PAD_X - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize="9">
                      {formatAxisTick(val, bcp47)}
                    </text>
                  </g>
                );
              })}
              {/* Bars + X-axis labels */}
              {values.map((v, i) => {
                const expense = hasExpenses ? normalizedExpenseValues[i] : 0;
                const revenueH = Math.max((Math.max(v, 0) / barMaxVal) * barPlotH, v > 0 ? 3 : 0);
                const expenseH = hasExpenses
                  ? Math.max((Math.max(expense, 0) / barMaxVal) * barPlotH, expense > 0 ? 3 : 0)
                  : 0;

                const groupWidth = hasExpenses ? barW * 2 + barInnerGap : barW;
                const groupX = PAD_X + i * barSlotW + (barSlotW - groupWidth) / 2;
                const revenueX = groupX;
                const expenseX = groupX + barW + barInnerGap;
                const revenueY = BAR_PAD_Y + barPlotH - revenueH;
                const expenseY = BAR_PAD_Y + barPlotH - expenseH;
                const labelX = groupX + groupWidth / 2;
                const tipY = hasExpenses ? Math.min(revenueY, expenseY) : revenueY;

                const onEnter = () => {
                  setTooltip({
                    x: labelX,
                    y: tipY,
                    label: localizedLabels[i],
                    revenue: v,
                    expense: hasExpenses ? expense : null,
                  });
                };

                return (
                  <g key={i}
                    onMouseEnter={onEnter}
                    onMouseLeave={() => setTooltip(null)}
                    style={{ cursor: 'crosshair' }}
                  >
                    <rect x={revenueX} y={revenueY} width={barW} height={revenueH} rx="3"
                      fill={i === lastIdx ? '#10b981' : 'rgba(16,185,129,0.35)'}
                    />
                    {hasExpenses && (
                      <rect x={expenseX} y={expenseY} width={barW} height={expenseH} rx="3"
                        fill={i === lastIdx ? 'hsl(var(--destructive))' : 'hsl(var(--destructive) / 0.35)'}
                      />
                    )}
                    <text x={labelX} y={CHART_H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
                      {localizedLabels[i]}
                    </text>
                  </g>
                );
              })}

              {tooltip && (() => {
                const boxW = hasExpenses ? 145 : 130;
                const lineH = 15;
                const numLines = hasExpenses ? 3 : 2;
                const boxH = 10 + numLines * lineH + 2;
                const tipX = Math.min(Math.max(tooltip.x - boxW / 2, PAD_X), CHART_W - PAD_X - boxW);
                const tipY = Math.max(tooltip.y - boxH - 8, BAR_PAD_Y);
                return (
                  <g pointerEvents="none">
                    <rect x={tipX} y={tipY} width={boxW} height={boxH} rx="4" ry="4" fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth="1" />
                    <text x={tipX + boxW / 2} y={tipY + 12} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">{tooltip.label}</text>
                    <text x={tipX + boxW / 2} y={tipY + 12 + lineH} textAnchor="middle" fontSize="10" fontWeight="600" fill="#10b981">{`${tMenu('Revenue')}: ${fmtTooltip(tooltip.revenue)}`}</text>
                    {hasExpenses && (
                      <text x={tipX + boxW / 2} y={tipY + 12 + lineH * 2} textAnchor="middle" fontSize="10" fontWeight="600" fill="hsl(var(--destructive))">{`${tMenu('Expenses')}: ${fmtTooltip(tooltip.expense)}`}</text>
                    )}
                  </g>
                );
              })()}
            </svg>
          )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
 * Top Clients
 * ----------------------------------------------------------------*/

async function findTopClientRoute({ client, token, apiBaseUrl }) {
  const directRoute = resolveDashboardNavigation(client?.navigation);
  if (directRoute) return directRoute;
  if (client?.id) return `/contacts/${client.id}`;

  const name = String(client?.name ?? '').trim();
  if (!token || !apiBaseUrl || !name) return '/contacts';

  const criteria = encodeURIComponent(JSON.stringify({
    operator: 'and',
    criteria: [
      { fieldName: 'name', operator: 'equals', value: name },
    ],
  }));

  try {
    const res = await fetch(
      `${apiBaseUrl}/contacts/businessPartner?_sortBy=name asc&_startRow=0&_endRow=10&criteria=${criteria}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!res.ok) return '/contacts';

    const json = await res.json();
    const rows = json?.response?.data ?? [];
    const exact = rows.find((row) => String(row?.name ?? '').trim() === name) ?? rows[0] ?? null;
    return exact?.id ? `/contacts/${exact.id}` : '/contacts';
  } catch {
    return '/contacts';
  }
}

function TopClients({ clients = [], currencyLabel = '', token = '', apiBaseUrl = '' }) {
  const ui = useUI();
  const navigate = useNavigate();

  const handleClientClick = async (client) => {
    const route = await findTopClientRoute({ client, token, apiBaseUrl });
    navigate(route);
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className={WIDGET_HEADER_CLASS}>
        <CardTitle className={WIDGET_TITLE_CLASS}>{ui('topClients12m')}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto">
        {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">{ui('noDataAvailable')}</p>
        ) : (
          <div className="space-y-0">
            {clients.map((c, i) => (
              <React.Fragment key={c.name}>
                {i > 0 && <Separator />}
                <button
                  type="button"
                  onClick={() => handleClientClick(c)}
                  className="flex w-full items-center justify-between py-2 px-1 rounded-md hover:bg-muted/50 transition-colors group text-left"
                >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <span className="text-sm truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-sm font-medium">{formatDashboardAmount(c.total, currencyLabel)}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity" />
                    </div>
                </button>
              </React.Fragment>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
 * Quick Actions
 * ----------------------------------------------------------------*/

function QuickActions({ actions = [] }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  return (
    <Card>
      <CardHeader className={WIDGET_HEADER_CLASS}>
        <CardTitle className={WIDGET_TITLE_CLASS}>{ui('quickActions')}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button key={action.to} variant="outline" size="sm" asChild>
                <Link to={action.to}>
                  <Icon className="h-4 w-4 mr-1.5" />
                  {tMenu(action.label)}
                </Link>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
 * Pending Tasks
 * ----------------------------------------------------------------*/

function PendingTasks({ tasks = [] }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className={WIDGET_HEADER_CLASS}>
        <CardTitle className={WIDGET_TITLE_CLASS}>{ui('pendingTasks')}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto">
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">{tMenu('No pending tasks')}</p>
        )}
        <div className="space-y-1">
          {tasks.map((task, i) => {
            const isWarning = task.type === 'warning';
            const taskKey = resolvePendingTaskKey(task);
            const target = resolveDashboardTarget({ navigation: task.navigation, link: task.link, fallback: '/dashboard' });
            return (
              <React.Fragment key={i}>
                {i > 0 && <Separator />}
                <Link
                  to={target}
                  className="flex items-center gap-3 py-2 px-1 rounded-md hover:bg-muted/50 transition-colors group"
                >
                  {isWarning ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  ) : (
                    <Info className="h-4 w-4 shrink-0 text-blue-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {task.labelKey && task.count != null
                        ? `${task.count} ${tMenu(task.labelKey)}`
                        : taskKey ? ui(taskKey, { count: task.count }) : task.text}
                    </p>
                    {(task.amount || task.detail) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {task.amount || task.detail}
                      </p>
                    )}
                  </div>
                  {task.count != null && (
                    <span
                      className={
                        isWarning
                          ? 'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700'
                          : 'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700'
                      }
                    >
                      {task.count}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </React.Fragment>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
 * Collections & Payments Widget
 * ----------------------------------------------------------------*/

function CollectionsPayments({ pendingAmounts = {}, currencyLabel = '' }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const { toCollect = { count: 0, amount: 0 }, toPay = { count: 0, amount: 0 } } = pendingAmounts;
  const fallbackToCollectNavigation = createDashboardNavigation({ type: 'list', window: 'sales-invoice', filter: 'overdue' });
  const fallbackToPayNavigation = createDashboardNavigation({ type: 'list', window: 'purchase-invoice', filter: 'overdue' });
  const toCollectTarget = resolveDashboardTarget({
    navigation: toCollect.navigation || fallbackToCollectNavigation,
    link: '/sales-invoice?filter=overdue',
    fallback: '/sales-invoice',
  });
  const toPayTarget = resolveDashboardTarget({
    navigation: toPay.navigation || fallbackToPayNavigation,
    link: '/purchase-invoice?filter=overdue',
    fallback: '/purchase-invoice',
  });
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className={WIDGET_HEADER_CLASS}>
        <CardTitle className={WIDGET_TITLE_CLASS}>{ui('collectionsPayments')}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3 flex-1 min-h-0 overflow-y-auto">
        <Link to={toCollectTarget} className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50 transition-colors group">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
            <div>
              <p className="text-sm font-medium">{tMenu('To Collect')}</p>
              <p className="text-xs text-muted-foreground">{toCollect.count !== 1 ? ui('invoicesPending', { count: toCollect.count }) : ui('invoicePending', { count: toCollect.count })}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-green-600">{formatDashboardAmount(toCollect.amount, currencyLabel)}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>
        <Separator />
        <Link to={toPayTarget} className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50 transition-colors group">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-destructive" />
            <div>
              <p className="text-sm font-medium">{tMenu('To Pay')}</p>
              <p className="text-xs text-muted-foreground">{toPay.count !== 1 ? ui('invoicesPending', { count: toPay.count }) : ui('invoicePending', { count: toPay.count })}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-destructive">{formatDashboardAmount(toPay.amount, currencyLabel)}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
 * Recent Invoices Widget
 * ----------------------------------------------------------------*/

function fmtDate(str, locale = 'en-US') {
  if (!str) return '';
  // Support dd-MM-yyyy and yyyy-MM-dd
  const iso = /^\d{4}-\d{2}-\d{2}/.test(str) ? str : (() => { const m = str.match(/^(\d{2})-(\d{2})-(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : str; })();
  const d = new Date(iso);
  if (isNaN(d)) return str;
  // Normalize locale: es_ES → es-ES (BCP 47)
  const bcp47 = (locale || 'en-US').replace('_', '-');
  return d.toLocaleDateString(bcp47, { month: 'short', day: 'numeric' });
}

function RecentInvoices({ invoices = [], currencyLabel = '' }) {
  const ui = useUI();
  const { locale } = useLocaleSwitch();
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className={WIDGET_HEADER_CLASS}>
        <div className="space-y-0.5">
          <CardTitle className={WIDGET_TITLE_CLASS}>{ui('recentInvoices')}</CardTitle>
          <p className="text-xs text-muted-foreground">{ui('recentInvoicesSubtitle')}</p>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto">
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{ui('noInvoicesFound')}</p>
        ) : (
          <div className="space-y-0">
            {invoices.map((inv, i) => {
              const target = resolveDashboardTarget({
                navigation: inv.navigation,
                link: inv.id ? `/sales-invoice/${inv.id}` : '/sales-invoice',
                fallback: '/sales-invoice',
              });
              return (
                <React.Fragment key={inv.id || i}>
                  {i > 0 && <Separator />}
                  <Link to={target} className="flex items-center justify-between py-2 px-1 rounded-md hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm truncate">{inv.client}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(inv.date, locale)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-sm font-medium">{formatDashboardAmount(inv.amount, currencyLabel)}</span>
                    </div>
                  </Link>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
 * Number formatter helpers
 * ----------------------------------------------------------------*/

function fmtCompact(n, currencyLabel = '') {
  const v = Number(n) || 0;
  if (currencyLabel) return formatDashboardCompact(v, currencyLabel);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString('en-US');
}

/* ------------------------------------------------------------------
 * Best Sellers Widget
 * ----------------------------------------------------------------*/

function BestSellers({ sellers = [], products = [], currencyLabel = '' }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const [viewMode, setViewMode] = useState('quantity');
  const rows = viewMode === 'quantity' ? sellers : products;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className={WIDGET_HEADER_CLASS}>
        <div className="flex items-center justify-between">
          <CardTitle className={WIDGET_TITLE_CLASS}>{ui('bestSellers12m')}</CardTitle>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setViewMode('quantity'); }}
              className={`p-1 transition-colors ${viewMode === 'quantity' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              aria-label={ui('months12ByQty')}
              title={ui('months12ByQty')}
            >
              <BarChart2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setViewMode('revenue'); }}
              className={`p-1 transition-colors ${viewMode === 'revenue' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              aria-label={ui('months12ByRevenue')}
              title={ui('months12ByRevenue')}
            >
              <DollarSign className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">{ui('noDataAvailable')}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${viewMode}-${row.name}`} className={`border-b last:border-0 hover:bg-muted/40 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                  <td className="px-4 py-2 truncate max-w-0" style={{ maxWidth: '1px', width: '60%' }}>
                    <span className="block truncate">{row.name}</span>
                  </td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">
                    {viewMode === 'quantity'
                      ? fmtCompact(row.qty)
                      : formatDashboardAmount(row.amount, currencyLabel)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
 * Loading Skeleton
 * ----------------------------------------------------------------*/

function DashboardSkeleton() {
  return (
    <div className="p-6 bg-white rounded-tl-2xl flex-1 overflow-y-auto animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* KPI — large (4 cols) */}
        <div className="col-span-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-3 w-24 bg-muted rounded" />
                <div className="h-8 w-8 bg-muted rounded-full" />
              </div>
              <div className="h-7 w-32 bg-muted rounded" />
              <div className="h-3 w-20 bg-muted rounded" />
            </div>
          ))}
        </div>
        {/* Revenue chart — medium (2 cols) */}
        <div className="col-span-2 rounded-xl border bg-card p-4 space-y-3">
          <div className="h-4 w-48 bg-muted rounded" />
          <div className="h-48 w-full bg-muted rounded" />
        </div>
        {/* Pending tasks — small (1 col) */}
        <div className="col-span-1 rounded-xl border bg-card p-4 space-y-3">
          <div className="h-4 w-32 bg-muted rounded" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <div className="h-4 w-4 bg-muted rounded-full shrink-0" />
              <div className="flex-1 h-3 bg-muted rounded" />
              <div className="h-5 w-8 bg-muted rounded-full" />
            </div>
          ))}
        </div>
        {/* Quick actions — small (1 col) */}
        <div className="col-span-1 rounded-xl border bg-card p-4 space-y-3">
          <div className="h-4 w-28 bg-muted rounded" />
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-24 bg-muted rounded-md" />
            ))}
          </div>
        </div>
        {/* Top clients — medium (2 cols) */}
        <div className="col-span-2 rounded-xl border bg-card p-4 space-y-3">
          <div className="h-4 w-40 bg-muted rounded" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="h-3 w-36 bg-muted rounded" />
              <div className="h-3 w-20 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
 * Dashboard Page
 * ----------------------------------------------------------------*/

export default function DashboardPage({ apiBaseUrl = '' }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const { token, selectedOrg } = useAuth();
  const [widgetManagerOpen, setWidgetManagerOpen] = useState(false);
  const gridRef = useRef(null);
  const { kpis, revenueTrend, expenseTrend, topClients, pendingTasks, recentInvoices, bestProducts, bestSellers, pendingAmounts, actions, loading } = useDashboardData();
  const { open: openCopilot } = useCopilot();
  const { config, toggle, reorder, reset } = useWidgetConfig();
  const dashboardCurrency = useDashboardCurrency(token, selectedOrg, apiBaseUrl);

  const resolvedKpis = kpis.map((k) => ({ ...k, icon: ICON_MAP[k.icon] || DollarSign }));
  const quickActionOrder = ['/sales-order', '/sales-invoice', '/contacts'];
  const quickActions = actions
    .slice()
    .sort((a, b) => {
      const aIndex = quickActionOrder.indexOf(a.route);
      const bIndex = quickActionOrder.indexOf(b.route);
      const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
      const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
      return safeA - safeB;
    })
    .map((a) => ({
      label: resolveQuickActionLabel(ui, tMenu, { label: a.label, to: a.route }),
      to: resolveQuickActionRoute(a.route),
      icon: ICON_MAP[a.icon] || FileText,
    }));

  const visibleItems = config.filter((c) => c.visible && getWidgetMeta(c.id));

  const renderWidget = (id) => {
    const kpiWidget = (kpiKey) => {
      const kpi = resolvedKpis.find((k) => k.key === kpiKey);
      if (!kpi) return null;
      const localizedLabel = ui(kpi.key);
      return (
        <KPICard
          key={id}
          label={localizedLabel === kpi.key ? kpi.label : localizedLabel}
          value={kpi.value}
          format={kpi.format}
          trend={kpi.trend}
          previousValue={kpi.previousValue}
          icon={kpi.icon}
          kpiKey={kpi.key}
          currencyLabel={dashboardCurrency}
        />
      );
    };
    switch (id) {
      case 'kpi-revenue':          return kpiWidget('revenueThisMonth');
      case 'kpi-expenses':         return kpiWidget('expensesThisMonth');
      case 'kpi-profit':           return kpiWidget('netProfit');
      case 'revenue-chart':        return <RevenueChart key={id} labels={revenueTrend.labels} values={revenueTrend.values} expenseValues={expenseTrend} currencyLabel={dashboardCurrency} />;
      case 'top-clients':          return <TopClients key={id} clients={topClients} currencyLabel={dashboardCurrency} token={token} apiBaseUrl={apiBaseUrl} />;
      case 'pending-tasks':        return <PendingTasks key={id} tasks={pendingTasks} />;
      case 'quick-actions':        return <QuickActions key={id} actions={quickActions} />;
      case 'collections-payments': return <CollectionsPayments key={id} pendingAmounts={pendingAmounts} currencyLabel={dashboardCurrency} />;
      case 'recent-invoices':      return <RecentInvoices key={id} invoices={recentInvoices} currencyLabel={dashboardCurrency} />;
      case 'best-sellers':         return <BestSellers key={id} sellers={bestSellers} products={bestProducts} currencyLabel={dashboardCurrency} />;
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="px-6 pt-3 pb-3">
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <h1 className="text-xl font-bold text-foreground">{ui('dashboardTitle')}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dashboardCurrency
                ? `${ui('dashboardCurrencyContext')}: ${dashboardCurrency}`
                : ui('dashboardCurrencyUnavailable')}
            </p>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={ui('searchPlaceholder')}
                readOnly
                tabIndex={-1}
                className="w-full h-9 rounded-lg border border-border/50 bg-white/60 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors cursor-default"
              />
              <Mic className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={openCopilot}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              <Sparkles className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground/40 cursor-not-allowed transition-colors"
              title={`${ui('customizeDashboard')} (${ui('comingSoon')})`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-4 w-4" />
            </button>
            <button className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="h-4 w-4" />
            </button>
            <LocaleSwitcher />
            <UserAvatarButton />
          </div>
        </div>
      </div>

      {loading ? <DashboardSkeleton /> : (
        <div className="p-6 bg-white rounded-tl-2xl flex-1 overflow-y-auto">
          {visibleItems.length > 0 && (() => {
            const getSize = (item) => item.size || getWidgetMeta(item.id)?.defaultSize || 'medium';
            const getColSpan = (item) => SIZE_COLS[getSize(item)] ?? 1;
            const getHeight = (item) => {
              if (item.height != null) return item.height;
              if (item.id === 'revenue-chart') return null;
              // pending-tasks and top-clients default to 4 rows, all others to 2
              return TALL_DEFAULT.has(item.id) ? ROW_STEP * 4 : ROW_STEP * MIN_ROWS;
            };

            const makeDraggable = (item, children) => {
              const h = getHeight(item);

              return (
                <div
                  key={item.id}
                  data-widget-id={item.id}
                  className={`relative transition-all duration-150 ${h ? 'overflow-hidden [&>:last-child]:h-full [&>:last-child>*]:h-full' : ''}`}
                  style={h ? { height: h + 'px' } : undefined}
                >
                  <div>{children}</div>
                </div>
              );
            };

            return (
              <div ref={gridRef} className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                {visibleItems.map((item) => (
                  <div key={item.id} className={COL_SPAN_CLASS[getColSpan(item)]}>
                    {makeDraggable(item, renderWidget(item.id))}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      <WidgetManagerSheet
        open={widgetManagerOpen}
        onClose={() => setWidgetManagerOpen(false)}
        config={config}
        toggle={toggle}
        reorder={reorder}
        onReset={reset}
        ui={ui}
      />
    </div>
  );
}

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KPIHeader } from '@/components/contract-ui/KPIHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import LocaleSwitcher from '@/components/LocaleSwitcher.jsx';
import { UserAvatarButton, UserContextSwitcher } from '@/components/UserContextSwitcher.jsx';
import {
  DollarSign,
  CreditCard,
  TrendingUp,
  FileText,
  ShoppingCart,
  Users,
  Box,
  AlertTriangle,
  Info,
  ChevronRight,
  ChevronDown,
  Clock,
  Search,
  Sparkles,
  Plus,
  Bell,
  Mic,
} from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useCopilot } from '@/components/CopilotContext';

/* ------------------------------------------------------------------
 * Icon lookup
 * ----------------------------------------------------------------*/

const ICON_MAP = { DollarSign, CreditCard, TrendingUp, Clock, FileText, ShoppingCart, Users, Box };

/* ------------------------------------------------------------------
 * SVG Revenue Chart
 * ----------------------------------------------------------------*/

const CHART_W = 600;
const CHART_H = 220;
const PAD_X = 40;
const PAD_Y = 20;
const PAD_BOTTOM = 30;

function useCollapsed(key) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(key) === 'true');
  const toggle = () => setCollapsed((c) => { const next = !c; localStorage.setItem(key, String(next)); return next; });
  return [collapsed, toggle];
}

function RevenueChart({ labels = [], values = [], expenseValues = [] }) {
  const [collapsed, toggleCollapsed] = useCollapsed('dashboard_collapsed_revenue');
  const hasExpenses = expenseValues.length === values.length && expenseValues.some((v) => v > 0);
  const allValues = hasExpenses ? [...values, ...expenseValues] : values;
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
  const expPoints = hasExpenses ? expenseValues.map((v, i) => toPoint(v, i, expenseValues.length)) : [];

  const toPolyline = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');
  const toFillPath = (pts) => [
    `M ${pts[0].x},${pts[0].y}`,
    ...pts.slice(1).map((p) => `L ${p.x},${p.y}`),
    `L ${pts[pts.length - 1].x},${PAD_Y + plotH}`,
    `L ${pts[0].x},${PAD_Y + plotH}`,
    'Z',
  ].join(' ');

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={toggleCollapsed}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${collapsed ? '-rotate-90' : ''}`} />
            <CardTitle className="text-sm font-medium">
              {hasExpenses ? 'Revenue vs Expenses (12 months)' : 'Revenue Trend (12 months)'}
            </CardTitle>
          </div>
          {hasExpenses && !collapsed && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary" />
                Revenue
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-destructive" />
                Expenses
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      {!collapsed && <CardContent className="p-4 pt-0">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full h-auto"
          role="img"
          aria-label="Revenue and expenses trend chart for the last 12 months"
        >
          <defs>
            <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="expense-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity="0.2" />
              <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = PAD_Y + plotH - frac * plotH;
            const val = minVal + frac * range;
            return (
              <g key={frac}>
                <line
                  x1={PAD_X}
                  y1={y}
                  x2={CHART_W - PAD_X}
                  y2={y}
                  stroke="hsl(var(--border))"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={PAD_X - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground"
                  fontSize="9"
                >
                  {(val / 1000).toFixed(0)}k
                </text>
              </g>
            );
          })}

          {/* Expense fill + line (drawn first, below revenue) */}
          {hasExpenses && (
            <>
              <path d={toFillPath(expPoints)} fill="url(#expense-gradient)" />
              <polyline
                points={toPolyline(expPoints)}
                fill="none"
                stroke="hsl(var(--destructive))"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="5 3"
              />
              {expPoints.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="1.5" />
              ))}
            </>
          )}

          {/* Revenue fill area */}
          <path d={toFillPath(revPoints)} fill="url(#chart-gradient)" />

          {/* Revenue line */}
          <polyline
            points={toPolyline(revPoints)}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Revenue dots */}
          {revPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="2" />
          ))}

          {/* X-axis labels */}
          {labels.map((m, i) => {
            const x = PAD_X + (i / (labels.length - 1)) * plotW;
            return (
              <text key={m} x={x} y={CHART_H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
                {m}
              </text>
            );
          })}
        </svg>
      </CardContent>}
    </Card>
  );
}

/* ------------------------------------------------------------------
 * Top Clients
 * ----------------------------------------------------------------*/

function TopClients({ clients = [] }) {
  const [collapsed, toggleCollapsed] = useCollapsed('dashboard_collapsed_topclients');
  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={toggleCollapsed}>
        <div className="flex items-center gap-2">
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          <CardTitle className="text-sm font-medium">Top Clients (12 months)</CardTitle>
        </div>
      </CardHeader>
      {!collapsed && <CardContent className="p-4 pt-0">
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data available</p>
        ) : (
          <div className="space-y-0">
            {clients.map((c, i) => (
              <React.Fragment key={c.name}>
                {i > 0 && <Separator />}
                <div className="flex items-center justify-between py-2 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <span className="text-sm truncate">{c.name}</span>
                  </div>
                  <span className="text-sm font-medium shrink-0 ml-2">
                    ${Number(c.total).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </CardContent>}
    </Card>
  );
}

/* ------------------------------------------------------------------
 * Quick Actions
 * ----------------------------------------------------------------*/

function QuickActions({ actions = [] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button key={action.to} variant="outline" size="sm" asChild>
                <Link to={action.to}>
                  <Icon className="h-4 w-4 mr-1.5" />
                  {action.label}
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
  const [collapsed, toggleCollapsed] = useCollapsed('dashboard_collapsed_pendingtasks');
  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={toggleCollapsed}>
        <div className="flex items-center gap-2">
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
        </div>
      </CardHeader>
      {!collapsed && <CardContent className="p-4 pt-0">
        <div className="space-y-1">
          {tasks.map((task, i) => {
            const isWarning = task.type === 'warning';
            return (
              <React.Fragment key={i}>
                {i > 0 && <Separator />}
                <Link
                  to={task.link}
                  className="flex items-center gap-3 py-2 px-1 rounded-md hover:bg-muted/50 transition-colors group"
                >
                  {isWarning ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  ) : (
                    <Info className="h-4 w-4 shrink-0 text-blue-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{task.text}</p>
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
      </CardContent>}
    </Card>
  );
}

/* ------------------------------------------------------------------
 * Loading Skeleton
 * ----------------------------------------------------------------*/

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6 bg-white rounded-tl-2xl flex-1 overflow-y-auto animate-pulse">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: chart + top clients */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="h-4 w-48 bg-muted rounded" />
            <div className="h-48 w-full bg-muted rounded" />
          </div>
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="h-4 w-40 bg-muted rounded" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <div className="h-3 w-36 bg-muted rounded" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: pending tasks + quick actions */}
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="h-4 w-32 bg-muted rounded" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <div className="h-4 w-4 bg-muted rounded-full shrink-0" />
                <div className="flex-1 h-3 bg-muted rounded" />
                <div className="h-5 w-8 bg-muted rounded-full" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-8 w-24 bg-muted rounded-md" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
 * Dashboard Page
 * ----------------------------------------------------------------*/

export default function DashboardPage() {
  const [showUserContext, setShowUserContext] = useState(false);
  const { kpis, revenueTrend, expenseTrend, topClients, pendingTasks, actions, loading } = useDashboardData();
  const { open: openCopilot } = useCopilot();

  // Resolve icons for KPIs and actions
  const resolvedKpis = kpis.map((k) => ({
    ...k,
    icon: ICON_MAP[k.icon] || DollarSign,
  }));

  const quickActions = actions.map((a) => ({
    label: a.label,
    to: a.route,
    icon: ICON_MAP[a.icon] || FileText,
  }));

  return (
    <div className="h-full flex flex-col">
      {/* Top bar (matches ListView/DetailView style) */}
      <div className="px-6 pt-3 pb-3">
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search clients, orders, invoices..."
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
            <button className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-4 w-4" />
            </button>
            <button className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="h-4 w-4" />
            </button>
            <LocaleSwitcher />
            <UserAvatarButton isOpen={showUserContext} onClick={() => setShowUserContext(v => !v)} />
            {showUserContext && <UserContextSwitcher onClose={() => setShowUserContext(false)} />}
          </div>
        </div>
      </div>
    {loading ? <DashboardSkeleton /> : (
    <div className="space-y-6 p-6 bg-white rounded-tl-2xl flex-1 overflow-y-auto">
      {/* KPI Row */}
      <KPIHeader kpis={resolvedKpis} />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          <RevenueChart labels={revenueTrend.labels} values={revenueTrend.values} expenseValues={expenseTrend} />
          <TopClients clients={topClients} />
        </div>

        {/* Right column - 1/3 */}
        <div className="space-y-6">
          <PendingTasks tasks={pendingTasks} />
          <QuickActions actions={quickActions} />
        </div>
      </div>
    </div>
    )}
    </div>
  );
}

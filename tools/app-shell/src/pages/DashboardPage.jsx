import React from 'react';
import { Link } from 'react-router-dom';
import { KPIHeader } from '@/components/contract-ui/KPIHeader';
import { Chatter } from '@/components/contract-ui/Chatter';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  Clock,
} from 'lucide-react';
import { kpisConfig, actions } from '@generated/dashboard/generated/config';
import * as mockData from '@generated/dashboard/generated/mockData';

/* ------------------------------------------------------------------
 * Data derived from aggregate contract
 * ----------------------------------------------------------------*/

const ICON_MAP = { DollarSign, CreditCard, TrendingUp, Clock, FileText, ShoppingCart, Users, Box };

const kpis = kpisConfig.map((k) => ({
  ...k,
  value: mockData.kpis[k.key].value,
  trend: mockData.kpis[k.key].trend,
  icon: ICON_MAP[k.icon] || DollarSign,
}));

const chartMonths = mockData.revenueTrend.labels;
const chartValues = mockData.revenueTrend.values;

const quickActions = actions.map((a) => ({
  label: a.label,
  to: a.route,
  icon: ICON_MAP[a.icon] || FileText,
}));

const pendingTasks = mockData.pendingTasks;

const recentMessages = mockData.recentMessages;

/* ------------------------------------------------------------------
 * SVG Revenue Chart
 * ----------------------------------------------------------------*/

const CHART_W = 600;
const CHART_H = 220;
const PAD_X = 40;
const PAD_Y = 20;
const PAD_BOTTOM = 30;

function RevenueChart() {
  const maxVal = Math.max(...chartValues);
  const minVal = Math.min(...chartValues);
  const range = maxVal - minVal || 1;

  const plotW = CHART_W - PAD_X * 2;
  const plotH = CHART_H - PAD_Y - PAD_BOTTOM;

  const points = chartValues.map((v, i) => {
    const x = PAD_X + (i / (chartValues.length - 1)) * plotW;
    const y = PAD_Y + plotH - ((v - minVal) / range) * plotH;
    return { x, y };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Closed polygon for gradient fill (goes down to bottom, back along x-axis)
  const fillPath = [
    `M ${points[0].x},${points[0].y}`,
    ...points.slice(1).map((p) => `L ${p.x},${p.y}`),
    `L ${points[points.length - 1].x},${PAD_Y + plotH}`,
    `L ${points[0].x},${PAD_Y + plotH}`,
    'Z',
  ].join(' ');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Revenue Trend (12 months)</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full h-auto"
          role="img"
          aria-label="Revenue trend line chart for the last 12 months"
        >
          <defs>
            <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
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

          {/* Fill area */}
          <path d={fillPath} fill="url(#chart-gradient)" />

          {/* Line */}
          <polyline
            points={polyline}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data dots */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="3"
              fill="hsl(var(--background))"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
            />
          ))}

          {/* X-axis labels */}
          {chartMonths.map((m, i) => {
            const x = PAD_X + (i / (chartMonths.length - 1)) * plotW;
            return (
              <text
                key={m}
                x={x}
                y={CHART_H - 6}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="10"
              >
                {m}
              </text>
            );
          })}
        </svg>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
 * Quick Actions
 * ----------------------------------------------------------------*/

function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => {
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

function PendingTasks() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-1">
          {pendingTasks.map((task, i) => {
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
 * Dashboard Page
 * ----------------------------------------------------------------*/

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-6 bg-white rounded-tl-2xl min-h-full">
      {/* KPI Row */}
      <KPIHeader kpis={kpis} />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          <RevenueChart />
          <QuickActions />
        </div>

        {/* Right column - 1/3 */}
        <div className="space-y-6">
          <PendingTasks />
          <Chatter
            entityType="dashboard"
            entityId="home"
            messages={recentMessages}
            collapsed={false}
          />
        </div>
      </div>
    </div>
  );
}

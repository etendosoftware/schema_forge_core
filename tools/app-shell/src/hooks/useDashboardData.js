import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  kpis as mockKpiValues,
  revenueTrend as mockRevenueTrend,
  pendingTasks as mockPendingTasks,
  recentMessages as mockRecentMessages,
} from '@generated/dashboard/generated/mockData';
import { kpisConfig, actions } from '@generated/dashboard/generated/config';
import { useAuth } from '@/auth/AuthContext';

/* ------------------------------------------------------------------
 * Constants
 * ----------------------------------------------------------------*/

const FETCH_TIMEOUT_MS = 10000;
const LARGE_PAGE = 9999;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ------------------------------------------------------------------
 * Low-level helpers
 * ----------------------------------------------------------------*/

/** Detect the Etendo context path for building API URLs. */
function getApiBase() {
  const path = window.location.pathname;
  const webIdx = path.indexOf('/web/');
  if (webIdx === -1) return import.meta.env.VITE_API_BASE || '';
  return path.substring(0, webIdx);
}

/**
 * Fetch ALL records from a NEO Headless endpoint (no server-side filters).
 * NEO does not reliably filter by field values — all filtering is done client-side.
 */
async function fetchAllRecords(apiBase, token, spec, entity) {
  const params = new URLSearchParams();
  params.set('_startRow', '0');
  params.set('_endRow', String(LARGE_PAGE));
  params.set('_sortBy', 'creationDate desc');

  const url = `${apiBase}/sws/neo/${spec}/${entity}?${params}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.response || json.response.status !== 0) {
      console.warn(`[dashboard] API error for ${spec}/${entity}:`, json?.response?.error ?? 'unknown');
      return null;
    }
    return json.response.data ?? [];
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[dashboard] Failed to fetch ${spec}/${entity}:`, err.message);
    return null;
  }
}

/** Parse a date string (ISO or Etendo dd-MM-yyyy format). */
function parseDate(str) {
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return new Date(str);
  const m = str.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}`);
  return new Date(str);
}

/** Check if a value is falsy in Etendo's boolean world (Y/N strings). */
function isFalsy(val) {
  return !val || val === 'N' || val === 'false' || val === 'No' || val === false;
}

/** Sum a numeric field across records. */
function sumField(records, field) {
  return records.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
}

/** Filter records whose dateField falls within a given year/month. */
function filterByMonth(records, dateField, year, month) {
  return records.filter((r) => {
    const d = parseDate(r[dateField]);
    return d && d.getFullYear() === year && d.getMonth() === month;
  });
}

/** Format a dollar amount for display. */
function fmtAmount(n) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

/* ------------------------------------------------------------------
 * Aggregation: KPIs
 * ----------------------------------------------------------------*/

function buildKpis(allSalesInvoices, allPurchaseInvoices) {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
  const prevYear = curMonth === 0 ? curYear - 1 : curYear;

  // Client-side filter: only completed invoices for revenue/expenses
  const completedSales = allSalesInvoices.filter((r) => r.documentStatus === 'CO');
  const completedPurchases = allPurchaseInvoices.filter((r) => r.documentStatus === 'CO');

  const curSales = filterByMonth(completedSales, 'invoiceDate', curYear, curMonth);
  const prevSales = filterByMonth(completedSales, 'invoiceDate', prevYear, prevMonth);
  const curPurchases = filterByMonth(completedPurchases, 'invoiceDate', curYear, curMonth);
  const prevPurchases = filterByMonth(completedPurchases, 'invoiceDate', prevYear, prevMonth);

  const revenue = sumField(curSales, 'grandTotalAmount');
  const prevRevenue = sumField(prevSales, 'grandTotalAmount');
  const expenses = sumField(curPurchases, 'grandTotalAmount');
  const prevExpenses = sumField(prevPurchases, 'grandTotalAmount');
  const profit = revenue - expenses;
  const prevProfit = prevRevenue - prevExpenses;

  // Pending invoices: draft sales + draft purchase invoices
  const pendingCount = allSalesInvoices.filter((r) => r.documentStatus === 'DR').length
    + allPurchaseInvoices.filter((r) => r.documentStatus === 'DR').length;

  function trendPct(cur, prev) {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
  }

  const values = {
    revenueThisMonth: { value: revenue, trend: trendPct(revenue, prevRevenue), previousValue: prevRevenue },
    expensesThisMonth: { value: expenses, trend: trendPct(expenses, prevExpenses), previousValue: prevExpenses },
    netProfit: { value: profit, trend: trendPct(profit, prevProfit), previousValue: prevProfit },
    pendingInvoices: { value: pendingCount, trend: 0, previousValue: pendingCount },
  };

  return kpisConfig.map((cfg) => ({ ...cfg, ...values[cfg.key] }));
}

/* ------------------------------------------------------------------
 * Aggregation: Revenue Trend (12 months)
 * ----------------------------------------------------------------*/

function buildRevenueTrend(allSalesInvoices) {
  const completedSales = allSalesInvoices.filter((r) => r.documentStatus === 'CO');
  const now = new Date();
  const labels = [];
  const values = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(MONTH_LABELS[d.getMonth()]);
    const monthRecords = filterByMonth(completedSales, 'invoiceDate', d.getFullYear(), d.getMonth());
    values.push(sumField(monthRecords, 'grandTotalAmount'));
  }

  return { labels, values };
}

/* ------------------------------------------------------------------
 * Aggregation: Pending Tasks
 * ----------------------------------------------------------------*/

function buildPendingTasks(allSalesInvoices, allPurchaseInvoices, allPurchaseOrders, allShipments) {
  const draftSalesInvoices = allSalesInvoices.filter((r) => r.documentStatus === 'DR');
  const draftPurchaseInvoices = (allPurchaseInvoices ?? []).filter((r) => r.documentStatus === 'DR');

  // Draft shipments and purchase orders (client-side filter)
  const draftShipments = allShipments.filter((r) => r.documentStatus === 'DR');
  const draftPOs = allPurchaseOrders.filter((r) => r.documentStatus === 'DR');

  const tasks = [];

  if (draftSalesInvoices.length > 0) {
    tasks.push({
      type: 'info',
      text: `${draftSalesInvoices.length} Sales Invoice${draftSalesInvoices.length > 1 ? 's' : ''} pending`,
      link: '/sales-invoice',
      count: draftSalesInvoices.length,
      amount: fmtAmount(sumField(draftSalesInvoices, 'grandTotalAmount')),
    });
  }

  if (draftPurchaseInvoices.length > 0) {
    tasks.push({
      type: 'info',
      text: `${draftPurchaseInvoices.length} Purchase Invoice${draftPurchaseInvoices.length > 1 ? 's' : ''} pending`,
      link: '/purchase-invoice',
      count: draftPurchaseInvoices.length,
      amount: fmtAmount(sumField(draftPurchaseInvoices, 'grandTotalAmount')),
    });
  }

  if (draftShipments.length > 0) {
    tasks.push({
      type: 'info',
      text: `${draftShipments.length} orders pending shipment`,
      link: '/goods-shipment',
      count: draftShipments.length,
    });
  }

  if (draftPOs.length > 0) {
    tasks.push({
      type: 'info',
      text: `${draftPOs.length} purchase orders to confirm`,
      link: '/purchase-order',
      count: draftPOs.length,
    });
  }

  return tasks;
}

/* ------------------------------------------------------------------
 * Mock fallback
 * ----------------------------------------------------------------*/

function buildMockFallback() {
  const kpis = kpisConfig.map((cfg) => ({
    ...cfg,
    ...mockKpiValues[cfg.key],
    previousValue: Math.round(
      mockKpiValues[cfg.key].value / (1 + mockKpiValues[cfg.key].trend / 100)
    ),
  }));
  return {
    kpis,
    revenueTrend: mockRevenueTrend,
    pendingTasks: mockPendingTasks,
    recentMessages: mockRecentMessages,
  };
}

/* ------------------------------------------------------------------
 * Hook
 * ----------------------------------------------------------------*/

/**
 * Hook that provides all dashboard data.
 * Fetches all records from NEO Headless CRUD endpoints in parallel,
 * filters and aggregates client-side, falls back to mock on error.
 */
export function useDashboardData() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const apiBase = useMemo(() => getApiBase(), []);

  const fetchData = useCallback(async () => {
    if (!token) {
      setData(buildMockFallback());
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch all records — filtering is done client-side because NEO
      // does not reliably apply field-level query parameters as filters.
      const [salesRes, purchasesRes, posRes, shipmentsRes] = await Promise.allSettled([
        fetchAllRecords(apiBase, token, 'sales-invoice', 'header'),
        fetchAllRecords(apiBase, token, 'purchase-invoice', 'invoice'),
        fetchAllRecords(apiBase, token, 'purchase-order', 'order'),
        fetchAllRecords(apiBase, token, 'goods-shipment', 'goodsShipment'),
      ]);

      const salesInvoices = salesRes.status === 'fulfilled' ? salesRes.value : null;
      const purchaseInvoices = purchasesRes.status === 'fulfilled' ? purchasesRes.value : null;
      const purchaseOrders = posRes.status === 'fulfilled' ? posRes.value : null;
      const shipments = shipmentsRes.status === 'fulfilled' ? shipmentsRes.value : null;

      if (!salesInvoices && !purchaseInvoices && !purchaseOrders && !shipments) {
        console.warn('[dashboard] All API queries failed — using mock data');
        setData(buildMockFallback());
        setLoading(false);
        return;
      }

      const mock = buildMockFallback();

      setData({
        kpis: salesInvoices
          ? buildKpis(salesInvoices, purchaseInvoices ?? [])
          : mock.kpis,
        revenueTrend: salesInvoices
          ? buildRevenueTrend(salesInvoices)
          : mock.revenueTrend,
        pendingTasks: (salesInvoices && purchaseOrders && shipments)
          ? buildPendingTasks(salesInvoices, purchaseInvoices, purchaseOrders, shipments)
          : mock.pendingTasks,
        recentMessages: mockRecentMessages,
      });
    } catch (err) {
      console.warn('[dashboard] Unexpected error, using mock data:', err.message);
      setData(buildMockFallback());
    } finally {
      setLoading(false);
    }
  }, [token, apiBase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resolved = data ?? buildMockFallback();

  return {
    kpis: resolved.kpis,
    revenueTrend: resolved.revenueTrend,
    pendingTasks: resolved.pendingTasks,
    recentMessages: resolved.recentMessages,
    actions,
    loading,
    refresh: fetchData,
  };
}

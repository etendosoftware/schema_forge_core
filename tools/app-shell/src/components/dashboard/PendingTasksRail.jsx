import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileText, Truck, DollarSign, CreditCard, ShoppingBag, Box, Circle } from 'lucide-react';
import { useUI } from '@/i18n';
import { resolveDashboardNavigation } from '@/lib/dashboardNavigation.js';

const CATEGORY_MAP = {
  overdueInvoices:               { category: 'sales',       icon: FileText,    statusKey: 'pendingStatusOverdueInvoices',  labelKey: 'salesCategory'       },
  overdueInvoices_plural:        { category: 'sales',       icon: FileText,    statusKey: 'pendingStatusOverdueInvoices',  labelKey: 'salesCategory'       },
  pendingSalesDeliveries:        { category: 'sales',       icon: Truck,       statusKey: 'pendingStatusPendingShipment',  labelKey: 'salesCategory'       },
  pendingSalesDeliveries_plural: { category: 'sales',       icon: Truck,       statusKey: 'pendingStatusPendingShipment',  labelKey: 'salesCategory'       },
  collectionsDueToday:           { category: 'collections', icon: DollarSign,  statusKey: 'pendingStatusUnreconciled',     labelKey: 'collectionsCategory' },
  collectionsDueToday_plural:    { category: 'collections', icon: DollarSign,  statusKey: 'pendingStatusUnreconciled',     labelKey: 'collectionsCategory' },
  paymentsDueToday:              { category: 'payments',    icon: CreditCard,  statusKey: 'pendingStatusPendingReception', labelKey: 'paymentsCategory'    },
  paymentsDueToday_plural:       { category: 'payments',    icon: CreditCard,  statusKey: 'pendingStatusPendingReception', labelKey: 'paymentsCategory'    },
  pendingReceptions:             { category: 'purchases',   icon: ShoppingBag, statusKey: 'pendingStatusPendingReception', labelKey: 'purchasesCategory'   },
  pendingReceptions_plural:      { category: 'purchases',   icon: ShoppingBag, statusKey: 'pendingStatusPendingReception', labelKey: 'purchasesCategory'   },
  lowStockAlert:                 { category: 'stock',       icon: Box,         statusKey: 'pendingStatusLowStock',         labelKey: 'stockCategory'       },
  lowStockAlerts:                { category: 'stock',       icon: Box,         statusKey: 'pendingStatusLowStock',         labelKey: 'stockCategory'       },
};

const STATUS_BADGE_STYLES = {
  sales:       { backgroundColor: '#FEF0F4', color: '#D50B3E', borderColor: '#FBB1C4' },
  collections: { backgroundColor: '#FFF9EB', color: '#8A6100', borderColor: '#FFDA85' },
  payments:    { backgroundColor: '#FFF9EB', color: '#8A6100', borderColor: '#FFDA85' },
  purchases:   { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' },
  stock:       { backgroundColor: '#FFF7ED', color: '#C2410C', borderColor: '#FED7AA' },
  other:       { backgroundColor: '#F5F7F9', color: '#6C6C89', borderColor: '#E8EAEF' },
};

function resolveTaskMeta(task) {
  const key = task.taskKey;
  const meta = key && CATEGORY_MAP[key];
  if (meta) return meta;
  console.warn('[PendingTasksRail] Unknown taskKey:', key, task);
  return { category: 'other', icon: Circle, statusKey: null, labelKey: null };
}

export function PendingTasksRail({ tasks = [] }) {
  const ui = useUI();
  const railRef = useRef(null);

  const scroll = (dir) => {
    railRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });
  };

  return (
    <div className="rounded-xl border overflow-hidden bg-white flex flex-col h-full">
      {/* Cabecera: #F5F7F9 bg, 48px, border-bottom #E8EAEF, padding 8px 12px */}
      <div
        className="flex items-center justify-between border-b"
        style={{ backgroundColor: '#F5F7F9', borderBottomColor: '#E8EAEF', padding: '8px 12px', minHeight: '48px' }}
      >
        <span className="text-xs font-medium uppercase" style={{ color: '#282833', letterSpacing: 0 }}>
          {ui('pendingTasksTitle')}
        </span>
        {tasks.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scroll(-1)}
              className="h-7 w-7 rounded-full border bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" style={{ color: '#6C6C89' }} />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              className="h-7 w-7 rounded-full border bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" style={{ color: '#6C6C89' }} />
            </button>
          </div>
        )}
      </div>

      {/* Cards rail */}
      <div className="p-3">
        {tasks.length === 0 ? (
          <p className="text-sm p-1" style={{ color: '#828FA3' }}>{ui('noDataAvailable')}</p>
        ) : (
          <div
            ref={railRef}
            className="flex gap-3 overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {tasks.map((task, i) => {
              const meta = resolveTaskMeta(task);
              const Icon = meta.icon;
              const target = resolveDashboardNavigation(task.navigation) || task.link || '/dashboard';
              const categoryLabel = meta.labelKey ? ui(meta.labelKey) : task.text;
              const statusLabel   = meta.statusKey ? ui(meta.statusKey) : task.text;
              const badgeStyle    = STATUS_BADGE_STYLES[meta.category] || STATUS_BADGE_STYLES.other;

              return (
                <Link
                  key={i}
                  to={target}
                  className="flex-none flex flex-col rounded-lg border hover:shadow-sm transition-shadow"
                  style={{ width: '185px', height: '154px', backgroundColor: '#FFFFFF', borderColor: '#E8EAEF' }}
                >
                  {/* Cabecera de tarjeta: 44px fijo, padding top 4px / right 4px / left 16px, gap 10px */}
                  <div
                    className="flex items-center shrink-0"
                    style={{ height: '44px', paddingTop: '4px', paddingRight: '4px', paddingLeft: '16px', gap: '10px' }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'rgba(18,18,23,0.05)' }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: '#3F3F50' }} />
                    </div>
                    <span className="text-sm font-normal truncate" style={{ color: '#3F3F50' }}>
                      {categoryLabel}
                    </span>
                  </div>

                  {/* Contenido: fill ~110px, padding 0 16px 16px 16px, número arriba, badge abajo */}
                  <div
                    className="flex flex-col justify-between flex-1"
                    style={{ padding: '0 16px 16px 16px' }}
                  >
                    <p className="text-5xl font-bold tabular-nums leading-none" style={{ color: '#121217' }}>
                      {task.count ?? 0}
                    </p>
                    <span
                      className="inline-flex self-start items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
                      style={badgeStyle}
                    >
                      {statusLabel}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

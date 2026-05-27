// Shared UI primitives for the Fiscal Monitor.
import { useRef, useEffect } from 'react';
import { useUI } from '@/i18n';
import { TriangleAlert, ArrowUpRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const ERROR_STATUSES = new Set([
  'IN', 'EE', 'AE',                            // SII
  'Rechazado', 'Error',                         // TBAI
  'rejected', 'invalid', 'partiallyAccepted',   // Verifactu
]);
export const isErrorStatus = (estado) => ERROR_STATUSES.has(estado);

export const PENDING_STATUSES = new Set([
  'PE',        // SII
  'Pendiente', // TBAI
]);
export const isPendingStatus = (estado) => PENDING_STATUSES.has(estado);

const STATUS_CONFIG = {
  // SII — API returns 2-letter codes from AD_Ref_List
  CO: { cls: 'success', labelKey: 'fiscalMonitor.status.sii.CO' },
  AE: { cls: 'warn',    labelKey: 'fiscalMonitor.status.sii.AE' },
  IN: { cls: 'danger',  labelKey: 'fiscalMonitor.status.sii.IN' },
  PE: { cls: 'pending', labelKey: 'fiscalMonitor.status.sii.PE' },
  EE: { cls: 'danger',  labelKey: 'fiscalMonitor.status.sii.EE' },
  AN: { cls: 'neutral', labelKey: 'fiscalMonitor.status.sii.AN' },
  BA: { cls: 'neutral', labelKey: 'fiscalMonitor.status.sii.BA' },
  NR: { cls: 'neutral', labelKey: 'fiscalMonitor.status.sii.NR' },
  // TBAI — reuse existing tbai.status.* keys
  Recibido:           { cls: 'success', labelKey: 'fiscalMonitor.tbai.status.Recibido' },
  Rechazado:          { cls: 'danger',  labelKey: 'fiscalMonitor.tbai.status.Rechazado' },
  Error:              { cls: 'danger',  labelKey: 'fiscalMonitor.tbai.status.Error' },
  Pendiente:          { cls: 'pending', labelKey: 'fiscalMonitor.tbai.status.Pendiente' },
  // Verifactu
  accepted:           { cls: 'success', labelKey: 'fiscalMonitor.status.vf.accepted' },
  partiallyAccepted:  { cls: 'warn',    labelKey: 'fiscalMonitor.status.vf.partiallyAccepted' },
  rejected:           { cls: 'danger',  labelKey: 'fiscalMonitor.status.vf.rejected' },
  invalid:            { cls: 'danger',  labelKey: 'fiscalMonitor.status.vf.invalid' },
};

export const StatusPill = ({ estado, onClick, title: titleProp }) => {
  const ui = useUI();
  const cfg = STATUS_CONFIG[estado];
  const cls  = cfg?.cls  ?? 'pending';
  const text = cfg ? ui(cfg.labelKey) : (estado ?? '—');
  if (onClick) {
    return (
      <button
        type="button"
        className={`fm-pill ${cls}`}
        data-testid="status-pill"
        data-status={cls}
        onClick={onClick}
        title={titleProp ?? ui('fiscalMonitor.viewContact')}
      >
        {text}
      </button>
    );
  }
  return <span className={`fm-pill ${cls}`} data-testid="status-pill" data-status={cls}>{text}</span>;
};

export const NumFactura = ({ n, onOpen }) => {
  const ui = useUI();
  return (
    <a
      href="#"
      className="fm-num-factura-link"
      onClick={(e) => { e.preventDefault(); onOpen && onOpen(n); }}
      title={ui('fiscalMonitor.openInvoice')}
    >
      {n}
      <ArrowUpRight size={14} strokeWidth={2} className="fm-num-factura-arrow" />
    </a>
  );
};

/**
 * Invisible sentinel element — when it enters the viewport the parent should
 * load the next page. Matches the infinite-scroll pattern used by ListView.jsx.
 */
export const ScrollSentinel = ({ onVisible, hasMore, loading }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !hasMore || loading) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onVisible?.(); },
      { rootMargin: '200px' }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [hasMore, loading, onVisible]);
  return <div ref={ref} style={{ height: 1 }} />;
};

/** @deprecated use ScrollSentinel instead */
export const Pager = () => null;

export const RowActionBtn = ({ onClick, title }) => (
  <button className="fm-icon-btn row-action" onClick={onClick} title={title}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  </button>
);

export const PAGE_SIZE = 20;

export { fmtDate } from './fmtDateUtils.js';

export const WipBadge = ({ inline = false }) => {
  const ui = useUI();
  return (
    <div className={inline ? '' : 'absolute top-3 right-4 z-10'}>
      <TooltipProvider delayDuration={600}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 cursor-default select-none">
              <TriangleAlert size={12} strokeWidth={2} /> {ui('fiscal.wip.badge')}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[260px] text-center">
            {ui('fiscal.wip.tooltip')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

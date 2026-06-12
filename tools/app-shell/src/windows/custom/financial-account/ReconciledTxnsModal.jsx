import { useNavigate } from 'react-router-dom';
import { Layers, ArrowUpRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useUI, useLocaleSwitch } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoneyAmount } from '@/components/ui/money-amount';
import { cn } from '@/lib/utils';
import { PostingStatusDot } from './PostingStatusDot';

// Columns of the movements table — mirrors the Movimientos tab:
//   Fecha · Pago · Contacto · Descripción · Tipo(+estado) · Importe · (ir →)
const TXN_GRID =
  'grid grid-cols-[88px_92px_minmax(96px,1fr)_minmax(140px,1.5fr)_130px_110px_44px] items-center gap-3';

function formatDate(iso, bcpLocale) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  // Date-only value sent as UTC midnight — format in UTC so a negative-offset
  // timezone doesn't shift it to the previous day.
  return new Intl.DateTimeFormat(bcpLocale, {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(d);
}

function formatSigned(amount, currency) {
  const abs = Math.abs(Number(amount) || 0);
  const formatted = new Intl.NumberFormat('es-ES', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(abs);
  return (Number(amount) < 0 ? '-' : '+') + formatted;
}

function trxTypeLabel(trxType, ui) {
  if (trxType === 'BPD') return ui('financeAccountMovementsTypeBPD');
  if (trxType === 'BPW') return ui('financeAccountMovementsTypeBPW');
  if (trxType === 'BF') return ui('financeAccountMovementsTypeBF');
  return trxType || '—';
}

/**
 * Modal listing the financial-account transaction(s) a statement line was
 * reconciled with. Works for 1 or N transactions (today the backend returns at
 * most 1; the layout already supports N for the upcoming 1:N reconciliation).
 *
 * Built on the shared {@link Dialog} (no raw scrim/portal). The line's net
 * amount is compared against the sum of the transactions to show whether the
 * reconciliation balances.
 *
 * @param {{ line: object|null, currency?: string, onClose: () => void }} props
 */
export function ReconciledTxnsModal({ line, currency = 'EUR', onClose }) {
  const ui = useUI();
  const { locale: appLocale } = useLocaleSwitch();
  const bcpLocale = (appLocale || 'es_ES').replace('_', '-');
  const navigate = useNavigate();

  const open = line != null;
  const txns = (line && line.txns) || [];
  const lineNet = line ? (Number(line.in) || 0) - (Number(line.out) || 0) : 0;
  const txnSum = txns.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const diff = Number((lineNet - txnSum).toFixed(2));
  const balanced = Math.abs(diff) < 0.005;

  const contact = line ? (line.bpartnerFkName || line.bpartnerName || '') : '';

  const goToMovement = (t) => {
    if (!t.paymentId) return;
    const win = t.paymentIsReceipt === 'Y' ? 'payment-in' : 'payment-out';
    onClose();
    navigate(`/${win}/${t.paymentId}`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[92vw] max-w-[900px] overflow-hidden p-0" data-testid="reconciled-txns-modal">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-[#E8EAEF] px-6 pb-4 pt-5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#F5F7F9] text-[#121217]">
            <Layers className="h-5 w-5" />
          </span>
          <DialogTitle className="m-0 text-[17px] font-bold leading-[22px] tracking-[-0.01em] text-[#121217]">
            {ui('financeAccountStatementLinesTxnModalTitle')}
          </DialogTitle>
        </div>

        {/* Statement-line banner */}
        {line ? (
          <div className="mx-6 mt-4 flex items-center justify-between gap-4 rounded-lg border border-[#E8EAEF] bg-[#F8F9FB] px-3.5 py-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase leading-[14px] tracking-[0.06em] text-[#A8AAB8]">
                {ui('financeAccountStatementLinesTxnModalLineLabel')}
              </div>
              <div className="mt-0.5 truncate text-sm font-semibold leading-[19px] text-[#121217]">
                {line.description || contact || '—'}
              </div>
              <div className="mt-0.5 text-xs leading-4 text-[#6C6C89]">
                {formatDate(line.date, bcpLocale)}
                {contact ? ` · ${contact}` : ''}
                {line.reference ? ` · ref ${line.reference}` : ''}
              </div>
            </div>
            <MoneyAmount
              value={lineNet}
              currency={currency}
              tone="auto"
              className="whitespace-nowrap text-lg font-bold tabular-nums"
            />
          </div>
        ) : null}

        {/* Movements list */}
        <div className="max-h-[56vh] overflow-y-auto px-6 py-4">
          <div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase leading-4 tracking-[0.05em] text-[#6C6C89]">
            {ui('financeAccountStatementLinesTxnModalAssociated')}
            <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#F5F7F9] px-1.5 text-[11px] font-semibold text-[#6C6C89]">
              {txns.length}
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#E8EAEF]">
            {/* head */}
            <div className={cn(TXN_GRID, 'min-h-[38px] border-b border-[#E8EAEF] bg-[#F8F9FB] px-3.5 text-[10px] font-semibold uppercase leading-[14px] tracking-[0.05em] text-[#6C6C89]')}>
              <span>{ui('financeAccountMovementsColDate')}</span>
              <span>{ui('financeAccountMovementsColDocument')}</span>
              <span>{ui('financeAccountMovementsColContact')}</span>
              <span>{ui('financeAccountMovementsColDescription')}</span>
              <span>{ui('financeAccountMovementsColType')}</span>
              <span className="justify-self-end">{ui('financeAccountMovementsColAmount')}</span>
              <span aria-hidden="true" />
            </div>
            {/* rows */}
            {txns.map((t) => (
              <div
                key={t.paymentId || t.documentNo}
                data-testid={`reconciled-txn-row-${t.documentNo}`}
                className={cn(TXN_GRID, 'min-h-[56px] border-b border-[#E8EAEF] px-3.5 text-sm text-[#121217] last:border-0 hover:bg-[#F8F9FB]')}
              >
                <span>{formatDate(t.date, bcpLocale)}</span>
                <span className="font-semibold">{t.documentNo || '—'}</span>
                <span className="truncate" title={t.contact || ''}>{t.contact || <span className="text-[#A8AAB8]">—</span>}</span>
                <span className="truncate" title={t.description || ''}>{t.description || <span className="text-[#A8AAB8]">—</span>}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="leading-[17px]">{trxTypeLabel(t.trxType, ui)}</span>
                  <PostingStatusDot paymentStatus={t.paymentStatus} />
                </span>
                <MoneyAmount
                  value={t.amount}
                  currency={currency}
                  tone="auto"
                  className="justify-self-end whitespace-nowrap text-sm font-semibold tabular-nums"
                />
                <span className="flex justify-center">
                  {t.paymentId ? (
                    <button
                      type="button"
                      title={ui('financeAccountStatementLinesTxnGoToMovement')}
                      aria-label={ui('financeAccountStatementLinesTxnGoToMovement')}
                      data-testid={`reconciled-txn-go-${t.documentNo}`}
                      onClick={() => goToMovement(t)}
                      className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border border-[#E8EAEF] bg-white text-[#6C6C89] hover:border-[#D1D4DB] hover:bg-[#F5F7F9] hover:text-[#121217]"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer — reconciliation summary */}
        <div className="flex items-center justify-between gap-4 border-t border-[#E8EAEF] bg-[#F8F9FB] px-6 py-3.5">
          <div className="flex items-center gap-5">
            <div className="flex flex-col gap-px">
              <span className="text-[11px] font-medium uppercase leading-[14px] tracking-[0.03em] text-[#6C6C89]">
                {ui('financeAccountStatementLinesTxnFootLineAmount')}
              </span>
              <MoneyAmount value={lineNet} currency={currency} tone="neutral" className="text-[15px] font-semibold tabular-nums" />
            </div>
            <div className="flex flex-col gap-px">
              <span className="text-[11px] font-medium uppercase leading-[14px] tracking-[0.03em] text-[#6C6C89]">
                {ui('financeAccountStatementLinesTxnFootSum')}
              </span>
              <MoneyAmount value={txnSum} currency={currency} tone="neutral" className="text-[15px] font-semibold tabular-nums" />
            </div>
          </div>
          {balanced ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#E8F6EE] px-3 text-xs font-semibold text-[#1E874C]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {ui('financeAccountStatementLinesTxnBalanced')}
            </span>
          ) : (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#FBF1DD] px-3 text-xs font-semibold text-[#A8670B]">
              <AlertTriangle className="h-3.5 w-3.5" />
              {ui('financeAccountStatementLinesTxnDiff', { amount: formatSigned(diff, currency) })}
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

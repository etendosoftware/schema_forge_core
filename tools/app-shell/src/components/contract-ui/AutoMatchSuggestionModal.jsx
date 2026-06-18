import { useState, useMemo, useCallback } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useUI } from '@/i18n';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { MoneyAmount } from '@/components/ui/money-amount';
import { useApplySuggestions } from '@/hooks/useReconciliation';
import { cn } from '@/lib/utils';

const ORIGIN_RULE = 'rule';

function GroupBadge({ origin, ruleName, isNew }) {
  const ui = useUI();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {origin === ORIGIN_RULE && (
        <span className="inline-flex items-center rounded-full bg-[#FFF8E6] px-2 py-0.5 text-xs font-medium text-[#92600A]">
          {ui('financeReconcileAutomatchBadgeByRule')} {ruleName}
        </span>
      )}
      {isNew && (
        <span className="inline-flex items-center rounded-full bg-[#EAF2FF] px-2 py-0.5 text-xs font-medium text-[#1B4FD6]">
          {ui('financeReconcileAutomatchBadgeNew')}
        </span>
      )}
    </div>
  );
}

function GroupRow({ group, checked, onToggle, currency }) {
  const ui = useUI();
  const line = group.statementLine ?? {};
  const ops = group.operations ?? [];
  const diff = Number(group.difference ?? 0);
  const hasDiff = Math.abs(diff) >= 0.005;

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        checked ? 'border-[#1B4FD6] bg-[#F6F8FF]' : 'border-[#E8EAEF] bg-white',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(group.groupKey)}
          data-testid={`automatch-group-check-${group.groupKey}`}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-[#1B4FD6]"
        />

        <div className="flex-1 overflow-hidden">
          {/* Statement line */}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#A8AAB8]">
                {ui('financeReconcileColDescription')}
              </div>
              <div className="mt-0.5 truncate text-sm font-semibold text-[#121217]">
                {line.description || line.referenceNo || '—'}
              </div>
            </div>
            <div className="flex-none text-right">
              <MoneyAmount value={Number(line.amount ?? 0)} currency={currency} tone="auto" />
            </div>
          </div>

          {/* Badges */}
          <div className="mt-2">
            <GroupBadge origin={group.origin} ruleName={group.ruleName} isNew={group.isNew} />
          </div>

          {/* Operations */}
          {ops.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-[#E8EAEF] pt-3">
              {ops.map((op, i) => (
                <div
                  key={op.id ?? i}
                  className="flex items-center justify-between gap-2 rounded-md bg-[#F8F9FB] px-3 py-2 text-xs"
                >
                  <span className="truncate text-[#3A3A52]">
                    {op.isNew
                      ? ui('financeReconcileAutomatchOpNew')
                      : (op.documentNo || op.id)}
                  </span>
                  <span className="flex-none">
                    <MoneyAmount value={Number(op.amount ?? 0)} currency={currency} tone="auto" compact />
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Difference warning */}
          {hasDiff && (
            <div className="mt-2 flex items-center gap-1 text-xs text-[#C24B00]">
              <AlertTriangle className="h-3.5 w-3.5 flex-none" />
              <span>{ui('financeReconcileAutomatchDifference')} <MoneyAmount value={diff} currency={currency} tone="negative" compact /></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Modal that shows the automatch preview and lets the user accept/reject groups.
 * On confirm, calls `applySuggestions` for the checked groups.
 *
 * @param {{ accountId: string, groups: Array<object>, kpis: object, currency?: string,
 *           open: boolean, onClose: () => void, onSuccess?: () => void }} props
 */
export function AutoMatchSuggestionModal({
  accountId,
  groups = [],
  kpis = {},
  currency = 'EUR',
  open,
  onClose,
  onSuccess,
}) {
  const ui = useUI();
  const { apply, loading } = useApplySuggestions();

  const [checked, setChecked] = useState(() => new Set(groups.map((g) => g.groupKey)));

  const checkedGroups = useMemo(
    () => groups.filter((g) => checked.has(g.groupKey)),
    [groups, checked],
  );

  const onToggle = useCallback((groupKey) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const handleApply = async () => {
    if (checkedGroups.length === 0) return;
    try {
      const payload = {
        financialAccountId: accountId,
        groups: checkedGroups.map((g) => ({
          statementLineId: g.statementLine?.id,
          operationIds: (g.operations ?? []).filter((o) => !o.isNew).map((o) => o.id),
          ...(g.createPayment ? { createPayment: g.createPayment } : {}),
        })),
      };
      await apply(payload);
      toast.success(ui('financeReconcileAutomatchToastSuccess', { count: checkedGroups.length }));
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err?.message || ui('financeReconcileAutomatchToastError'));
    }
  };

  const willCreate = checkedGroups.filter((g) => g.isNew).length;
  const willLink = checkedGroups.filter((g) => !g.isNew).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="w-[96vw] max-w-[900px] overflow-hidden p-0"
        data-testid="automatch-suggestion-modal"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-[#E8EAEF] px-6 pb-4 pt-5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#F5F7F9] text-[#121217]">
            <Sparkles className="h-5 w-5" />
          </span>
          <DialogTitle className="m-0 text-[17px] font-bold leading-[22px] tracking-[-0.01em] text-[#121217]">
            {ui('financeReconcileAutomatchModalTitle')}
          </DialogTitle>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-px border-b border-[#E8EAEF] bg-[#E8EAEF]">
          {[
            { label: ui('financeReconcileAutomatchKpiPending'), value: kpis.pendingLines ?? 0 },
            { label: ui('financeReconcileAutomatchKpiGroups'), value: kpis.groupsFound ?? 0 },
            { label: ui('financeReconcileAutomatchKpiOps'), value: kpis.opsToLink ?? 0 },
            { label: ui('financeReconcileAutomatchKpiNew'), value: kpis.willCreate ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center gap-0.5 bg-white px-4 py-3">
              <span className="text-xl font-bold leading-6 text-[#121217]">{value}</span>
              <span className="text-[11px] leading-[14px] text-[#6C6C89]">{label}</span>
            </div>
          ))}
        </div>

        {/* Groups list */}
        <div className="max-h-[50vh] space-y-3 overflow-y-auto px-6 py-4">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#6C6C89]">
              {ui('financeReconcileAutomatchEmpty')}
            </p>
          ) : (
            groups.map((group) => (
              <GroupRow
                key={group.groupKey}
                group={group}
                checked={checked.has(group.groupKey)}
                onToggle={onToggle}
                currency={currency}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#E8EAEF] px-6 py-4">
          {/* Summary */}
          <p className="text-sm text-[#3A3A52]">
            {checkedGroups.length > 0 ? (
              <>
                {willLink > 0 && <span>{ui('financeReconcileAutomatchFooterLink', { count: willLink })} </span>}
                {willCreate > 0 && <span>{ui('financeReconcileAutomatchFooterCreate', { count: willCreate })}</span>}
              </>
            ) : (
              <span className="text-[#6C6C89]">{ui('financeReconcileAutomatchFooterNone')}</span>
            )}
          </p>

          {/* Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              data-testid="automatch-modal-cancel"
              className="h-10 rounded-lg border border-[#D1D4DB] bg-white px-4 text-sm font-medium text-[#121217] hover:bg-[#F5F7F9]"
            >
              {ui('financeReconcileActionCancel')}
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={checkedGroups.length === 0 || loading}
              data-testid="automatch-modal-apply"
              className={cn(
                'h-10 rounded-lg px-4 text-sm font-medium transition-colors',
                checkedGroups.length > 0 && !loading
                  ? 'bg-[#1B4FD6] text-white hover:bg-[#1641B3]'
                  : 'cursor-not-allowed bg-[#D1D4DB] text-[#6C6C89]',
              )}
            >
              {loading
                ? ui('loading')
                : ui('financeReconcileAutomatchActionApply', { count: checkedGroups.length })}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Copy, RefreshCw, Unlink2, Archive, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUI } from '@/i18n';
import { usePsd2Actions, launchSaltEdgePopup } from '@/hooks/usePsd2Actions';
import { DateInput, Field } from '@/components/forms/fields';
import { CreatableSearchSelect } from '@/components/contract-ui/CreatableSearchSelect';
import { ACCOUNT_TYPE } from '@/components/financial-accounts/tokens';

const GROUPING_OPTIONS = ['1BD', '1BW', '1BM', '1BE'];

/**
 * Dedicated "Edit PSD2 connection" modal (ETP-4097 / T3), opened from the account row kebab when an
 * account is connected. Mirrors the Figma layout: read-only account context on top, then the live
 * bank-connection section with Sync, the PSD2 import settings (Import from/to + Statement grouping
 * — Figma's "Periodicidad"/"Auto-Conciliación" are intentionally omitted), a re-authorization
 * banner, and the footer actions (Archive / Disconnect / Cancel / Save changes).
 *
 * @param {{
 *   open: boolean,
 *   account: object,
 *   onClose: () => void,
 *   onSaved?: () => void,
 *   onArchive?: (account: object) => void,
 * }} props
 */
export function EditPsd2ConnectionModal({ open, account, onClose, onSaved, onArchive }) {
  const ui = useUI();
  const { fetchStatus, sync, disconnect, reconnect, saveImportSettings } = usePsd2Actions();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ importFromDate: '', importToDate: '', statementGrouping: '' });
  const [initial, setInitial] = useState({ importFromDate: '', importToDate: '', statementGrouping: '' });

  const refresh = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const data = await fetchStatus(account.id);
      setStatus(data);
      const values = {
        importFromDate: data.importFromDate ?? '',
        importToDate: data.importToDate ?? '',
        statementGrouping: data.statementGrouping ?? '',
      };
      setForm(values);
      setInitial(values);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [account, fetchStatus]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  if (!account) return null;

  const runBusy = async (fn, successKey, closeAfter) => {
    setBusy(true);
    try {
      await fn();
      if (successKey) toast.success(ui(successKey));
      onSaved?.();
      if (closeAfter) onClose?.();
    } catch (err) {
      toast.error(err.message === 'PSD2_TIMEOUT' ? ui('financeAccountsPsd2Timeout') : err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSync = () => runBusy(async () => { await sync(account.id); await refresh(); }, 'financeAccountsPsd2SyncDone');
  const handleReconnect = () => runBusy(async () => {
    await launchSaltEdgePopup(() => reconnect(account.id));
    await refresh();
  }, 'financeAccountsPsd2ReauthDone');
  const handleSave = () => runBusy(
    () => saveImportSettings({ financialAccountId: account.id, ...form }),
    'financeAccountsPsd2ImportSaved',
    true,
  );
  const handleDisconnect = () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(ui('financeAccountsPsd2DisconnectConfirm'))) return;
    runBusy(() => disconnect(account.id), 'financeAccountsPsd2DisconnectDone', true);
  };

  const copyIban = async () => {
    try {
      await navigator.clipboard.writeText((account.iban || '').replace(/\s+/g, ''));
      toast.success(ui('financeAccountsPsd2IbanCopied'));
    } catch { /* ignore */ }
  };

  const typeLabel = {
    [ACCOUNT_TYPE.BANK]: ui('financeAccountsNewTypeBank'),
    [ACCOUNT_TYPE.CASH]: ui('financeAccountsNewTypeCash'),
    [ACCOUNT_TYPE.CARD]: ui('financeAccountsNewTypeCard'),
  }[account.type] || account.type;

  const connected = status?.connected === true;
  const daysLeft = status?.daysUntilExpires;
  const showReauth = connected && !!status?.consentExpiresAt;
  const reauthMessage = showReauth
    ? (typeof daysLeft === 'number' && daysLeft <= 0
      ? ui('financeAccountsPsd2ReauthExpired', { date: formatDate(status.consentExpiresAt) })
      : ui('financeAccountsPsd2ReauthBanner', { days: daysLeft, date: formatDate(status.consentExpiresAt) }))
    : '';
  const dirty = form.importFromDate !== initial.importFromDate
    || form.importToDate !== initial.importToDate
    || form.statementGrouping !== initial.statementGrouping;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }} data-testid="Dialog__psd2edit">
      <DialogContent className="max-w-[1020px] bg-white" data-testid="edit-psd2-connection-modal">
        <DialogHeader data-testid="DialogHeader__psd2edit">
          <DialogTitle className="text-xl leading-7" data-testid="DialogTitle__psd2edit">
            {ui('financeAccountsPsd2EditTitle')}
          </DialogTitle>
        </DialogHeader>

        {/* Read-only account context */}
        <div className="grid grid-cols-1 gap-4 border-b border-[#E8EAEF] pb-4 sm:grid-cols-2">
          <ReadField
            label={ui('financeAccountsPsd2FieldName')}
            value={account.name}
            data-testid="ReadField__85ceec" />
          <ReadField
            label={ui('financeAccountsPsd2FieldType')}
            value={typeLabel}
            data-testid="ReadField__85ceec" />
          <ReadField
            label={ui('financeAccountsPsd2FieldIban')}
            value={account.iban}
            onCopy={account.iban ? copyIban : undefined}
            data-testid="ReadField__85ceec" />
          <ReadField
            label={ui('financeAccountsPsd2FieldCurrency')}
            value={account.currencyIso}
            data-testid="ReadField__85ceec" />
        </div>

        {/* Bank connection */}
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-semibold leading-5 text-[#121217]">{ui('financeAccountsEditConnectionSection')}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-[#282833]">{ui('financeAccountsPsd2AutoSyncSubtitle')}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-normal ${
                connected ? 'bg-[#EEFBF4] text-[#17663A]' : 'bg-[#F5F7F9] text-[#6C6C89]'
              }`}>
                {connected ? `✓ ${ui('financeAccountsPsd2StatusConnected')}` : ui('financeAccountsPsd2StatusDisconnected')}
              </span>
            </div>
          </div>

          {loading ? (
            <p className="text-xs text-[#6C6C89]">{ui('financeAccountsPsd2Loading')}</p>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg bg-[#F5F7F9] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#121217]">
                  {status?.providerName || ui('financeAccountsPsd2StatusConnected')}
                </span>
                <button
                  type="button"
                  disabled={busy || !connected}
                  onClick={handleSync}
                  data-testid="psd2-edit-sync"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D1D4DB] bg-white px-3 py-1.5 text-sm font-medium text-[#121217] shadow-[0_1px_2px_rgba(18,18,23,0.05)] hover:bg-[#F5F7F9] disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4 text-[#828FA3]" data-testid="RefreshCw__85ceec" />
                  {ui('financeAccountsMenuSyncNow')}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <DateInput
                  label={ui('financeAccountsPsd2ImportFrom')}
                  name="psd2-import-from"
                  value={form.importFromDate || ''}
                  onChange={(v) => setForm((f) => ({ ...f, importFromDate: v }))}
                  data-testid="DateInput__85ceec" />
                <DateInput
                  label={ui('financeAccountsPsd2ImportTo')}
                  name="psd2-import-to"
                  value={form.importToDate || ''}
                  onChange={(v) => setForm((f) => ({ ...f, importToDate: v }))}
                  data-testid="DateInput__85ceec" />
                <Field label={ui('financeAccountsPsd2Grouping')} data-testid="Field__85ceec">
                  {/* White wrapper: the picker's box is bg-transparent (built for white cards),
                      so on this gray card it blends in — the white backing makes it stand out. */}
                  <div className="rounded-lg bg-white">
                    <CreatableSearchSelect
                      field={{ name: 'statementGrouping' }}
                      value={form.statementGrouping || ''}
                      displayValue={form.statementGrouping
                        ? ui(`financeAccountsPsd2Grouping_${form.statementGrouping}`) : ''}
                      onChange={(id) => setForm((f) => ({ ...f, statementGrouping: id || '' }))}
                      formData={form}
                      resolvedLabel={ui('financeAccountsPsd2Grouping')}
                      emptyOptionLabel={ui('financeAccountsPsd2GroupingNone')}
                      staticOptions={GROUPING_OPTIONS.map((o) => ({
                        id: o, name: ui(`financeAccountsPsd2Grouping_${o}`),
                      }))}
                      data-testid="psd2-edit-grouping" />
                  </div>
                </Field>
              </div>

              {showReauth ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-[#FFF9EB] px-3 py-3" data-testid="psd2-edit-reauth-banner">
                  <span className="flex items-center gap-2 text-sm font-medium text-[#8A6100]">
                    <AlertTriangle
                      className="h-4 w-4 shrink-0 text-[#C28800]"
                      data-testid="AlertTriangle__85ceec" />
                    {reauthMessage}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleReconnect}
                    data-testid="psd2-edit-reauth-link"
                    className="shrink-0 text-sm font-medium text-[#8A6100] underline disabled:opacity-50"
                  >
                    {ui('financeAccountsPsd2Reauth')}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <FooterButton
              icon={Archive}
              label={ui('financeAccountsPsd2EditArchive')}
              onClick={() => onArchive?.(account)}
              disabled={busy}
              danger
              data-testid="FooterButton__85ceec" />
            <FooterButton
              icon={Unlink2}
              label={ui('financeAccountsMenuDisconnect')}
              onClick={handleDisconnect}
              disabled={busy || !connected}
              data-testid="FooterButton__85ceec" />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              data-testid="psd2-edit-cancel"
              className="rounded-full border border-[#D1D4DB] bg-white px-4 py-2 text-sm font-medium text-[#121217] shadow-[0_1px_2px_rgba(18,18,23,0.05)] hover:bg-[#F5F7F9]"
            >
              {ui('cancel')}
            </button>
            <button
              type="button"
              disabled={busy || !dirty}
              onClick={handleSave}
              data-testid="psd2-edit-save"
              className="rounded-full bg-[#121217] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#FFD500] hover:text-[#121217] disabled:bg-[#D1D4DB] disabled:text-white disabled:hover:bg-[#D1D4DB] disabled:hover:text-white"
            >
              {ui('financeAccountsEditSave')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReadField({ label, value, onCopy }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium leading-6 text-[#121217]">{label}</span>
      <div className="flex h-10 items-center gap-2 rounded-lg border border-[#D1D4DB] bg-white px-3 shadow-[0_1px_2px_rgba(18,18,23,0.05)]">
        <span className="min-w-0 flex-1 truncate text-sm text-[#121217]">{value || '—'}</span>
        {onCopy ? (
          <button type="button" onClick={onCopy} aria-label="copy" className="text-[#828FA3] hover:text-[#121217]">
            <Copy className="h-4 w-4" data-testid="Copy__85ceec" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FooterButton({ icon: Icon, label, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm font-medium shadow-[0_1px_2px_rgba(18,18,23,0.05)] disabled:opacity-50 ${
        danger ? 'border-[#FBB1C4] text-[#D50B3E] hover:bg-[#FDEEF2]' : 'border-[#D1D4DB] text-[#121217] hover:bg-[#F5F7F9]'
      }`}
    >
      <Icon
        className={`h-5 w-5 ${danger ? 'text-[#D50B3E]' : 'text-[#828FA3]'}`}
        data-testid="Icon__85ceec" />
      {label}
    </button>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

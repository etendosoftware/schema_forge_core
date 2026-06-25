import { useCallback, useEffect, useState } from 'react';
import { Copy, RefreshCw, Unlink2, Archive, AlertTriangle, Plug } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useUI, useLocaleSwitch } from '@/i18n';
import { useAccountMutations } from '@/hooks/useAccountMutations.js';
import { usePsd2Actions, launchSaltEdgePopup } from '@/hooks/usePsd2Actions';
import { DateInput, Field } from '@/components/forms/fields';
import { CreatableSearchSelect } from '@/components/contract-ui/CreatableSearchSelect';
import { ACCOUNT_TYPE } from '@/components/financial-accounts/tokens';
import { isValidIban, normalizeIban } from '@/lib/validateIban.js';
import { formatCalendarDate } from '@/lib/dateOnly.js';

const GROUPING_OPTIONS = ['1BD', '1BW', '1BM', '1BE'];
const FIELD_INPUT = 'bg-white shadow-[0_1px_2px_rgba(18,18,23,0.05)]';

/**
 * Unified "Edit account" modal (ETP-4097 / T3). A single entry point that replaced the former
 * separate "Editar cuenta" and "Editar conexión PSD2" modals, since both surfaced the same account
 * data. The chrome is identical in every state — same width, the same two-column account grid
 * (Name | Type, IBAN | Currency) and the same footer (Archive / Cancel / Save changes). Only two
 * things vary with the account's PSD2 state:
 *
 * - **Field editability:** Name is always editable. When NOT connected, IBAN and Currency are
 *   editable too (full edit); when connected they are read-only (owned by the bank). Type is always
 *   read-only. Cash accounts have no IBAN and no connection section.
 * - **Connection block:** connected shows the live PSD2 panel (provider, Sync now, import dates,
 *   statement grouping, re-auth banner) and a Disconnect footer button; not connected shows a
 *   single "Connect to PSD2" button. Save persists every changed field in one go.
 *
 * @param {{
 *   open: boolean,
 *   account: object,
 *   onClose: () => void,
 *   onSaved?: () => void,
 *   onArchive?: (account: object) => void,
 *   onConnect?: (account: object) => void,
 * }} props
 */
export function EditAccountModal({ open, onClose, onSaved, account, onArchive, onConnect }) {
  const ui = useUI();
  const { locale } = useLocaleSwitch();
  const { updateAccount, fetchDefaults } = useAccountMutations();
  const { fetchStatus, sync, disconnect, reconnect, saveImportSettings } = usePsd2Actions();

  const isCash = account?.type === ACCOUNT_TYPE.CASH;
  const psd2Connected = account?.psd2Connected === true;

  // Editable account fields (Name always; IBAN/Currency when not connected).
  const [name, setName] = useState('');
  const [iban, setIban] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [ibanTouched, setIbanTouched] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Initial snapshot, to compute "dirty" and only persist what changed.
  const [snapshot, setSnapshot] = useState({ name: '', iban: '', currencyId: '' });

  // PSD2 connection panel state (connected accounts).
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ importFromDate: '', importToDate: '', statementGrouping: '' });
  const [initial, setInitial] = useState({ importFromDate: '', importToDate: '', statementGrouping: '' });

  // Seed the editable fields when the modal opens.
  useEffect(() => {
    if (!open || !account) return;
    setName(account.name ?? '');
    setIban(account.iban ?? '');
    setCurrencyId(account.currencyId ?? '');
    setSnapshot({
      name: account.name ?? '',
      iban: account.iban ?? '',
      currencyId: account.currencyId ?? '',
    });
    setIbanTouched(false);
    setError(null);
    setSaving(false);
  }, [open, account]);

  // Currency options are only needed while the currency field is editable (not connected).
  useEffect(() => {
    if (!open || psd2Connected) return undefined;
    let cancelled = false;
    fetchDefaults()
      .then((data) => {
        if (!cancelled) setCurrencies(Array.isArray(data.currencies) ? data.currencies : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, psd2Connected, fetchDefaults]);

  const refresh = useCallback(async () => {
    if (!account || !psd2Connected) return;
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
  }, [account, psd2Connected, fetchStatus]);

  useEffect(() => {
    if (open && psd2Connected) refresh();
  }, [open, psd2Connected, refresh]);

  if (!account) return null;

  const typeLabel = {
    [ACCOUNT_TYPE.BANK]: ui('financeAccountsNewTypeBank'),
    [ACCOUNT_TYPE.CASH]: ui('financeAccountsNewTypeCash'),
    [ACCOUNT_TYPE.CARD]: ui('financeAccountsNewTypeCard'),
  }[account.type] || account.type;

  const connected = status?.connected === true;
  const daysLeft = status?.daysUntilExpires;
  const showReauth = psd2Connected && connected && !!status?.consentExpiresAt;
  const reauthMessage = showReauth
    ? (typeof daysLeft === 'number' && daysLeft <= 0
      ? ui('financeAccountsPsd2ReauthExpired', { date: formatCalendarDate(status.consentExpiresAt, locale) })
      : ui('financeAccountsPsd2ReauthBanner', { days: daysLeft, date: formatCalendarDate(status.consentExpiresAt, locale) }))
    : '';

  // Editable IBAN validation (only meaningful when the field is editable).
  const ibanInvalid = !psd2Connected && !isCash && iban.trim() !== '' && !isValidIban(iban);

  const nameDirty = name.trim() !== snapshot.name.trim();
  const ibanDirty = !psd2Connected && !isCash && normalizeIban(iban) !== normalizeIban(snapshot.iban);
  const currencyDirty = !psd2Connected && currencyId !== snapshot.currencyId;
  const settingsDirty = psd2Connected && (
    form.importFromDate !== initial.importFromDate
    || form.importToDate !== initial.importToDate
    || form.statementGrouping !== initial.statementGrouping
  );
  const dirty = nameDirty || ibanDirty || currencyDirty || settingsDirty;
  const canSave = dirty && !saving && name.trim() !== '' && !ibanInvalid;

  const copyIban = async () => {
    try {
      await navigator.clipboard.writeText((account.iban || '').replace(/\s+/g, ''));
      toast.success(ui('financeAccountsPsd2IbanCopied'));
    } catch { /* ignore */ }
  };

  const handleConnectClick = () => {
    onClose?.();
    onConnect?.(account);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Account fields (name always editable; IBAN/currency only when not connected).
      const updates = {};
      if (nameDirty) updates.name = name.trim();
      if (ibanDirty) updates.iban = normalizeIban(iban);
      if (currencyDirty) updates.currencyId = currencyId;
      if (Object.keys(updates).length > 0) {
        await updateAccount(account.id, updates);
      }
      if (settingsDirty) {
        await saveImportSettings({ financialAccountId: account.id, ...form });
      }
      toast.success(ui('financeAccountsEditSuccess'));
      onSaved?.();
      onClose?.();
    } catch (err) {
      if (err.status === 409) {
        setError(ui('financeAccountsNewNameExists'));
      } else {
        toast.error(err.message || ui('financeAccountsEditError'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSaving(true);
    try {
      const res = await sync(account.id);
      await refresh();
      onSaved?.();
      const msg = res?.message;
      if (res?.status === 'ERROR') {
        toast.error(msg || ui('financeAccountsPsd2SyncError'));
      } else if (res?.status === 'WARNING') {
        toast.info(msg || ui('financeAccountsPsd2SyncDone'));
      } else {
        toast.success(msg || ui('financeAccountsPsd2SyncDone'));
      }
    } catch (err) {
      toast.error(err.message === 'PSD2_TIMEOUT' ? ui('financeAccountsPsd2Timeout') : err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReconnect = async () => {
    setSaving(true);
    try {
      await launchSaltEdgePopup(() => reconnect(account.id));
      await refresh();
      onSaved?.();
      toast.success(ui('financeAccountsPsd2ReauthDone'));
    } catch (err) {
      toast.error(err.message === 'PSD2_TIMEOUT' ? ui('financeAccountsPsd2Timeout') : err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(ui('financeAccountsPsd2DisconnectConfirm'))) return;
    setSaving(true);
    try {
      await disconnect(account.id);
      toast.success(ui('financeAccountsPsd2DisconnectDone'));
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.message || ui('financeAccountsPsd2DisconnectError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => { if (!value) onClose?.(); }}
      data-testid="Dialog__73027d">
      <DialogContent className="max-w-[1020px] bg-white" data-testid="edit-account-modal">
        <DialogHeader data-testid="DialogHeader__73027d">
          <DialogTitle data-testid="DialogTitle__73027d">{ui('financeAccountsEditTitle')}</DialogTitle>
        </DialogHeader>

        {/* Account fields — same two-column grid in every state */}
        <div className="grid grid-cols-1 gap-4 border-b border-[#E8EAEF] pb-4 sm:grid-cols-2">
          <EditField
            label={ui('financeAccountsPsd2FieldName')}
            data-testid="EditField__73027d">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              data-testid="edit-account-name"
              className={FIELD_INPUT}
            />
          </EditField>

          <ReadField
            label={ui('financeAccountsPsd2FieldType')}
            value={typeLabel}
            data-testid="ReadField__73027d" />

          {!isCash ? (
            psd2Connected ? (
              <ReadField
                label={ui('financeAccountsPsd2FieldIban')}
                value={account.iban}
                onCopy={account.iban ? copyIban : undefined}
                data-testid="ReadField__73027d" />
            ) : (
              <EditField
                label={ui('financeAccountsPsd2FieldIban')}
                data-testid="EditField__73027d">
                <Input
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  onBlur={() => setIbanTouched(true)}
                  placeholder={ui('financeAccountsNewFieldIbanPlaceholder')}
                  maxLength={42}
                  data-testid="edit-account-iban"
                  className={FIELD_INPUT}
                />
                {ibanInvalid && ibanTouched ? (
                  <p className="text-xs text-[#F53D6B]" data-testid="edit-account-iban-error">
                    {ui('financeAccountsNewIbanInvalid')}
                  </p>
                ) : null}
              </EditField>
            )
          ) : null}

          {psd2Connected ? (
            <ReadField
              label={ui('financeAccountsPsd2FieldCurrency')}
              value={account.currencyIso}
              data-testid="ReadField__73027d" />
          ) : (
            <EditField
              label={ui('financeAccountsPsd2FieldCurrency')}
              data-testid="EditField__73027d">
              <Select value={currencyId} onValueChange={setCurrencyId} data-testid="Select__73027d">
                <SelectTrigger data-testid="edit-account-currency" className="bg-white">
                  <SelectValue
                    placeholder={ui('financeAccountsNewFieldCurrencyPlaceholder')}
                    data-testid="SelectValue__73027d" />
                </SelectTrigger>
                <SelectContent side="bottom" avoidCollisions={false} data-testid="SelectContent__73027d">
                  {currencies.map((currency) => (
                    <SelectItem key={currency.id} value={currency.id} data-testid="SelectItem__73027d">
                      {currency.iso}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EditField>
          )}
        </div>

        {/* Bank connection — not shown for cash accounts */}
        {!isCash ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold leading-5 text-[#121217]">{ui('financeAccountsEditConnectionSection')}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-[#282833]">{ui('financeAccountsPsd2AutoSyncSubtitle')}</span>
                  {psd2Connected ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-normal ${
                      connected ? 'bg-[#EEFBF4] text-[#17663A]' : 'bg-[#F5F7F9] text-[#6C6C89]'
                    }`}>
                      {connected ? `✓ ${ui('financeAccountsPsd2StatusConnected')}` : ui('financeAccountsPsd2StatusDisconnected')}
                    </span>
                  ) : null}
                </div>
              </div>
              {!psd2Connected ? (
                <button
                  type="button"
                  onClick={handleConnectClick}
                  data-testid="edit-account-connect-psd2"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#121217] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#FFD500] hover:text-[#121217]"
                >
                  <Plug className="h-4 w-4" data-testid="Plug__73027d" />
                  {ui('financeAccountsMenuConnect')}
                </button>
              ) : null}
            </div>

            {psd2Connected ? (
              loading ? (
                <p className="text-xs text-[#6C6C89]">{ui('financeAccountsPsd2Loading')}</p>
              ) : (
                <div className="flex flex-col gap-3 rounded-lg bg-[#F5F7F9] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#121217]">
                      {status?.providerName || ui('financeAccountsPsd2StatusConnected')}
                    </span>
                    <button
                      type="button"
                      disabled={saving || !connected}
                      onClick={handleSync}
                      data-testid="psd2-edit-sync"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#D1D4DB] bg-white px-3 py-1.5 text-sm font-medium text-[#121217] shadow-[0_1px_2px_rgba(18,18,23,0.05)] hover:bg-[#F5F7F9] disabled:opacity-50"
                    >
                      <RefreshCw className="h-4 w-4 text-[#828FA3]" data-testid="RefreshCw__73027d" />
                      {ui('financeAccountsMenuSyncNow')}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <DateInput
                      label={ui('financeAccountsPsd2ImportFrom')}
                      name="psd2-import-from"
                      value={form.importFromDate || ''}
                      onChange={(v) => setForm((f) => ({ ...f, importFromDate: v }))}
                      data-testid="DateInput__73027d" />
                    <DateInput
                      label={ui('financeAccountsPsd2ImportTo')}
                      name="psd2-import-to"
                      value={form.importToDate || ''}
                      onChange={(v) => setForm((f) => ({ ...f, importToDate: v }))}
                      data-testid="DateInput__73027d" />
                    <Field label={ui('financeAccountsPsd2Grouping')} data-testid="Field__73027d">
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
                          data-testid="AlertTriangle__73027d" />
                        {reauthMessage}
                      </span>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleReconnect}
                        data-testid="psd2-edit-reauth-link"
                        className="shrink-0 text-sm font-medium text-[#8A6100] underline disabled:opacity-50"
                      >
                        {ui('financeAccountsPsd2Reauth')}
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="text-xs text-[#F53D6B]" data-testid="edit-account-error">{error}</p>
        ) : null}

        {/* Footer — same in every state (Disconnect only when connected) */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <FooterButton
              icon={Archive}
              label={ui('financeAccountsPsd2EditArchive')}
              onClick={() => onArchive?.(account)}
              disabled={saving}
              danger
              data-testid="FooterButton__73027d" />
            {psd2Connected ? (
              <FooterButton
                icon={Unlink2}
                label={ui('financeAccountsMenuDisconnect')}
                onClick={handleDisconnect}
                disabled={saving || !connected}
                data-testid="FooterButton__73027d" />
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              data-testid="edit-account-cancel"
              className="rounded-full border border-[#D1D4DB] bg-white px-4 py-2 text-sm font-medium text-[#121217] shadow-[0_1px_2px_rgba(18,18,23,0.05)] hover:bg-[#F5F7F9]"
            >
              {ui('cancel')}
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
              data-testid="edit-account-save"
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

function EditField({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium leading-6 text-[#121217]">{label}</span>
      {children}
    </div>
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
            <Copy className="h-4 w-4" data-testid="Copy__73027d" />
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
        data-testid="Icon__73027d" />
      {label}
    </button>
  );
}

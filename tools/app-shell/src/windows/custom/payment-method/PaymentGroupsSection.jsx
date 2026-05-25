import { useUI } from '@/i18n';

function Checkbox({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={!!checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        'h-4 w-4 shrink-0 rounded-sm border border-primary shadow',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary text-primary-foreground' : 'bg-transparent',
      ].join(' ')}
    >
      {checked && (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          className="h-4 w-4">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

function CheckRow({ fieldKey, uiKey, data, onFieldChange, isReadOnly }) {
  const ui = useUI();
  return (
    <div className="flex items-center gap-2.5 py-2">
      <Checkbox
        checked={!!data?.[fieldKey]}
        onChange={(val) => onFieldChange(fieldKey, val)}
        disabled={isReadOnly}
      />
      <span className="text-sm text-foreground font-medium select-none">{ui(uiKey)}</span>
    </div>
  );
}

function PaymentCard({ title, color, fields, data, onFieldChange, isReadOnly }) {
  const colors = {
    blue: 'border-blue-200 bg-blue-50/40',
    green: 'border-emerald-200 bg-emerald-50/40',
  };
  const titleColors = {
    blue: 'text-blue-700',
    green: 'text-emerald-700',
  };

  return (
    <div className={`flex-1 rounded-2xl border p-4 ${colors[color]}`}>
      <p className={`text-sm font-semibold mb-1 ${titleColors[color]}`}>{title}</p>
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-1">
        {fields.map((f) => (
          <CheckRow
            key={f.key}
            fieldKey={f.key}
            uiKey={f.uiKey}
            data={data}
            onFieldChange={onFieldChange}
            isReadOnly={isReadOnly}
          />
        ))}
      </div>
    </div>
  );
}

const PAYMENT_IN_FIELDS = [
  { key: 'payinAllow',       uiKey: 'payinAllow' },
  { key: 'automaticReceipt', uiKey: 'automaticReceipt' },
  { key: 'automaticDeposit', uiKey: 'automaticDeposit' },
];

const PAYMENT_OUT_FIELDS = [
  { key: 'payoutAllow',        uiKey: 'payoutAllow' },
  { key: 'automaticPayment',   uiKey: 'automaticPayment' },
  { key: 'automaticWithdrawn', uiKey: 'automaticWithdrawn' },
];

export default function PaymentGroupsSection({ data, onFieldChange, api }) {
  const ui = useUI();
  const isReadOnly = !onFieldChange;

  return (
    <div className="flex gap-4 mt-4">
      <PaymentCard
        title={ui('paymentInGroup')}
        color="blue"
        fields={PAYMENT_IN_FIELDS}
        data={data}
        onFieldChange={onFieldChange}
        isReadOnly={isReadOnly}
      />
      <PaymentCard
        title={ui('paymentOutGroup')}
        color="green"
        fields={PAYMENT_OUT_FIELDS}
        data={data}
        onFieldChange={onFieldChange}
        isReadOnly={isReadOnly}
      />
    </div>
  );
}

import BillingPreferencesForm from './BillingPreferencesForm';
import { useUI } from '@/i18n';

function FieldGroup({ title, description, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-gray-800">{title}</div>
          {description && <div className="text-xs text-gray-400 mt-0.5">{description}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function ContactsFinancialPanel({ data, token, apiBaseUrl, catalogs, api, editing, onChange }) {
  const ui = useUI();
  return (
    <div className="space-y-4 pt-5 pb-6">
      <FieldGroup title={ui('billingPreferences')} description={ui('billingPreferencesDesc')}>
        <BillingPreferencesForm
          data={data}
          api={api}
          token={token}
          catalogs={catalogs}
          onChange={onChange}
          editing={editing}
          apiBaseUrl={apiBaseUrl}
        />
      </FieldGroup>
    </div>
  );
}

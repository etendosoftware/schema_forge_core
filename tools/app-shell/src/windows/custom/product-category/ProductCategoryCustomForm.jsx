import { EntityForm } from '@/components/contract-ui';
import { useUI } from '@/i18n';

/* eslint-disable react/prop-types */

function isCheckedYN(v) {
  return v === true || v === 'Y' || v === 'true';
}

function CheckboxGroup({ label, items, data, readOnly, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-[#121217]">{label}</p>
      <div className="flex items-center gap-5 h-10">
        {items.map(item => {
          const checked = isCheckedYN(data?.[item.key]);
          return (
            <label key={item.key} className="flex items-center gap-2 cursor-pointer select-none">
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                disabled={readOnly}
                data-testid={`field-${item.key}`}
                onClick={() => !readOnly && onChange?.(item.key, !checked, item.column)}
                className={[
                  'peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow',
                  'flex items-center justify-center',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  checked ? 'bg-primary text-primary-foreground' : 'bg-transparent',
                ].join(' ')}
              >
                {checked && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                    strokeLinejoin="round" className="h-4 w-4">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
              <span className="text-sm text-foreground font-medium">{item.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

const TEXT_FIELDS = [
  { key: 'name', column: 'Name', type: 'text', label: 'Name', required: true, section: 'principal' },
  { key: 'searchKey', column: 'Value', type: 'text', label: 'Search Key', required: true, section: 'principal' },
];

const DESCRIPTION_FIELD = [
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'principal', span: 3, rows: 3 },
];

export default function ProductCategoryCustomForm({ entity, data, token, apiBaseUrl, catalogs, api, editing, onChange, displayLogic, section }) {
  if (section && section !== 'principal') return null;
  const ui = useUI();
  const readOnly = !editing;

  return (
    <div className="flex flex-col gap-5 [&_input]:bg-white [&_textarea]:bg-white">
      {/* Row 1: Name | Search Key | Configuration checkboxes */}
      <div className="flex flex-row items-end gap-5">
        <div className="w-[325px] shrink-0">
          <EntityForm
            entity={entity}
            fields={[TEXT_FIELDS[0]]}
            data={data ?? {}}
            onChange={onChange}
            catalogs={catalogs}
            cols={1}
            displayLogic={displayLogic ?? { readOnly: {}, visibility: {} }}
            api={api}
            token={token}
            apiBaseUrl={apiBaseUrl}
          />
        </div>
        <div className="w-[325px] shrink-0">
          <EntityForm
            entity={entity}
            fields={[TEXT_FIELDS[1]]}
            data={data ?? {}}
            onChange={onChange}
            catalogs={catalogs}
            cols={1}
            displayLogic={displayLogic ?? { readOnly: {}, visibility: {} }}
            api={api}
            token={token}
            apiBaseUrl={apiBaseUrl}
          />
        </div>
        <div className="flex-1 pb-1">
          <CheckboxGroup
            label={ui('categoryConfiguration')}
            items={[
              { key: 'default', column: 'IsDefault', label: ui('categoryDefault') },
              { key: 'summaryLevel', column: 'Issummary', label: ui('categoryGroupable') },
            ]}
            data={data}
            readOnly={readOnly}
            onChange={onChange}
          />
        </div>
      </div>

      {/* Row 2: Description full width */}
      <div>
        <EntityForm
          entity={entity}
          fields={DESCRIPTION_FIELD}
          data={data ?? {}}
          onChange={onChange}
          catalogs={catalogs}
          cols={1}
          displayLogic={displayLogic ?? { readOnly: {}, visibility: {} }}
          api={api}
          token={token}
          apiBaseUrl={apiBaseUrl}
        />
      </div>
    </div>
  );
}

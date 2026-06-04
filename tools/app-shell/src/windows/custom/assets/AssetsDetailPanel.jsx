import { useEffect } from 'react';
import { EntityForm } from '@/components/contract-ui';
import { useUI } from '@/i18n';

function GroupHead({ title, description }) {
  return (
    <div>
      <div className="text-sm font-semibold text-[#121217] mb-4">{title}</div>
      {description && <div className="text-xs text-[#6C6C89] -mt-2 mb-4">{description}</div>}
    </div>
  );
}

function GroupDivider({ title, description }) {
  return (
    <div className="border-t border-[#E8E8ED] pt-5">
      <GroupHead title={title} description={description} />
    </div>
  );
}

function ToggleCard({ label, description, fieldKey, value, onChange, editing }) {
  const isOn = value === true || value === 'Y';

  function handleToggle() {
    if (!editing) return;
    onChange?.(fieldKey, !isOn);
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-[#D1D1DB] bg-white p-4">
      <div>
        <div className="text-sm font-medium text-[#121217]">{label}</div>
        {description && <div className="text-xs text-[#6C6C89] mt-0.5">{description}</div>}
      </div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={!editing}
        className={`relative inline-flex h-6 w-[42px] items-center rounded-full transition-colors focus:outline-none
          ${isOn ? 'bg-[#121217]' : 'bg-[#D1D1DB]'}
          ${!editing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        aria-checked={isOn}
        role="switch"
      >
        <span
          className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-sm transition-all duration-150
            ${isOn ? 'translate-x-[19px]' : 'translate-x-[3px]'}`}
        />
      </button>
    </div>
  );
}

function isDepreciate(record) {
  return record?.depreciate === true || record?.depreciate === 'Y';
}

export default function AssetsDetailPanel({ data, token, apiBaseUrl, catalogs, api, editing, onChange }) {
  const ui = useUI();
  const d = data ?? {};
  const depreciate = isDepreciate(d);

  useEffect(() => {
    if (!d?.id && d?.currency) {
      onChange?.('currency', d.currency);
    }
  }, [d?.id, d?.currency, onChange]);

  const common = { data: d, onChange, catalogs, api, token, apiBaseUrl, entity: 'assets', layout: 'horizontal' };

  const readOnlyAll = !editing ? { readOnly: Object.fromEntries([
    'searchKey','name','assetCategory','description',
    'currency','assetValue','residualAssetValue','depreciationAmt','previouslyDepreciatedAmt',
    'depreciate','everyMonthIs30Days','depreciationType','calculateType','annualDepreciation',
    'amortize','usableLifeYears','usableLifeMonths',
    'purchaseDate','cancellationDate','depreciationStartDate','depreciationEndDate',
    'project','eTADASCostCenter','businessPartner','eTADASUser1','eTADASUser2',
    'eTADASSalesRegion','eTADASActivity','eTADASSalesCampaign',
  ].map(k => [k, true])), visibility: {} } : { readOnly: {}, visibility: {} };

  const group1Fields = [
    { key: 'searchKey', column: 'Value', type: 'text', label: ui('Search Key'), required: true, section: 'principal' },
    { key: 'name', column: 'Name', type: 'text', label: ui('Name'), required: true, section: 'principal' },
    { key: 'assetCategory', column: 'A_Asset_Group_ID', type: 'selector', label: ui('Asset Category'), required: true, section: 'principal', reference: 'AssetGroup', inputMode: 'selector' },
    { key: 'description', column: 'Description', type: 'textarea', label: ui('Description'), section: 'other' },
  ];

  const group2Fields = [
    { key: 'currency', column: 'C_Currency_ID', type: 'selector', label: ui('assetsCurrencyLabel'), section: 'principal', reference: 'Currency', inputMode: 'selector', defaultValue: '@C_Currency_ID@', readOnlyLogic: (record) => Number(record.depreciatedPlan || 0) > 0 || Number(record.depreciatedValue || 0) > 0 },
    { key: 'assetValue', column: 'AssetValueAmt', type: 'number', label: ui('assetsAssetValueLabel'), section: 'principal' },
    { key: 'residualAssetValue', column: 'Residualassetvalueamt', type: 'number', label: ui('assetsResidualValueLabel'), section: 'principal' },
    { key: 'depreciationAmt', column: 'Amortizationvalueamt', type: 'number', label: ui('assetsDepreciationAmtLabel'), section: 'principal' },
    { key: 'previouslyDepreciatedAmt', column: 'Depreciatedpreviousamt', type: 'number', label: ui('assetsPrevDepreciatedLabel'), section: 'principal', defaultValue: '0' },
  ];

  const deprecFields = [
    { key: 'depreciationType', column: 'Amortizationtype', type: 'select', label: ui('assetsOptLinear'), required: true, section: 'principal', options: [{ value: 'LI', label: ui('assetsOptLinear') }] },
    { key: 'calculateType', column: 'Amortizationcalctype', type: 'select', required: true, section: 'principal', options: [{ value: 'PE', label: ui('assetsOptPercentage') }, { value: 'TI', label: ui('assetsOptTime') }] },
    { key: 'annualDepreciation', column: 'Amortizationpercentage', type: 'number', label: ui('assetsAnnualDepreciationLabel'), section: 'principal', displayLogic: (record) => isDepreciate(record) && record.calculateType !== 'TI' },
    { key: 'amortize', column: 'Assetschedule', type: 'select', required: true, section: 'principal', options: [{ value: 'MO', label: ui('assetsOptMonthly') }, { value: 'YE', label: ui('assetsOptYearly') }], displayLogic: (record) => isDepreciate(record) && record.calculateType === 'TI' },
    { key: 'usableLifeYears', column: 'UseLifeYears', type: 'number', section: 'principal', displayLogic: (record) => isDepreciate(record) && record.calculateType === 'TI' && record.amortize === 'YE' },
    { key: 'usableLifeMonths', column: 'UseLifeMonths', type: 'number', section: 'principal', displayLogic: (record) => isDepreciate(record) && record.calculateType === 'TI' && record.amortize !== 'YE' },
  ];

  function makeDisplayLogic(fields) {
    const readOnly = { ...readOnlyAll.readOnly };
    const visibility = {};
    fields.forEach(f => {
      if (f.displayLogic) {
        if (!f.displayLogic(d)) visibility[f.key] = false;
      }
    });
    return { readOnly, visibility };
  }

  const dimensionFields = [
    { key: 'project', column: 'C_Project_ID', type: 'selector', section: 'principal', reference: 'Project', inputMode: 'selector' },
    { key: 'eTADASCostCenter', column: 'EM_Etadas_Costcenter_ID', type: 'selector', section: 'principal', reference: 'Costcenter', inputMode: 'selector' },
    { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector', section: 'principal', reference: 'BPartner', inputMode: 'selector' },
    { key: 'eTADASUser1', column: 'EM_Etadas_User1_ID', type: 'selector', section: 'principal', reference: 'User1', inputMode: 'selector' },
    { key: 'eTADASUser2', column: 'EM_Etadas_User2_ID', type: 'selector', section: 'principal', reference: 'User2', inputMode: 'selector' },
    { key: 'eTADASSalesRegion', column: 'EM_Etadas_Salesregion_ID', type: 'selector', section: 'principal', reference: 'SalesRegion', inputMode: 'selector' },
    { key: 'eTADASActivity', column: 'EM_Etadas_C_Activity_ID', type: 'selector', section: 'principal', reference: 'Activity', inputMode: 'selector' },
    { key: 'eTADASSalesCampaign', column: 'EM_Etadas_Campaign_ID', type: 'selector', section: 'principal', reference: 'Campaign', inputMode: 'selector' },
  ];

  const dateFields = [
    { key: 'purchaseDate', column: 'Datepurchased', type: 'date', label: ui('assetsPurchaseDateLabel'), section: 'principal' },
    { key: 'cancellationDate', column: 'Cancellationdate', type: 'date', label: ui('assetsCancellationDateLabel'), section: 'principal' },
    { key: 'depreciationStartDate', column: 'Amortizationstartdate', type: 'date', label: ui('assetsDepStartDateLabel'), section: 'principal' },
    { key: 'depreciationEndDate', column: 'Amortizationenddate', type: 'date', label: ui('assetsDepEndDateLabel'), section: 'principal' },
  ];

  return (
    <div className="p-2 pb-6 bg-white overflow-y-auto max-h-[380px] [&_input]:bg-white [&_textarea]:bg-white [&_textarea:disabled]:!bg-white [&_textarea:disabled]:opacity-50">
      {/* Group 1 — Asset Info (no subtitle) */}
      <div className="mb-5">
        <EntityForm
          fields={group1Fields}
          {...common}
          displayLogic={readOnlyAll}
        />
      </div>

      {/* Group 3 — Depreciation Config */}
      <GroupDivider title={ui('assetsGroupDepreciationTitle')} description={ui('assetsConfigDesc')} />
      <div className="mb-5 space-y-4">
        <div className={`grid gap-4 ${depreciate ? 'grid-cols-2' : 'grid-cols-1 max-w-sm'}`}>
          <ToggleCard
            label={ui('assetsDepreciateLabel')}
            description={ui('assetsDepreciateDesc')}
            fieldKey="depreciate"
            value={d.depreciate}
            onChange={onChange}
            editing={editing}
          />
          {depreciate && (
            <ToggleCard
              label={ui('assets30DaysLabel')}
              description={ui('assets30DaysDesc')}
              fieldKey="everyMonthIs30Days"
              value={d.everyMonthIs30Days}
              onChange={onChange}
              editing={editing}
            />
          )}
        </div>
        {depreciate ? (
          <>
            {/* Group 2 — Financial Info (only rendered when depreciation is enabled) */}
            <GroupDivider title={ui('assetsGroupFinancialTitle')} />
            <EntityForm
              fields={group2Fields}
              {...common}
              displayLogic={readOnlyAll}
            />
            <EntityForm
              fields={deprecFields}
              {...common}
              displayLogic={makeDisplayLogic(deprecFields)}
            />
          </>
        ) : (
          <p className="text-xs text-[#6C6C89]">{ui('assetsDepreciationDisabledHint')}</p>
        )}
      </div>

      {/* Group 4 — Dates */}
      {depreciate && (
        <GroupDivider title={ui('assetsGroupDatesTitle')} />
      )}
      {depreciate && (
        <EntityForm
          fields={dateFields}
          {...common}
          displayLogic={readOnlyAll}
        />
      )}

      {/* Group 5 — Accounting dimensions (optional, last section) */}
      {depreciate && (
        <GroupDivider title={ui('assetsGroupDimensionsTitle')} />
      )}
      {depreciate && (
        <div className="[&_button[role=combobox]]:!bg-white [&_input]:!bg-white">
          <EntityForm
            fields={dimensionFields}
            {...common}
            cols={4}
            displayLogic={readOnlyAll}
          />
        </div>
      )}
    </div>
  );
}

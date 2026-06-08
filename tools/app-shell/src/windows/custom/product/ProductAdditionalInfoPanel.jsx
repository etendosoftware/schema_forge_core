import { EntityForm } from '@/components/contract-ui';
import { useUI } from '@/i18n';

export default function ProductAdditionalInfoPanel({ entity, data, token, apiBaseUrl, catalogs, api, editing, onChange }) {
  const ui = useUI();
  return (
    <div className="space-y-2 pb-6">
      <div className="flex flex-row items-start p-2 gap-5">
        <div className="flex flex-col gap-1 w-[148px] shrink-0">
          <div className="text-sm font-semibold text-[#121217]">{ui('commercial')}</div>
          <div className="text-xs text-[#282833]">{ui('commercialDescription')}</div>
        </div>
        <div className="flex-1">
          <EntityForm
            entity={entity}
            fields={[
              { key: 'taxCategory', column: 'C_TaxCategory_ID', type: 'selector', label: 'Tax Category', required: true, section: 'other', reference: 'TaxCategory', inputMode: 'selector' },
              { key: 'sale', column: 'IsSold', type: 'checkbox', label: 'Sale', section: 'other', defaultValue: 'Y' },
              { key: 'purchase', column: 'IsPurchased', type: 'checkbox', label: 'Purchase', section: 'other', defaultValue: 'Y' },
            ]}
            data={data ?? {}}
            onChange={onChange}
            catalogs={catalogs}
            layout="horizontal"
            displayLogic={{ readOnly: editing ? {} : { taxCategory: true, sale: true, purchase: true }, visibility: {} }}
            api={api}
            token={token}
            apiBaseUrl={apiBaseUrl}
          />
        </div>
      </div>

      <hr className="border-t border-[#E8EAEF] mx-5" />

      <div className="flex flex-row items-start p-2 gap-5">
        <div className="flex flex-col gap-1 w-[148px] shrink-0">
          <div className="text-sm font-semibold text-[#121217]">{ui('logistics')}</div>
          <div className="text-xs text-[#282833]">{ui('logisticsDescription')}</div>
        </div>
        <div className="flex-1">
          <EntityForm
            entity={entity}
            fields={[
              { key: 'stocked', column: 'IsStocked', type: 'checkbox', label: 'Stocked', section: 'other', defaultValue: 'Y' },
              { key: 'returnable', column: 'Returnable', type: 'checkbox', label: 'Returnable', section: 'other', defaultValue: 'Y' },
              { key: 'weight', column: 'Weight', type: 'number', label: 'Weight', section: 'other' },
              { key: 'uOMForWeight', column: 'C_Uom_Weight_ID', type: 'selector', label: 'UOM for Weight', section: 'other', reference: 'UOM', inputMode: 'selector' },
            ]}
            data={data ?? {}}
            onChange={onChange}
            catalogs={catalogs}
            layout="horizontal"
            displayLogic={{ readOnly: editing ? {} : { stocked: true, returnable: true, weight: true, uOMForWeight: true }, visibility: {} }}
            api={api}
            token={token}
            apiBaseUrl={apiBaseUrl}
          />
        </div>
      </div>
    </div>
  );
}

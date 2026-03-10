import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', readOnly: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'dateRequired', column: 'DateRequired', type: 'date', required: true, readOnly: true },
  { key: 'dateDoc', column: 'DateDoc', type: 'date', required: true, readOnly: true },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, readOnly: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', required: true, readOnly: true, reference: 'PriceList', inputMode: 'selector' },
  { key: 'totalLines', column: 'TotalLines', type: 'number', readOnly: true },
  { key: 'grandTotal', column: 'GrandTotal', type: 'number', readOnly: true },
  { key: 'user', column: 'AD_User_ID', type: 'search', readOnly: true, reference: 'User', inputMode: 'search' },
  { key: 'organization', column: 'AD_Org_ID', type: 'selector', required: true, readOnly: true, reference: 'Organization', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea', readOnly: true },
  { key: 'cCurrencyId', column: 'C_Currency_ID', type: 'search', required: true, readOnly: true, reference: 'Currency' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true },
];

export default function RequisitionForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

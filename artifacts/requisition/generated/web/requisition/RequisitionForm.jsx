import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'dateRequired', column: 'DateRequired', type: 'date', required: true },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', required: true, reference: 'PriceList', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true },
  { key: 'totalLines', column: 'TotalLines', type: 'number', readOnly: true },
  { key: 'grandTotal', column: 'GrandTotal', type: 'number', readOnly: true },
  { key: 'user', column: 'AD_User_ID', type: 'search', readOnly: true, reference: 'User', inputMode: 'search' },
];

export default function RequisitionForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

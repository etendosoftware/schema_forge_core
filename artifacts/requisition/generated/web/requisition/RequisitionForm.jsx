import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'businessPartner', label: 'Business Partner', type: 'search', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'dateRequired', label: 'Date Required', type: 'date', required: true },
  { key: 'warehouse', label: 'Warehouse', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'priceList', label: 'Price List', type: 'selector', required: true, reference: 'PriceList', inputMode: 'selector' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true },
  { key: 'documentNo', label: 'Document No', type: 'text', required: true, readOnly: true },
  { key: 'docStatus', label: 'Doc Status', type: 'text', required: true, readOnly: true },
  { key: 'totalLines', label: 'Total Lines', type: 'number', readOnly: true },
  { key: 'grandTotal', label: 'Grand Total', type: 'number', readOnly: true },
  { key: 'user', label: 'User', type: 'search', readOnly: true, reference: 'User', inputMode: 'search' },
];

export default function RequisitionForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

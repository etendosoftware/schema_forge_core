import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'documentNo', label: 'Document No', type: 'text', required: true, readOnly: true },
  { key: 'docStatus', label: 'Doc Status', type: 'text', required: true, readOnly: true },
  { key: 'businessPartner', label: 'Business Partner', type: 'search', readOnly: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'dateRequired', label: 'Date Required', type: 'date', required: true, readOnly: true },
  { key: 'dateDoc', label: 'Date Doc', type: 'date', required: true, readOnly: true },
  { key: 'warehouse', label: 'Warehouse', type: 'selector', required: true, readOnly: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'priceList', label: 'Price List', type: 'selector', required: true, readOnly: true, reference: 'PriceList', inputMode: 'selector' },
  { key: 'totalLines', label: 'Total Lines', type: 'number', readOnly: true },
  { key: 'grandTotal', label: 'Grand Total', type: 'number', readOnly: true },
  { key: 'user', label: 'User', type: 'search', readOnly: true, reference: 'User', inputMode: 'search' },
  { key: 'organization', label: 'Organization', type: 'selector', required: true, readOnly: true, reference: 'Organization', inputMode: 'selector' },
  { key: 'description', label: 'Description', type: 'textarea', readOnly: true },
  { key: 'cCurrencyId', label: 'C Currency Id', type: 'search', required: true, readOnly: true, reference: 'Currency' },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true, readOnly: true },
];

export default function RequisitionForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

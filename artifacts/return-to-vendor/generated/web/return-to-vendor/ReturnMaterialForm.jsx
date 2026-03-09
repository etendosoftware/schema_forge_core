import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'businessPartner', label: 'Business Partner', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'documentDate', label: 'Document Date', type: 'date', required: true },
  { key: 'returnDate', label: 'Return Date', type: 'date' },
  { key: 'originalReceipt', label: 'Original Receipt', type: 'search', required: true, reference: 'MaterialReceipt', inputMode: 'search' },
  { key: 'warehouse', label: 'Warehouse', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'returnReason', label: 'Return Reason', type: 'text' },
  { key: 'salesRepresentative', label: 'Sales Representative', type: 'search', reference: 'User', inputMode: 'search' },
  { key: 'documentNo', label: 'Document No', type: 'text', required: true, readOnly: true },
  { key: 'docStatus', label: 'Doc Status', type: 'text', required: true, readOnly: true },
  { key: 'totalAmount', label: 'Total Amount', type: 'number', readOnly: true },
  { key: 'isApproved', label: 'Is Approved', type: 'checkbox', readOnly: true },
];

export default function ReturnMaterialForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

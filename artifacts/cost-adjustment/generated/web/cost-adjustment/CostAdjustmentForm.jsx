import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'organization', label: 'Organization', type: 'selector', required: true, reference: 'Organization', inputMode: 'selector' },
  { key: 'documentDate', label: 'Document Date', type: 'date', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'referenceNo', label: 'Reference No', type: 'text' },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true },
  { key: 'documentNo', label: 'Document No', type: 'text', required: true, readOnly: true },
  { key: 'docStatus', label: 'Doc Status', type: 'text', required: true, readOnly: true },
];

export default function CostAdjustmentForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

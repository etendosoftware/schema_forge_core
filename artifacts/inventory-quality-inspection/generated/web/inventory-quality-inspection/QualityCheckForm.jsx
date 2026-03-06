import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'warehouse', label: 'Warehouse', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'inspectionDate', label: 'Inspection Date', type: 'date', required: true },
  { key: 'result', label: 'Result', type: 'text', required: true },
  { key: 'inspector', label: 'Inspector', type: 'text', required: true },
  { key: 'notes', label: 'Notes', type: 'text' },
  { key: 'quantityInspected', label: 'Quantity Inspected', type: 'number', required: true },
  { key: 'quantityAccepted', label: 'Quantity Accepted', type: 'number', required: true },
];

export default function QualityCheckForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

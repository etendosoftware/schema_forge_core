import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'movementDate', label: 'Movement Date', type: 'date', required: true },
  { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'productionQuantity', label: 'Production Quantity', type: 'number', required: true },
  { key: 'description', label: 'Description', type: 'text' },
];

export default function ProductionForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

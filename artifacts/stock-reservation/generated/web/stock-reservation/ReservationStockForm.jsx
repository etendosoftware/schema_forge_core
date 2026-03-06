import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'locator', label: 'Locator', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
  { key: 'quantity', label: 'Quantity', type: 'number', required: true },
];

export default function ReservationStockForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

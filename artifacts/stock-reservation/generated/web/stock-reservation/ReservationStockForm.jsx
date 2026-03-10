import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'locator', column: 'M_Locator_ID', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
  { key: 'quantity', column: 'Quantity', type: 'number', required: true },
  { key: 'released', column: 'Released', type: 'number', readOnly: true },
  { key: 'isAllocated', column: 'IsAllocated', type: 'checkbox', required: true, readOnly: true },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true },
];

export default function ReservationStockForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

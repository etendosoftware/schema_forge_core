import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:reservationStock
const fields = [
  { key: 'locator', column: 'M_Locator_ID', type: 'selector', required: true, section: 'principal', reference: 'Locator', inputMode: 'selector' },
  { key: 'quantity', column: 'Quantity', type: 'number', required: true, section: 'principal' },
  { key: 'released', column: 'Released', type: 'number', readOnly: true, section: 'other' },
  { key: 'isAllocated', column: 'IsAllocated', type: 'checkbox', required: true, readOnly: true, section: 'other' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:reservationStock

// @sf-generated-start component:ReservationStockForm
export default function ReservationStockForm(props) {
  // @sf-custom-slot hooks:ReservationStockForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:ReservationStockForm

// @sf-custom-slot section:ReservationStockForm-custom

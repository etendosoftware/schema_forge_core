import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'packDate', label: 'Pack Date', type: 'date', required: true },
  { key: 'shipment', label: 'Shipment', type: 'search', required: true, reference: 'Shipment', inputMode: 'search' },
  { key: 'businessPartner', label: 'Business Partner', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'warehouse', label: 'Warehouse', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'carrier', label: 'Carrier', type: 'text' },
  { key: 'trackingNo', label: 'Tracking No', type: 'text' },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true },
];

export default function PackingForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

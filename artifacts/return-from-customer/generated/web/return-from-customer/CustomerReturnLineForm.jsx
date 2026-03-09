import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'originalShipmentLine', label: 'Original Shipment Line', type: 'selector', required: true, reference: 'ShipmentLine', inputMode: 'selector' },
  { key: 'quantity', label: 'Quantity', type: 'number', required: true },
  { key: 'lineNo', label: 'Line No', type: 'number', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
];

export default function CustomerReturnLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

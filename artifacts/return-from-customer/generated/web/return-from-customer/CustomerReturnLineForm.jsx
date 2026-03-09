import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'originalShipmentLine', label: 'Original Shipment Line', type: 'selector', required: true, reference: 'ShipmentLine', inputMode: 'selector' },
  { key: 'quantity', label: 'Quantity', type: 'number', required: true },
  { key: 'lineNo', label: 'Line No', type: 'number', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'product', label: 'Product', type: 'search', readOnly: true, reference: 'Product', inputMode: 'search' },
  { key: 'uom', label: 'Uom', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
  { key: 'lineAmount', label: 'Line Amount', type: 'number', readOnly: true },
  { key: 'tax', label: 'Tax', type: 'selector', readOnly: true, reference: 'Tax', inputMode: 'selector' },
];

export default function CustomerReturnLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

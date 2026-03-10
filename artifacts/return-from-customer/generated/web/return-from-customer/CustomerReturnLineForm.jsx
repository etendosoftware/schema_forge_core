import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'originalShipmentLine', column: 'M_InOutLine_ID', type: 'selector', required: true, reference: 'ShipmentLine', inputMode: 'selector' },
  { key: 'quantity', column: 'Qty', type: 'number', required: true },
  { key: 'lineNo', column: 'Line', type: 'number', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'product', column: 'M_Product_ID', type: 'search', readOnly: true, reference: 'Product', inputMode: 'search' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
  { key: 'lineAmount', column: 'Amt', type: 'number', readOnly: true },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', readOnly: true, reference: 'Tax', inputMode: 'selector' },
];

export default function CustomerReturnLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

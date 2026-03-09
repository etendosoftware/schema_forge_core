import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'originalReceiptLine', label: 'Original Receipt Line', type: 'selector', required: true, reference: 'MaterialReceiptLine', inputMode: 'selector' },
  { key: 'quantity', label: 'Quantity', type: 'number', required: true },
  { key: 'lineNo', label: 'Line No', type: 'number', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'product', label: 'Product', type: 'search', readOnly: true, reference: 'Product', inputMode: 'search' },
  { key: 'uom', label: 'Uom', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
  { key: 'lineAmount', label: 'Line Amount', type: 'number', readOnly: true },
  { key: 'tax', label: 'Tax', type: 'selector', readOnly: true, reference: 'Tax', inputMode: 'selector' },
];

export default function ReturnMaterialLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

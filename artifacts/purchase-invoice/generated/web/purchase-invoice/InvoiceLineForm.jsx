import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'quantity', label: 'Quantity', type: 'number', required: true },
  { key: 'unitPrice', label: 'Unit Price', type: 'number', required: true },
  { key: 'priceList', label: 'Price List', type: 'number' },
  { key: 'tax', label: 'Tax', type: 'selector', required: true, reference: 'Tax', inputMode: 'selector' },
  { key: 'discount', label: 'Discount', type: 'number' },
  { key: 'lineNo', label: 'Line No', type: 'number', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'lineNetAmount', label: 'Line Net Amount', type: 'number', readOnly: true },
  { key: 'uom', label: 'Uom', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
  { key: 'taxAmount', label: 'Tax Amount', type: 'number', readOnly: true },
];

export default function InvoiceLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

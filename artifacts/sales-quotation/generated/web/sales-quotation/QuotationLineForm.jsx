import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'quantity', column: 'QtyOrdered', type: 'number', required: true },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', required: true },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', required: true, reference: 'Tax', inputMode: 'selector' },
  { key: 'discount', column: 'Discount', type: 'number' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', readOnly: true },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
];

export default function QuotationLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

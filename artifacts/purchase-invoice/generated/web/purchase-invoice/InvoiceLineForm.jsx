import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'quantity', column: 'QtyInvoiced', type: 'number', required: true },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', required: true },
  { key: 'priceList', column: 'PriceList', type: 'number' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', required: true, reference: 'Tax', inputMode: 'selector' },
  { key: 'discount', column: 'Discount', type: 'number' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', readOnly: true },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
  { key: 'taxAmount', column: 'TaxAmt', type: 'number', readOnly: true },
];

export default function InvoiceLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

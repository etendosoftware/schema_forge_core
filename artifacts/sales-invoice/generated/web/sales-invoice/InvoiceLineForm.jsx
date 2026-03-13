import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:invoiceLine
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'quantity', column: 'QtyInvoiced', type: 'number', required: true, section: 'principal' },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', required: true, section: 'principal' },
  { key: 'priceList', column: 'PriceList', type: 'number', section: 'principal' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', required: true, section: 'other', reference: 'Tax', inputMode: 'selector' },
  { key: 'discount', column: 'Discount', type: 'number', section: 'other' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', readOnly: true, section: 'other' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
  { key: 'taxAmount', column: 'TaxAmt', type: 'number', readOnly: true, section: 'other' },
];
// @sf-generated-end fields:invoiceLine

// @sf-generated-start component:InvoiceLineForm
export default function InvoiceLineForm(props) {
  // @sf-custom-slot hooks:InvoiceLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InvoiceLineForm

// @sf-custom-slot section:InvoiceLineForm-custom

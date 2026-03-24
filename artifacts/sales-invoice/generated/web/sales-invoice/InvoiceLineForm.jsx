import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:invoiceLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Invoice_Product
  { key: 'product', column: 'M_Product_ID', type: 'search', section: 'principal', reference: 'Product', inputMode: 'search' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'text', required: true, section: 'principal' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'principal', reference: 'UOM', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'unitPrice', column: 'PriceActual', type: 'text', required: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', required: true, readOnly: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', section: 'principal', reference: 'Tax', inputMode: 'selector' },
  { key: 'listPrice', column: 'PriceList', type: 'text', required: true, section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
];
// @sf-generated-end fields:invoiceLine

// @sf-generated-start component:InvoiceLineForm
export default function InvoiceLineForm(props) {
  // @sf-custom-slot hooks:InvoiceLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InvoiceLineForm

// @sf-custom-slot section:InvoiceLineForm-custom

import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:quotationLine
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'quantity', column: 'QtyOrdered', type: 'number', required: true, section: 'principal' },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', required: true, section: 'principal' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', required: true, section: 'principal', reference: 'Tax', inputMode: 'selector' },
  { key: 'discount', column: 'Discount', type: 'number', section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'other' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', readOnly: true, section: 'other' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
];
// @sf-generated-end fields:quotationLine

// @sf-generated-start component:QuotationLineForm
export default function QuotationLineForm(props) {
  // @sf-custom-slot hooks:QuotationLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:QuotationLineForm

// @sf-custom-slot section:QuotationLineForm-custom

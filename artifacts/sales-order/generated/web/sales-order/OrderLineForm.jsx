import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:orderLine
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'number', required: true },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', required: true },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', required: true, reference: 'Tax', inputMode: 'selector' },
  { key: 'discount', column: 'Discount', type: 'number' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', readOnly: true },
  { key: 'deliveredQuantity', column: 'QtyDelivered', type: 'number', readOnly: true },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
];
// @sf-generated-end fields:orderLine

// @sf-generated-start component:OrderLineForm
export default function OrderLineForm(props) {
  // @sf-custom-slot hooks:OrderLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:OrderLineForm

// @sf-custom-slot section:OrderLineForm-custom

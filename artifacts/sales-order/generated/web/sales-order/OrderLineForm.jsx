import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:orderLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal', defaultValue: '@SQL=SELECT COALESCE(MAX(Line),0)+10 AS DefaultValue FROM C_OrderLine WHERE C_Order_ID=@C_Order_ID@' },
  // @sf-custom-slot callout:SL_Order_Product
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  // @sf-custom-slot callout:OperativeQuantity_To_BaseQuantity
  { key: 'operativeUOM', column: 'C_Aum', type: 'dependent', section: 'other', reference: 'UOM', inputMode: 'dependent', dependsOn: { field: 'product', filterKey: 'M_Product_ID' } },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'text', required: true, section: 'principal', defaultValue: '1' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', required: true, readOnly: true, section: 'principal', reference: 'UOM', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'unitPrice', column: 'PriceActual', type: 'text', required: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', required: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'tax', column: 'C_Tax_ID', type: 'search', required: true, section: 'principal', reference: 'Tax', inputMode: 'search' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'listPrice', column: 'PriceList', type: 'text', required: true, section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'discount', column: 'Discount', type: 'text', section: 'principal', defaultValue: '0' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'replacedorderline', column: 'Replacedorderline_id', type: 'search', readOnly: true, section: 'other', reference: 'OrderLine', inputMode: 'search' },
  { key: 'stockReservation', column: 'Create_Reservation', type: 'select', section: 'other', options: [{ value: 'CRP', label: 'Automatic' }, { value: 'CR', label: 'Manual' }] },
  { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'deliveredQuantity', column: 'QtyDelivered', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'quotationLine', column: 'Quotationline_ID', type: 'search', readOnly: true, section: 'other', reference: 'OrderLine', inputMode: 'search' },
  { key: 'reservationStatus', column: 'SO_Res_Status', type: 'select', readOnly: true, section: 'other', options: [{ value: 'CR', label: 'Completely Reserved' }, { value: 'NR', label: 'Not Reserved' }, { value: 'PR', label: 'Partially Reserved' }], visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
];
// @sf-generated-end fields:orderLine

// @sf-generated-start component:OrderLineForm
export default function OrderLineForm(props) {
  // @sf-custom-slot hooks:OrderLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:OrderLineForm

// @sf-custom-slot section:OrderLineForm-custom

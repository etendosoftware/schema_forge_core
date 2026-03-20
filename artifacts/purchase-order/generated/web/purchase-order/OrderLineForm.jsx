import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:orderLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.', required: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Order_Product
  { key: 'product', column: 'M_Product_ID', type: 'search', label: 'Product', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  // @sf-custom-slot callout:OperativeQuantity_To_BaseQuantity
  { key: 'operativeQuantity', column: 'Aumqty', type: 'text', label: 'Operative Quantity', section: 'principal' },
  // @sf-custom-slot callout:OperativeQuantity_To_BaseQuantity
  { key: 'operativeUOM', column: 'C_Aum', type: 'dependent', label: 'Alternative UOM', section: 'principal', reference: 'UOM', inputMode: 'dependent', dependsOn: { field: 'product', filterKey: 'M_Product_ID' } },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'text', label: 'Ordered Quantity', required: true, section: 'other', readOnlySource: 'server', readOnlyLogicReason: 'session-variable' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', label: 'UOM', required: true, readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'unitPrice', column: 'PriceActual', type: 'text', label: 'Net Unit Price', required: true, section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'text', label: 'Gross Unit Price', section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', label: 'Line Net Amount', required: true, section: 'other' },
  { key: 'lineGrossAmount', column: 'Line_Gross_Amount', type: 'number', label: 'Line Gross Amount', readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', label: 'Tax', required: true, section: 'other', reference: 'Tax', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'listPrice', column: 'PriceList', type: 'text', label: 'Net List Price', required: true, readOnly: true, section: 'other' },
  { key: 'grossListPrice', column: 'GrossPriceList', type: 'text', label: 'Gross List Price', readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'discount', column: 'Discount', type: 'text', label: 'Discount %', section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'other' },
  { key: 'taxableAmount', column: 'Taxbaseamt', type: 'number', label: 'Alternate Taxable Amount', section: 'other' },
  { key: 'standardPrice', column: 'PriceStd', type: 'text', label: 'Base Net Unit Price', required: true, readOnly: true, section: 'other' },
  { key: 'reservedQuantity', column: 'QtyReserved', type: 'text', label: 'Reserved Quantity', required: true, readOnly: true, section: 'other' },
  { key: 'deliveredQuantity', column: 'QtyDelivered', type: 'text', label: 'Delivered Quantity', required: true, readOnly: true, section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
  { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'text', label: 'Invoiced Quantity', required: true, readOnly: true, section: 'other' },
  { key: 'project', column: 'C_Project_ID', type: 'search', label: 'Project', section: 'other', reference: 'Project', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', label: 'Cost Center', section: 'other', reference: 'CostCenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', label: 'Asset', section: 'other', reference: 'Asset', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', label: '1st Dimension', section: 'other', reference: 'UserDimension1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', label: '2nd Dimension', section: 'other', reference: 'UserDimension2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
];
// @sf-generated-end fields:orderLine

// @sf-generated-start component:OrderLineForm
export default function OrderLineForm(props) {
  // @sf-custom-slot hooks:OrderLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:OrderLineForm

// @sf-custom-slot section:OrderLineForm-custom

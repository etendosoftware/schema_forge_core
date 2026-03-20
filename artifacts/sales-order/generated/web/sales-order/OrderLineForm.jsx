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
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'text', label: 'Ordered Quantity', required: true, section: 'other' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', label: 'UOM', required: true, readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text', label: 'Attribute Set Value', section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'unitPrice', column: 'PriceActual', type: 'text', label: 'Net Unit Price', required: true, section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'text', label: 'Gross Unit Price', section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', label: 'Line Net Amount', required: true, section: 'other' },
  { key: 'lineGrossAmount', column: 'Line_Gross_Amount', type: 'number', label: 'Line Gross Amount', readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'tax', column: 'C_Tax_ID', type: 'search', label: 'Tax', required: true, section: 'other', reference: 'Tax', inputMode: 'search' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'listPrice', column: 'PriceList', type: 'text', label: 'Net List Price', required: true, section: 'other' },
  { key: 'grossListPrice', column: 'GrossPriceList', type: 'text', label: 'Gross List Price', readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'discount', column: 'Discount', type: 'text', label: 'Discount', section: 'other' },
  { key: 'warehouseRule', column: 'M_Warehouse_Rule_ID', type: 'selector', label: 'Warehouse Rule', section: 'other', reference: 'WarehouseRule', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'other' },
  { key: 'replacedorderline', column: 'Replacedorderline_id', type: 'search', label: 'Replaced Order Line', readOnly: true, section: 'other', reference: 'OrderLine', inputMode: 'search' },
  { key: 'stockReservation', column: 'Create_Reservation', type: 'text', label: 'Stock Reservation', section: 'other' },
  { key: 'taxableAmount', column: 'Taxbaseamt', type: 'number', label: 'Alternate Taxable Amount', section: 'other' },
  { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'text', label: 'Invoiced Quantity', required: true, readOnly: true, section: 'other' },
  { key: 'deliveredQuantity', column: 'QtyDelivered', type: 'text', label: 'Delivered Quantity', required: true, readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'cancelPriceAdjustment', column: 'CANCELPRICEAD', type: 'checkbox', label: 'Cancel Discounts and Promotions', section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
  { key: 'quotationLine', column: 'Quotationline_ID', type: 'search', label: 'Quotation Line', readOnly: true, section: 'other', reference: 'OrderLine', inputMode: 'search' },
  { key: 'reservationStatus', column: 'SO_Res_Status', type: 'text', label: 'Reservation Status', readOnly: true, section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
  { key: 'manageReservation', column: 'Manage_Reservation', type: 'text', label: 'Manage Reservation', section: 'other' },
  { key: 'printDescription', column: 'Print_Description', type: 'checkbox', label: 'Print Description', required: true, readOnly: true, section: 'other' },
  { key: 'overdueReturnDays', column: 'Overdue_Return_Days', type: 'number', label: 'Overdue Return Days', section: 'other' },
  { key: 'project', column: 'C_Project_ID', type: 'search', label: 'Project', section: 'other', reference: 'Project', inputMode: 'search' },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', label: 'Cost Center', section: 'other', reference: 'Costcenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'asset', column: 'A_Asset_ID', type: 'search', label: 'Asset', section: 'other', reference: 'Asset', inputMode: 'search' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', label: '1st Dimension', section: 'other', reference: 'User1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', label: '2nd Dimension', section: 'other', reference: 'User2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'explode', column: 'Explode', type: 'text', label: 'Explode', section: 'other' },
  { key: 'selectOrderLine', column: 'Relate_Orderline', type: 'text', label: 'Select Order Line', required: true, section: 'other' },
];
// @sf-generated-end fields:orderLine

// @sf-generated-start component:OrderLineForm
export default function OrderLineForm(props) {
  // @sf-custom-slot hooks:OrderLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:OrderLineForm

// @sf-custom-slot section:OrderLineForm-custom

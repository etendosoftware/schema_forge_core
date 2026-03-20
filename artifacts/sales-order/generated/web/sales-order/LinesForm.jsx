import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:lines
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Order_Product
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  // @sf-custom-slot callout:OperativeQuantity_To_BaseQuantity
  { key: 'operativeQuantity', column: 'Aumqty', type: 'text', section: 'principal' },
  // @sf-custom-slot callout:OperativeQuantity_To_BaseQuantity
  { key: 'operativeUOM', column: 'C_Aum', type: 'dependent', section: 'principal', reference: 'UOM', inputMode: 'dependent', dependsOn: { field: 'product', filterKey: 'M_Product_ID' } },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'text', required: true, section: 'other' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text', section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'unitPrice', column: 'PriceActual', type: 'text', required: true, section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'text', section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', required: true, section: 'other' },
  { key: 'lineGrossAmount', column: 'Line_Gross_Amount', type: 'number', readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'tax', column: 'C_Tax_ID', type: 'search', required: true, section: 'other', reference: 'Tax', inputMode: 'search' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'listPrice', column: 'PriceList', type: 'text', required: true, section: 'other' },
  { key: 'grossListPrice', column: 'GrossPriceList', type: 'text', readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'discount', column: 'Discount', type: 'text', section: 'other' },
  { key: 'warehouseRule', column: 'M_Warehouse_Rule_ID', type: 'selector', section: 'other', reference: 'WarehouseRule', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'replacedorderline', column: 'Replacedorderline_id', type: 'search', readOnly: true, section: 'other', reference: 'OrderLine', inputMode: 'search' },
  { key: 'stockReservation', column: 'Create_Reservation', type: 'text', section: 'other' },
  { key: 'taxableAmount', column: 'Taxbaseamt', type: 'number', section: 'other' },
  { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'deliveredQuantity', column: 'QtyDelivered', type: 'text', required: true, readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'cancelPriceAdjustment', column: 'CANCELPRICEAD', type: 'checkbox', section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
  { key: 'quotationLine', column: 'Quotationline_ID', type: 'search', readOnly: true, section: 'other', reference: 'OrderLine', inputMode: 'search' },
  { key: 'reservationStatus', column: 'SO_Res_Status', type: 'text', readOnly: true, section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
  { key: 'manageReservation', column: 'Manage_Reservation', type: 'text', section: 'other' },
  { key: 'printDescription', column: 'Print_Description', type: 'checkbox', required: true, readOnly: true, section: 'other' },
  { key: 'overdueReturnDays', column: 'Overdue_Return_Days', type: 'number', section: 'other' },
  { key: 'project', column: 'C_Project_ID', type: 'search', section: 'other', reference: 'Project', inputMode: 'search' },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', section: 'other', reference: 'Costcenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'asset', column: 'A_Asset_ID', type: 'search', section: 'other', reference: 'Asset', inputMode: 'search' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', section: 'other', reference: 'User1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', section: 'other', reference: 'User2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'explode', column: 'Explode', type: 'text', section: 'other' },
  { key: 'selectOrderLine', column: 'Relate_Orderline', type: 'text', required: true, section: 'other' },
];
// @sf-generated-end fields:lines

// @sf-generated-start component:LinesForm
export default function LinesForm(props) {
  // @sf-custom-slot hooks:LinesForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:LinesForm

// @sf-custom-slot section:LinesForm-custom

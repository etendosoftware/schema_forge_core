import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:orderLine
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'text', required: true },
  { key: 'operativeQuantity', column: 'Aumqty', type: 'text' },
  { key: 'alternativeUOM', column: 'C_Aum', type: 'search', reference: 'UOM', inputMode: 'search' },
  { key: 'netUnitPrice', column: 'PriceActual', type: 'text', required: true },
  { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'text' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', required: true },
  { key: 'tax', column: 'C_Tax_ID', type: 'search', required: true, reference: 'Tax', inputMode: 'search' },
  { key: 'netListPrice', column: 'PriceList', type: 'text', required: true },
  { key: 'discount', column: 'Discount', type: 'text' },
  { key: 'warehouseRule', column: 'M_Warehouse_Rule_ID', type: 'selector', reference: 'WarehouseRule', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'stockReservation', column: 'Create_Reservation', type: 'text' },
  { key: 'alternateTaxableAmount', column: 'Taxbaseamt', type: 'number' },
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text' },
  { key: 'cancelDiscountsAndPromotions', column: 'CANCELPRICEAD', type: 'checkbox' },
  { key: 'manageReservation', column: 'Manage_Reservation', type: 'text' },
  { key: 'explode', column: 'Explode', type: 'text' },
  { key: 'selectOrderLine', column: 'Relate_Orderline', type: 'text', required: true },
  { key: 'project', column: 'C_Project_ID', type: 'search', reference: 'Project', inputMode: 'search' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'search', reference: 'CostCenter', inputMode: 'search' },
  { key: 'asset', column: 'A_Asset_ID', type: 'search', reference: 'Asset', inputMode: 'search' },
  { key: 'dimension1', column: 'User1_ID', type: 'search', reference: 'UserDimension1', inputMode: 'search' },
  { key: 'dimension2', column: 'User2_ID', type: 'search', reference: 'UserDimension2', inputMode: 'search' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true },
  { key: 'overdueReturnDays', column: 'Overdue_Return_Days', type: 'number' },
  { key: 'lineGrossAmount', column: 'Line_Gross_Amount', type: 'number', readOnly: true },
  { key: 'grossListPrice', column: 'GrossPriceList', type: 'text', readOnly: true },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', required: true, readOnly: true, reference: 'UOM', inputMode: 'selector' },
  { key: 'deliveredQuantity', column: 'QtyDelivered', type: 'text', required: true, readOnly: true },
  { key: 'replacedOrderLine', column: 'Replacedorderline_id', type: 'search', readOnly: true, reference: 'OrderLine', inputMode: 'search' },
  { key: 'quotationLine', column: 'Quotationline_ID', type: 'search', readOnly: true, reference: 'OrderLine', inputMode: 'search' },
  { key: 'printDescription', column: 'Print_Description', type: 'checkbox', required: true, readOnly: true },
];
// @sf-generated-end fields:orderLine

// @sf-generated-start component:OrderLineForm
export default function OrderLineForm(props) {
  // @sf-custom-slot hooks:OrderLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:OrderLineForm

// @sf-custom-slot section:OrderLineForm-custom

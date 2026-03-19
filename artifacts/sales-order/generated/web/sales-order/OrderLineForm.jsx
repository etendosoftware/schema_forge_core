import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:orderLine
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'text', required: true, section: 'principal' },
  { key: 'operativeQuantity', column: 'Aumqty', type: 'text', section: 'principal' },
  { key: 'alternativeUOM', column: 'C_Aum', type: 'search', section: 'principal', reference: 'UOM', inputMode: 'search' },
  { key: 'netUnitPrice', column: 'PriceActual', type: 'text', required: true, section: 'other' },
  { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'text', section: 'other' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', required: true, section: 'other' },
  { key: 'tax', column: 'C_Tax_ID', type: 'search', required: true, section: 'other', reference: 'Tax', inputMode: 'search' },
  { key: 'netListPrice', column: 'PriceList', type: 'text', required: true, section: 'other' },
  { key: 'discount', column: 'Discount', type: 'text', section: 'other' },
  { key: 'warehouseRule', column: 'M_Warehouse_Rule_ID', type: 'selector', section: 'other', reference: 'WarehouseRule', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'stockReservation', column: 'Create_Reservation', type: 'text', section: 'other' },
  { key: 'alternateTaxableAmount', column: 'Taxbaseamt', type: 'number', section: 'other' },
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text', section: 'other' },
  { key: 'cancelDiscountsAndPromotions', column: 'CANCELPRICEAD', type: 'checkbox', section: 'other' },
  { key: 'manageReservation', column: 'Manage_Reservation', type: 'text', section: 'other' },
  { key: 'explode', column: 'Explode', type: 'text', section: 'other' },
  { key: 'selectOrderLine', column: 'Relate_Orderline', type: 'text', required: true, section: 'other' },
  { key: 'project', column: 'C_Project_ID', type: 'search', section: 'other', reference: 'Project', inputMode: 'search' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'search', section: 'other', reference: 'CostCenter', inputMode: 'search' },
  { key: 'asset', column: 'A_Asset_ID', type: 'search', section: 'other', reference: 'Asset', inputMode: 'search' },
  { key: 'dimension1', column: 'User1_ID', type: 'search', section: 'other', reference: 'UserDimension1', inputMode: 'search' },
  { key: 'dimension2', column: 'User2_ID', type: 'search', section: 'other', reference: 'UserDimension2', inputMode: 'search' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'other' },
  { key: 'overdueReturnDays', column: 'Overdue_Return_Days', type: 'number', section: 'other' },
  { key: 'lineGrossAmount', column: 'Line_Gross_Amount', type: 'number', readOnly: true, section: 'other' },
  { key: 'grossListPrice', column: 'GrossPriceList', type: 'text', readOnly: true, section: 'other' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
  { key: 'deliveredQuantity', column: 'QtyDelivered', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'replacedOrderLine', column: 'Replacedorderline_id', type: 'search', readOnly: true, section: 'other', reference: 'OrderLine', inputMode: 'search' },
  { key: 'quotationLine', column: 'Quotationline_ID', type: 'search', readOnly: true, section: 'other', reference: 'OrderLine', inputMode: 'search' },
  { key: 'printDescription', column: 'Print_Description', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:orderLine

// @sf-generated-start component:OrderLineForm
export default function OrderLineForm(props) {
  // @sf-custom-slot hooks:OrderLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:OrderLineForm

// @sf-custom-slot section:OrderLineForm-custom

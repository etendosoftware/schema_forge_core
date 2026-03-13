import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:orderLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'operativeQuantity', column: 'Aumqty', type: 'text' },
  { key: 'operativeUOM', column: 'C_Aum', type: 'selector', reference: 'UOM', inputMode: 'selector' },
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'text', required: true },
  { key: 'uOM', column: 'C_UOM_ID', type: 'search', required: true, readOnly: true, reference: 'UOM' },
  { key: 'unitPrice', column: 'PriceActual', type: 'text', required: true },
  { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'text' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', required: true },
  { key: 'lineGrossAmount', column: 'Line_Gross_Amount', type: 'number', readOnly: true },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', required: true, reference: 'Tax', inputMode: 'selector' },
  { key: 'listPrice', column: 'PriceList', type: 'text', required: true, readOnly: true },
  { key: 'grossListPrice', column: 'GrossPriceList', type: 'text', readOnly: true },
  { key: 'discount', column: 'Discount', type: 'text' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'taxableAmount', column: 'Taxbaseamt', type: 'number' },
  { key: 'project', column: 'C_Project_ID', type: 'search', reference: 'Project', inputMode: 'search' },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', reference: 'CostCenter', inputMode: 'selector' },
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', reference: 'Asset', inputMode: 'selector' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', reference: 'UserDimension1', inputMode: 'selector' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', reference: 'UserDimension2', inputMode: 'selector' },
];
// @sf-generated-end fields:orderLine

// @sf-generated-start component:OrderLineForm
export default function OrderLineForm(props) {
  // @sf-custom-slot hooks:OrderLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:OrderLineForm

// @sf-custom-slot section:OrderLineForm-custom

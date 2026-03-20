import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:invoiceLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  { key: 'product', column: 'M_Product_ID', type: 'search', section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'account', column: 'Account_ID', type: 'search', section: 'principal', reference: 'GLAccount', inputMode: 'search' },
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'selector', section: 'principal', reference: 'AttributeSetInstance', inputMode: 'selector' },
  { key: 'operativeQuantity', column: 'Aumqty', type: 'number', section: 'other' },
  { key: 'operativeUOM', column: 'C_Aum', type: 'selector', section: 'other', reference: 'UOM', inputMode: 'selector' },
  { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'number', required: true, section: 'other' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', required: true, section: 'other' },
  { key: 'listPrice', column: 'PriceList', type: 'number', readOnly: true, section: 'other' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', readOnly: true, section: 'other' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', required: true, section: 'other', reference: 'Tax', inputMode: 'selector' },
  { key: 'taxableAmount', column: 'Taxbaseamt', type: 'number', readOnly: true, section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'salesOrderLine', column: 'C_OrderLine_ID', type: 'selector', readOnly: true, section: 'other', reference: 'OrderLine', inputMode: 'selector' },
  { key: 'goodsShipmentLine', column: 'M_InOutLine_ID', type: 'selector', readOnly: true, section: 'other', reference: 'GoodsShipmentLine', inputMode: 'selector' },
  { key: 'project', column: 'C_Project_ID', type: 'search', section: 'other', reference: 'Project', inputMode: 'search' },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', section: 'other', reference: 'CostCenter', inputMode: 'selector' },
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', section: 'other', reference: 'Asset', inputMode: 'selector' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', section: 'other', reference: 'UserDimension1', inputMode: 'selector' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', section: 'other', reference: 'UserDimension2', inputMode: 'selector' },
];
// @sf-generated-end fields:invoiceLine

// @sf-generated-start component:InvoiceLineForm
export default function InvoiceLineForm(props) {
  // @sf-custom-slot hooks:InvoiceLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InvoiceLineForm

// @sf-custom-slot section:InvoiceLineForm-custom

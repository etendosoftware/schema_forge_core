import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:invoiceLine
const fields = [
  { key: 'line', column: 'Line', type: 'number', required: true, section: 'principal' },
  { key: 'financialInvoiceLine', column: 'Financial_Invoice_Line', type: 'checkbox', required: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Invoice_Product
  { key: 'mProductId', column: 'M_Product_ID', type: 'selector', section: 'principal', reference: 'Product', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_Invoice_Glitem
  { key: 'accountId', column: 'Account_ID', type: 'search', section: 'principal', reference: 'Glitem', inputMode: 'search' },
  // @sf-custom-slot callout:OperativeQuantity_To_BaseQuantity
  { key: 'aumqty', column: 'Aumqty', type: 'text', section: 'other' },
  // @sf-custom-slot callout:OperativeQuantity_To_BaseQuantity
  { key: 'cAum', column: 'C_Aum', type: 'search', section: 'other', reference: 'UOM', inputMode: 'search' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'qtyInvoiced', column: 'QtyInvoiced', type: 'text', required: true, section: 'other' },
  { key: 'cUomId', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'priceActual', column: 'PriceActual', type: 'text', required: true, section: 'other' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'text', section: 'other' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'lineNetAmt', column: 'LineNetAmt', type: 'number', required: true, section: 'other' },
  { key: 'lineGrossAmount', column: 'Line_Gross_Amount', type: 'number', readOnly: true, section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'cTaxId', column: 'C_Tax_ID', type: 'search', section: 'other', reference: 'Tax', inputMode: 'search' },
  { key: 'priceList', column: 'PriceList', type: 'text', required: true, section: 'other' },
  { key: 'grosspricelist', column: 'Grosspricelist', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'mAttributeSetInstanceId', column: 'M_AttributeSetInstance_ID', type: 'text', section: 'other' },
  { key: 'cOrderLineId', column: 'C_OrderLine_ID', type: 'search', readOnly: true, section: 'other', reference: 'OrderLine', inputMode: 'search' },
  { key: 'mInOutLineId', column: 'M_InOutLine_ID', type: 'search', readOnly: true, section: 'other', reference: 'InOutLine', inputMode: 'search' },
  { key: 'isDeferred', column: 'IsDeferred', type: 'checkbox', required: true, section: 'other' },
  { key: 'taxbaseamt', column: 'Taxbaseamt', type: 'number', section: 'other' },
  { key: 'grosspricestd', column: 'grosspricestd', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'priceStd', column: 'PriceStd', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'defPlanType', column: 'DefPlanType', type: 'text', section: 'other' },
  { key: 'periodnumber', column: 'Periodnumber', type: 'number', section: 'other' },
  { key: 'cPeriodId', column: 'C_Period_ID', type: 'search', section: 'other', reference: 'Period', inputMode: 'search' },
  { key: 'cBpartnerId', column: 'C_Bpartner_ID', type: 'search', section: 'other', reference: 'BPartner', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'cProjectId', column: 'C_Project_ID', type: 'search', section: 'other', reference: 'Project', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'cCostcenterId', column: 'C_Costcenter_ID', type: 'selector', section: 'other', reference: 'Costcenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'aAssetId', column: 'A_Asset_ID', type: 'selector', section: 'other', reference: 'Asset', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'user1Id', column: 'User1_ID', type: 'selector', section: 'other', reference: 'User1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'user2Id', column: 'User2_ID', type: 'selector', section: 'other', reference: 'User2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'explode', column: 'Explode', type: 'text', section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
  { key: 'matchLccosts', column: 'Match_Lccosts', type: 'text', section: 'other' },
];
// @sf-generated-end fields:invoiceLine

// @sf-generated-start component:InvoiceLineForm
export default function InvoiceLineForm(props) {
  // @sf-custom-slot hooks:InvoiceLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InvoiceLineForm

// @sf-custom-slot section:InvoiceLineForm-custom

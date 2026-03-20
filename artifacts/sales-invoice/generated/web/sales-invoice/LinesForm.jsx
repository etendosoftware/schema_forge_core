import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:lines
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Invoice_Product
  { key: 'product', column: 'M_Product_ID', type: 'search', section: 'principal', reference: 'Product', inputMode: 'search' },
  // @sf-custom-slot callout:OperativeQuantity_To_BaseQuantity
  { key: 'operativeQuantity', column: 'Aumqty', type: 'text', section: 'principal' },
  // @sf-custom-slot callout:OperativeQuantity_To_BaseQuantity
  { key: 'operativeUOM', column: 'C_Aum', type: 'dependent', section: 'principal', reference: 'UOM', inputMode: 'dependent', dependsOn: { field: 'product', filterKey: 'M_Product_ID' } },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'text', required: true, section: 'other' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'unitPrice', column: 'PriceActual', type: 'text', required: true, section: 'other' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'text', section: 'other' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'grossAmount', column: 'Line_Gross_Amount', type: 'number', readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', section: 'other', reference: 'Tax', inputMode: 'selector' },
  { key: 'listPrice', column: 'PriceList', type: 'text', required: true, section: 'other' },
  { key: 'grossListPrice', column: 'Grosspricelist', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'financialInvoiceLine', column: 'Financial_Invoice_Line', type: 'checkbox', required: true, section: 'other' },
  // @sf-custom-slot callout:SL_Invoice_Glitem
  { key: 'account', column: 'Account_ID', type: 'search', section: 'other', reference: 'Glitem', inputMode: 'search' },
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text', section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'taxableAmount', column: 'Taxbaseamt', type: 'number', section: 'other' },
  { key: 'deferred', column: 'IsDeferred', type: 'checkbox', required: true, section: 'other' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'cancelPriceAdjustment', column: 'CANCELPRICEAD', type: 'checkbox', section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
  { key: 'baseGrossUnitPrice', column: 'grosspricestd', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'standardPrice', column: 'PriceStd', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'deferredPlanType', column: 'DefPlanType', type: 'text', section: 'other' },
  { key: 'periodNumber', column: 'Periodnumber', type: 'number', section: 'other' },
  { key: 'period', column: 'C_Period_ID', type: 'search', section: 'other', reference: 'Period', inputMode: 'search' },
  { key: 'project', column: 'C_Project_ID', type: 'search', section: 'other', reference: 'Project', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', section: 'other', reference: 'Costcenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', section: 'other', reference: 'Asset', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', section: 'other', reference: 'User1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', section: 'other', reference: 'User2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'explode', column: 'Explode', type: 'text', section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', section: 'other', reference: 'BPartner', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
];
// @sf-generated-end fields:lines

// @sf-generated-start component:LinesForm
export default function LinesForm(props) {
  // @sf-custom-slot hooks:LinesForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:LinesForm

// @sf-custom-slot section:LinesForm-custom

import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:invoiceLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.', required: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Invoice_Product
  { key: 'product', column: 'M_Product_ID', type: 'search', label: 'Product', section: 'principal', reference: 'Product', inputMode: 'search' },
  // @sf-custom-slot callout:OperativeQuantity_To_BaseQuantity
  { key: 'operativeQuantity', column: 'Aumqty', type: 'text', label: 'Operative Quantity', section: 'principal' },
  // @sf-custom-slot callout:OperativeQuantity_To_BaseQuantity
  { key: 'operativeUOM', column: 'C_Aum', type: 'dependent', label: 'Alternative UOM', section: 'principal', reference: 'UOM', inputMode: 'dependent', dependsOn: { field: 'product', filterKey: 'M_Product_ID' } },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'text', label: 'Invoiced Quantity', required: true, section: 'other' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', label: 'UOM', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'unitPrice', column: 'PriceActual', type: 'text', label: 'Net Unit Price', required: true, section: 'other' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'text', label: 'Gross Unit Price', section: 'other' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', label: 'Line Net Amount', required: true, readOnly: true, section: 'other' },
  { key: 'grossAmount', column: 'Line_Gross_Amount', type: 'number', label: 'Line Gross Amount', readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', label: 'Tax', section: 'other', reference: 'Tax', inputMode: 'selector' },
  { key: 'listPrice', column: 'PriceList', type: 'text', label: 'List Price', required: true, section: 'other' },
  { key: 'grossListPrice', column: 'Grosspricelist', type: 'text', label: 'Gross List Price', required: true, readOnly: true, section: 'other' },
  { key: 'financialInvoiceLine', column: 'Financial_Invoice_Line', type: 'checkbox', label: 'Financial Invoice Line', required: true, section: 'other' },
  // @sf-custom-slot callout:SL_Invoice_Glitem
  { key: 'account', column: 'Account_ID', type: 'search', label: 'Account', section: 'other', reference: 'Glitem', inputMode: 'search' },
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text', label: 'Attribute Set Value', section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'other' },
  { key: 'taxableAmount', column: 'Taxbaseamt', type: 'number', label: 'Alternate Taxable Amount', section: 'other' },
  { key: 'deferred', column: 'IsDeferred', type: 'checkbox', label: 'Deferred Revenue', required: true, section: 'other' },
  // @sf-custom-slot callout:SL_Invoice_Amt
  { key: 'cancelPriceAdjustment', column: 'CANCELPRICEAD', type: 'checkbox', label: 'Cancel Discounts and Promotions', section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
  { key: 'baseGrossUnitPrice', column: 'grosspricestd', type: 'text', label: 'Base Gross Unit Price', required: true, readOnly: true, section: 'other' },
  { key: 'standardPrice', column: 'PriceStd', type: 'text', label: 'Base Net Unit Price', required: true, readOnly: true, section: 'other' },
  { key: 'deferredPlanType', column: 'DefPlanType', type: 'text', label: 'Revenue Plan Type', section: 'other' },
  { key: 'periodNumber', column: 'Periodnumber', type: 'number', label: 'Period Number', section: 'other' },
  { key: 'period', column: 'C_Period_ID', type: 'search', label: 'Starting Period', section: 'other', reference: 'Period', inputMode: 'search' },
  { key: 'project', column: 'C_Project_ID', type: 'search', label: 'Project', section: 'other', reference: 'Project', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', label: 'Cost Center', section: 'other', reference: 'Costcenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', label: 'Asset', section: 'other', reference: 'Asset', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', label: '1st Dimension', section: 'other', reference: 'User1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', label: '2nd Dimension', section: 'other', reference: 'User2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'explode', column: 'Explode', type: 'text', label: 'Explode', section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', label: 'Business Partner', section: 'other', reference: 'BPartner', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
];
// @sf-generated-end fields:invoiceLine

// @sf-generated-start component:InvoiceLineForm
export default function InvoiceLineForm(props) {
  // @sf-custom-slot hooks:InvoiceLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InvoiceLineForm

// @sf-custom-slot section:InvoiceLineForm-custom

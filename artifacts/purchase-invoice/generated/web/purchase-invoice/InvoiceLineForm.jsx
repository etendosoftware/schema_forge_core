import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:invoiceLine
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'number', required: true, section: 'principal' },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', required: true, section: 'principal' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', section: 'principal', reference: 'Tax', inputMode: 'selector' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', required: true, section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'account', column: 'Account_ID', type: 'selector', section: 'other', reference: 'Account', inputMode: 'selector' },
  { key: 'financialInvoiceLine', column: 'Financial_Invoice_Line', type: 'checkbox', required: true, section: 'other' },
  { key: 'operativeQuantity', column: 'Aumqty', type: 'number', section: 'other' },
  { key: 'alternativeUOM', column: 'C_Aum', type: 'selector', section: 'other', reference: 'UOM', inputMode: 'selector' },
  { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'number', section: 'other' },
  { key: 'listPrice', column: 'PriceList', type: 'number', required: true, section: 'other' },
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'selector', section: 'other', reference: 'AttributeSetInstance', inputMode: 'selector' },
  { key: 'deferredExpense', column: 'IsDeferred', type: 'checkbox', required: true, section: 'other' },
  { key: 'taxableAmount', column: 'Taxbaseamt', type: 'number', section: 'other' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'uom', column: 'C_UOM_ID', type: 'search', readOnly: true, section: 'other', reference: 'UOM' },
  { key: 'lineGrossAmount', column: 'Line_Gross_Amount', type: 'number', readOnly: true, section: 'other' },
  { key: 'purchaseOrderLine', column: 'C_OrderLine_ID', type: 'search', readOnly: true, section: 'other', reference: 'OrderLine' },
  { key: 'goodsReceiptLine', column: 'M_InOutLine_ID', type: 'search', readOnly: true, section: 'other', reference: 'InOutLine' },
  { key: 'baseGrossUnitPrice', column: 'grosspricestd', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'baseNetUnitPrice', column: 'PriceStd', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'grossListPrice', column: 'Grosspricelist', type: 'number', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:invoiceLine

// @sf-generated-start component:InvoiceLineForm
export default function InvoiceLineForm(props) {
  // @sf-custom-slot hooks:InvoiceLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InvoiceLineForm

// @sf-custom-slot section:InvoiceLineForm-custom

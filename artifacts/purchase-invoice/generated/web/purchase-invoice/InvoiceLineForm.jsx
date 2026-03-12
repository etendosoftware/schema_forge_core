import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:invoiceLine
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', reference: 'Product', inputMode: 'search' },
  { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'number', required: true },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', required: true },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', reference: 'Tax', inputMode: 'selector' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'account', column: 'Account_ID', type: 'selector', reference: 'Account', inputMode: 'selector' },
  { key: 'financialInvoiceLine', column: 'Financial_Invoice_Line', type: 'checkbox', required: true },
  { key: 'operativeQuantity', column: 'Aumqty', type: 'number' },
  { key: 'alternativeUOM', column: 'C_Aum', type: 'selector', reference: 'UOM', inputMode: 'selector' },
  { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'number' },
  { key: 'listPrice', column: 'PriceList', type: 'number', required: true },
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'selector', reference: 'AttributeSetInstance', inputMode: 'selector' },
  { key: 'deferredExpense', column: 'IsDeferred', type: 'checkbox', required: true },
  { key: 'taxableAmount', column: 'Taxbaseamt', type: 'number' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true, readOnly: true },
  { key: 'uom', column: 'C_UOM_ID', type: 'search', readOnly: true, reference: 'UOM' },
  { key: 'lineGrossAmount', column: 'Line_Gross_Amount', type: 'number', readOnly: true },
  { key: 'purchaseOrderLine', column: 'C_OrderLine_ID', type: 'search', readOnly: true, reference: 'OrderLine' },
  { key: 'goodsReceiptLine', column: 'M_InOutLine_ID', type: 'search', readOnly: true, reference: 'InOutLine' },
  { key: 'baseGrossUnitPrice', column: 'grosspricestd', type: 'number', required: true, readOnly: true },
  { key: 'baseNetUnitPrice', column: 'PriceStd', type: 'number', required: true, readOnly: true },
  { key: 'grossListPrice', column: 'Grosspricelist', type: 'number', required: true, readOnly: true },
];
// @sf-generated-end fields:invoiceLine

// @sf-generated-start component:InvoiceLineForm
export default function InvoiceLineForm(props) {
  // @sf-custom-slot hooks:InvoiceLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InvoiceLineForm

// @sf-custom-slot section:InvoiceLineForm-custom

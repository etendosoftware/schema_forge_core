import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:lines
const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', label: 'Product', lookup: true, section: 'principal', reference: 'Product', inputMode: 'search', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'number', label: 'Invoiced Quantity', required: true, section: 'principal', defaultValue: '1', readOnlyLogic: (record) => record['processed'] === true || (record['uomManagement'] === 'Y' && record['financialInvoiceLine'] !== true) },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', label: 'Net Unit Price', required: true, section: 'principal', readOnlyLogic: (record) => record['processed'] === true || record['gROSSPRICE'] === 'Y' },
  { key: 'grossAmount', column: 'Line_Gross_Amount', type: 'number', label: 'Line Gross Amount', readOnly: true, section: 'principal', defaultValue: '0' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'principal' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', label: 'Tax', section: 'principal', reference: 'Tax', inputMode: 'selector', readOnlyLogic: (record) => record['processed'] === true },
];
// @sf-generated-end fields:lines

// @sf-generated-start component:LinesForm
export default function LinesForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
LinesForm.hasCollapsedFields = false;
// @sf-generated-end component:LinesForm

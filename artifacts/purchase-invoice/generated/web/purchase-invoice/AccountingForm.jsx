import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:accounting
const fields = [
  { key: 'accountingDate', column: 'DateAcct', type: 'date', readOnly: true, section: 'other' },
  { key: 'account', column: 'Account_ID', type: 'selector', readOnly: true, section: 'other', reference: 'Account', inputMode: 'selector' },
  { key: 'debit', column: 'AmtAcctDr', type: 'number', readOnly: true, section: 'other' },
  { key: 'credit', column: 'AmtAcctCr', type: 'number', readOnly: true, section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', readOnly: true, section: 'other' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector', readOnly: true, section: 'other', reference: 'BusinessPartner', inputMode: 'selector' },
  { key: 'product', column: 'M_Product_ID', type: 'selector', readOnly: true, section: 'other', reference: 'Product', inputMode: 'selector' },
  { key: 'accountingSchema', column: 'C_AcctSchema_ID', type: 'selector', readOnly: true, section: 'other', reference: 'AccountingSchema', inputMode: 'selector' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', readOnly: true, section: 'other', reference: 'Currency', inputMode: 'selector' },
  { key: 'period', column: 'C_Period_ID', type: 'selector', readOnly: true, section: 'other', reference: 'Period', inputMode: 'selector' },
];
// @sf-generated-end fields:accounting

// @sf-generated-start component:AccountingForm
export default function AccountingForm(props) {
  // @sf-custom-slot hooks:AccountingForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:AccountingForm

// @sf-custom-slot section:AccountingForm-custom

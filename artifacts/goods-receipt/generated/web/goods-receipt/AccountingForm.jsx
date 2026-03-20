import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:accounting
const fields = [
  { key: 'account', column: 'Account_ID', type: 'text', readOnly: true, section: 'other' },
  { key: 'accountingDate', column: 'DateAcct', type: 'date', readOnly: true, section: 'other' },
  { key: 'postingType', column: 'PostingType', type: 'text', readOnly: true, section: 'other' },
  { key: 'debit', column: 'AmtAcctDr', type: 'number', readOnly: true, section: 'other' },
  { key: 'credit', column: 'AmtAcctCr', type: 'number', readOnly: true, section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', readOnly: true, section: 'other' },
];
// @sf-generated-end fields:accounting

// @sf-generated-start component:AccountingForm
export default function AccountingForm(props) {
  // @sf-custom-slot hooks:AccountingForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:AccountingForm

// @sf-custom-slot section:AccountingForm-custom

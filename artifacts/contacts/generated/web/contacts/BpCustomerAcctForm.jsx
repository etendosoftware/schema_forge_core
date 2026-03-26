import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:bpCustomerAcct
const fields = [
  { key: 'accountingSchema', column: 'C_AcctSchema_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'AcctSchema', inputMode: 'selector' },
  { key: 'customerReceivablesNo', column: 'C_Receivable_Acct', type: 'selector', required: true, section: 'principal', reference: 'ValidCombination', inputMode: 'selector' },
  { key: 'customerPrepayment', column: 'C_Prepayment_Acct', type: 'selector', section: 'principal', reference: 'ValidCombination', inputMode: 'selector' },
];
// @sf-generated-end fields:bpCustomerAcct

// @sf-generated-start component:BpCustomerAcctForm
export default function BpCustomerAcctForm(props) {
  // @sf-custom-slot hooks:BpCustomerAcctForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:BpCustomerAcctForm

// @sf-custom-slot section:BpCustomerAcctForm-custom

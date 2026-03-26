import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:bpVendorAcct
const fields = [
  { key: 'accountingSchema', column: 'C_AcctSchema_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'AcctSchema', inputMode: 'selector' },
  { key: 'vendorLiability', column: 'V_Liability_Acct', type: 'selector', required: true, section: 'principal', reference: 'ValidCombination', inputMode: 'selector' },
  { key: 'vendorPrepayment', column: 'V_Prepayment_Acct', type: 'selector', section: 'principal', reference: 'ValidCombination', inputMode: 'selector' },
];
// @sf-generated-end fields:bpVendorAcct

// @sf-generated-start component:BpVendorAcctForm
export default function BpVendorAcctForm(props) {
  // @sf-custom-slot hooks:BpVendorAcctForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:BpVendorAcctForm

// @sf-custom-slot section:BpVendorAcctForm-custom

import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:bpBankAccount
const fields = [
  { key: 'bankName', column: 'Bank_Name', type: 'text', section: 'principal' },
  { key: 'country', column: 'C_Country_ID', type: 'selector', section: 'principal', reference: 'Country', inputMode: 'selector' },
  { key: 'userContact', column: 'AD_User_ID', type: 'selector', section: 'principal', reference: 'User', inputMode: 'selector' },
  { key: 'bankFormat', column: 'BankFormat', type: 'select', required: true, section: 'principal', options: [
    { value: 'GENERIC', label: 'Use Generic Account No.' },
    { value: 'IBAN', label: 'Use IBAN' },
    { value: 'SWIFT', label: 'Use SWIFT + Generic Account No.' },
  ] },
  { key: 'accountNo', column: 'AccountNo', type: 'text', section: 'other' },
  { key: 'iBAN', column: 'Iban', type: 'text', section: 'other' },
  { key: 'swiftCode', column: 'SwiftCode', type: 'text', section: 'other' },
  { key: 'displayedAccount', column: 'Displayedaccount', type: 'text', readOnly: true, section: 'other' },
];
// @sf-generated-end fields:bpBankAccount

// @sf-generated-start component:BpBankAccountForm
export default function BpBankAccountForm(props) {
  // @sf-custom-slot hooks:BpBankAccountForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:BpBankAccountForm

// @sf-custom-slot section:BpBankAccountForm-custom

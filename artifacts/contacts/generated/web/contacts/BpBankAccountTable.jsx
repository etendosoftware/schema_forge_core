import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:bpBankAccount
const columns = [
  { key: 'bankName', column: 'Bank_Name', type: 'string' },
  { key: 'bankFormat', column: 'BankFormat', type: 'string' },
  { key: 'accountNo', column: 'AccountNo', type: 'string' },
  { key: 'iBAN', column: 'Iban', type: 'string' },
];
// @sf-generated-end columns:bpBankAccount

const filters = [];

// @sf-generated-start component:BpBankAccountTable
export default function BpBankAccountTable(props) {
  // @sf-custom-slot hooks:BpBankAccountTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:BpBankAccountTable

// @sf-custom-slot section:BpBankAccountTable-custom

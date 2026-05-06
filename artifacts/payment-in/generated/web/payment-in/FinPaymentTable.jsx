import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:finPayment
const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'paymentDate', column: 'Paymentdate', type: 'date', label: 'Payment Date' },
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'selector', label: 'Received From' },
  { key: 'amount', column: 'Amount', type: 'amount', label: 'Amount' },
  { key: 'status', column: 'Status', type: 'status', label: 'Status', enumLabels: { 'RPAP': 'Awaiting Payment', 'RPAE': 'Awaiting Execution', 'RPVOID': 'Void', 'PPM': 'Payment Made', 'RPR': 'Payment Received', 'RDNC': 'Deposited not Cleared', 'PWNC': 'Withdrawn not Cleared', 'RPPC': 'Payment Cleared' } },
];
// @sf-generated-end columns:finPayment

const filters = ['documentNo', 'paymentDate', 'businessPartner'];

// @sf-generated-start component:FinPaymentTable
export default function FinPaymentTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:FinPaymentTable

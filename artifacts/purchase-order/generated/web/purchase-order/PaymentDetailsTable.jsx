import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:paymentDetails
const columns = [
  { key: 'payment', column: 'FIN_Payment_ID', type: 'selector', label: 'Payment Out' },
  { key: 'paymentDate', column: 'Paymentdate', type: 'date', label: 'Payment Date' },
  { key: 'paymentMethod', column: 'Fin_Paymentmethod_ID', type: 'selector', label: 'Payment Method' },
  { key: 'expected', column: 'Expected', type: 'amount', label: 'Expected Amount' },
  { key: 'paidAmount', column: 'Paidamt', type: 'amount', label: 'Paid Amount' },
  { key: 'status', column: 'Status', type: 'status', label: 'Status', enumLabels: { 'RPAP': 'Awaiting Payment', 'RPAE': 'Awaiting Execution', 'RPVOID': 'Void', 'PPM': 'Payment Made', 'RPR': 'Payment Received', 'RDNC': 'Deposited not Cleared', 'PWNC': 'Withdrawn not Cleared', 'RPPC': 'Payment Cleared' } },
];
// @sf-generated-end columns:paymentDetails

const filters = [];

// @sf-generated-start component:PaymentDetailsTable
export default function PaymentDetailsTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:PaymentDetailsTable

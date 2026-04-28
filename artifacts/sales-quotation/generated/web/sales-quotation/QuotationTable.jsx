import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:quotation
const columns = [
  { key: 'orderDate', column: 'DateOrdered', type: 'date', label: 'Quotation Date' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector', label: 'Business Partner' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', label: 'Document Status', enumLabels: { 'AE': 'Automatic Evaluation', 'CO': 'Booked', 'CL': 'Closed', 'CA': 'Closed - Order Created', 'CJ': 'Closed - Rejected', 'DR': 'Draft', 'ME': 'Manual Evaluation', 'NA': 'Not Accepted', 'NC': 'Not Confirmed', 'WP': 'Not Paid', 'RE': 'Re-Opened', 'TMP': 'Temporal', 'UE': 'Under Evaluation', 'IP': 'Under Way', '??': 'Unknown', 'VO': 'Voided' } },
  { key: 'validUntil', column: 'validuntil', type: 'date', label: 'Valid Until' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount', label: 'Total Gross Amount' },
];
// @sf-generated-end columns:quotation

const filters = ['documentNo', 'orderDate', 'businessPartner', 'validUntil', 'documentStatus'];

// @sf-generated-start component:QuotationTable
export default function QuotationTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:QuotationTable

import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:header
const columns = [
  { key: 'orderDate', column: 'DateOrdered', type: 'date', label: 'Order Date' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector', label: 'Business Partner' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', label: 'Document Status', enumLabels: { 'AE': 'Automatic Evaluation', 'CO': 'Booked', 'CL': 'Closed', 'ETGO_CI': 'Closed - Invoice Created', 'CA': 'Closed - Order Created', 'CJ': 'Closed - Rejected', 'DR': 'Draft', 'ME': 'Manual Evaluation', 'NA': 'Not Accepted', 'NC': 'Not Confirmed', 'WP': 'Not Paid', 'RE': 'Re-Opened', 'TMP': 'Temporal', 'UE': 'Under Evaluation', 'IP': 'Under Way', '??': 'Unknown', 'VO': 'Voided' } },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount', label: 'Total Gross Amount' },
  { key: 'invoiceStatus', column: 'InvoiceStatus', type: 'percent', label: 'Invoice Status' },
  { key: 'deliveryStatus', column: 'DeliveryStatus', type: 'percent', label: 'Shipment Status' },
];
// @sf-generated-end columns:header

const filters = ['documentNo', 'orderDate', 'businessPartner', 'documentStatus'];

// @sf-generated-start component:HeaderTable
export default function HeaderTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:HeaderTable

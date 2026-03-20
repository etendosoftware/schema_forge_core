import { DataTable } from '@/components/contract-ui';

const documentStatusLabels = {
  'CL': 'Closed',
  'CO': 'Completed',
  'DR': 'Draft',
  'NA': 'Not Accepted',
  'WP': 'Not Paid',
  'RE': 'Re-Opened',
  'TEMP': 'Temporal',
  'IP': 'Under Way',
  '??': 'Unknown',
  'VO': 'Voided',
};

// @sf-generated-start columns:invoice
const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'invoiceDate', column: 'DateInvoiced', type: 'date' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'documentStatus', column: 'DocStatus', type: 'enum', enumLabels: documentStatusLabels },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
];
// @sf-generated-end columns:invoice

const filters = ['documentNo', 'invoiceDate', 'businessPartner', 'documentStatus', 'orderReference'];

// @sf-generated-start component:InvoiceTable
export default function InvoiceTable(props) {
  // @sf-custom-slot hooks:InvoiceTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:InvoiceTable

// @sf-custom-slot section:InvoiceTable-custom

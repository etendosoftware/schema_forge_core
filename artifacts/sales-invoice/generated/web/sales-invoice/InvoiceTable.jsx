import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:invoice
const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'invoiceDate', column: 'DateInvoiced', type: 'date' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'paymentComplete', column: 'Ispaid', type: 'boolean', badge: true, badgeLabels: { true: 'Paid', false: 'Pending' } },
];
// @sf-generated-end columns:invoice

const filters = ['documentNo', 'invoiceDate', 'businessPartner', 'documentStatus'];

// @sf-generated-start component:InvoiceTable
export default function InvoiceTable(props) {
  // @sf-custom-slot hooks:InvoiceTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:InvoiceTable

// @sf-custom-slot section:InvoiceTable-custom

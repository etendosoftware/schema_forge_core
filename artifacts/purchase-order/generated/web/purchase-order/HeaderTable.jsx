import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:header
const columns = [
  { key: 'orderDate', column: 'DateOrdered', type: 'date', label: 'Order Date' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string', label: 'Business Partner' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', label: 'Document Status' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount', label: 'Total Gross Amount' },
  { key: 'invoiceStatus', column: 'InvoiceStatus', type: 'number', label: 'Invoice Status' },
  { key: 'deliveryStatusPurchase', column: 'DeliveryStatusPurchase', type: 'number', label: 'Delivery Status' },
];
// @sf-generated-end columns:header

const filters = ['businessPartner', 'documentNo', 'orderDate', 'documentStatus', 'orderReference'];

// @sf-generated-start component:HeaderTable
export default function HeaderTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:HeaderTable

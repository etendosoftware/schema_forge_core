import { DataTable } from '@/components/contract-ui';

const documentStatusLabels = {
  'AE': 'Automatic Evaluation',
  'CO': 'Booked',
  'CL': 'Closed',
  'CA': 'Closed - Order Created',
  'CJ': 'Closed - Rejected',
  'DR': 'Draft',
  'ME': 'Manual Evaluation',
  'NA': 'Not Accepted',
  'NC': 'Not Confirmed',
  'WP': 'Not Paid',
  'RE': 'Re-Opened',
  'TMP': 'Temporal',
  'UE': 'Under Evaluation',
  'IP': 'Under Way',
  '??': 'Unknown',
  'VO': 'Voided',
};

// @sf-generated-start columns:quotation
const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'orderDate', column: 'DateOrdered', type: 'date' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'documentStatus', column: 'DocStatus', type: 'enum', enumLabels: documentStatusLabels },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'salesRepresentative', column: 'SalesRep_ID', type: 'string' },
];
// @sf-generated-end columns:quotation

const filters = ['documentNo', 'orderDate', 'businessPartner', 'documentStatus'];

// @sf-generated-start component:QuotationTable
export default function QuotationTable(props) {
  // @sf-custom-slot hooks:QuotationTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:QuotationTable

// @sf-custom-slot section:QuotationTable-custom

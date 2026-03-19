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

// @sf-generated-start columns:order
const columns = [
  { key: 'transactionDocument', column: 'C_DocTypeTarget_ID', type: 'string' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'orderDate', column: 'DateOrdered', type: 'date' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string' },
  { key: 'priceList', column: 'M_PriceList_ID', type: 'string' },
  { key: 'documentStatus', column: 'DocStatus', type: 'enum', enumLabels: documentStatusLabels },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
];
// @sf-generated-end columns:order

const filters = ['documentNo', 'orderDate', 'businessPartner', 'documentStatus', 'orderReference'];

// @sf-generated-start component:OrderTable
export default function OrderTable(props) {
  // @sf-custom-slot hooks:OrderTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:OrderTable

// @sf-custom-slot section:OrderTable-custom

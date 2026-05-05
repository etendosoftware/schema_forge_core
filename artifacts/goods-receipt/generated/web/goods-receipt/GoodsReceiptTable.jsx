import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:goodsReceipt
const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', label: 'Warehouse' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector', label: 'Business Partner' },
  { key: 'movementDate', column: 'MovementDate', type: 'date', label: 'Movement Date' },
  { key: 'orderReference', column: 'POReference', type: 'string', label: 'Order Reference' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', label: 'Document Status', enumLabels: { 'CL': 'Closed', 'CO': 'Completed', 'DR': 'Draft', 'NA': 'Not Accepted', 'WP': 'Not Paid', 'RE': 'Re-Opened', 'TEMP': 'Temporal', 'IP': 'Under Way', '??': 'Unknown', 'VO': 'Voided' } },
];
// @sf-generated-end columns:goodsReceipt

const filters = ['documentNo', 'businessPartner', 'movementDate', 'orderReference', 'documentStatus'];

// @sf-generated-start component:GoodsReceiptTable
export default function GoodsReceiptTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:GoodsReceiptTable

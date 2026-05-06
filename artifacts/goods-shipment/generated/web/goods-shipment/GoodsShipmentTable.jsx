import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:goodsShipment
const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', label: 'Warehouse' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector', label: 'Business Partner' },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'selector', label: 'Partner Address' },
  { key: 'movementDate', column: 'MovementDate', type: 'date', label: 'Movement Date' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', label: 'Document Status', enumLabels: { 'CL': 'Closed', 'CO': 'Completed', 'DR': 'Draft', 'NA': 'Not Accepted', 'WP': 'Not Paid', 'RE': 'Re-Opened', 'TEMP': 'Temporal', 'IP': 'Under Way', '??': 'Unknown', 'VO': 'Voided' } },
  { key: 'invoiced', column: 'Iscompletelyinvoiced', type: 'boolean', label: 'Completely Invoiced', badge: true, badgeLabels: {"true":"Invoiced","false":"Pending"} },
];
// @sf-generated-end columns:goodsShipment

const filters = ['documentNo', 'warehouse', 'businessPartner', 'movementDate', 'documentStatus'];

// @sf-generated-start component:GoodsShipmentTable
export default function GoodsShipmentTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:GoodsShipmentTable

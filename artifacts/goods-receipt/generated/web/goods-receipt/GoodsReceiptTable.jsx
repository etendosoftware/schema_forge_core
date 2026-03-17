import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:goodsReceipt
const columns = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'movementDate', column: 'MovementDate', type: 'date' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
];
// @sf-generated-end columns:goodsReceipt

const filters = ['businessPartner', 'movementDate', 'warehouse', 'poReference', 'documentNo', 'docStatus'];

// @sf-generated-start component:GoodsReceiptTable
export default function GoodsReceiptTable(props) {
  // @sf-custom-slot hooks:GoodsReceiptTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:GoodsReceiptTable

// @sf-custom-slot section:GoodsReceiptTable-custom

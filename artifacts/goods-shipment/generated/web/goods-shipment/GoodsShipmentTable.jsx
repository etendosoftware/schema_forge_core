import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:goodsShipment
const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string', label: 'Warehouse' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string', label: 'Business Partner' },
  { key: 'movementDate', column: 'MovementDate', type: 'date', label: 'Movement Date' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', label: 'Document Status' },
];
// @sf-generated-end columns:goodsShipment

const filters = ['documentNo', 'warehouse', 'businessPartner', 'movementDate', 'documentStatus'];

// @sf-generated-start component:GoodsShipmentTable
export default function GoodsShipmentTable(props) {
  // @sf-custom-slot hooks:GoodsShipmentTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:GoodsShipmentTable

// @sf-custom-slot section:GoodsShipmentTable-custom

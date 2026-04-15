import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:returnShipmentLine
const columns = [
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'movementQty', column: 'MovementQty', type: 'number' },
  { key: 'locator', column: 'M_Locator_ID', type: 'string' },
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'uom', column: 'C_UOM_ID', type: 'string' },
];
// @sf-generated-end columns:returnShipmentLine

const filters = ['product'];

// @sf-generated-start component:ReturnShipmentLineTable
export default function ReturnShipmentLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:ReturnShipmentLineTable

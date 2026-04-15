import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:internalConsumptionLine
const columns = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.' },
  { key: 'product', column: 'M_Product_ID', type: 'string', label: 'Product' },
  { key: 'movementQuantity', column: 'MovementQty', type: 'number', label: 'Movement Quantity' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'string', label: 'UOM' },
  { key: 'storageBin', column: 'M_Locator_ID', type: 'string', label: 'Warehouse' },
];
// @sf-generated-end columns:internalConsumptionLine

const filters = ['product'];

// @sf-generated-start component:InternalConsumptionLineTable
export default function InternalConsumptionLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:InternalConsumptionLineTable

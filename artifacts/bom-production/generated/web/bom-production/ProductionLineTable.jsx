import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'locator', column: 'M_Locator_ID', type: 'string' },
  { key: 'movementQuantity', column: 'MovementQty', type: 'number' },
  { key: 'uom', column: 'C_UOM_ID', type: 'string' },
  { key: 'isEndProduct', column: 'IsEndProduct', type: 'boolean' },
];

const filters = ['product'];

export default function ProductionLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

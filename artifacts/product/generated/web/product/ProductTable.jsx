import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'searchKey', column: 'Value', type: 'string' },
  { key: 'uom', column: 'C_UOM_ID', type: 'string' },
  { key: 'productCategory', column: 'M_Product_Category_ID', type: 'string' },
  { key: 'listPrice', column: 'ListPrice', type: 'amount' },
  { key: 'isActive', column: 'IsActive', type: 'boolean' },
];

const filters = ['name', 'searchKey', 'productCategory'];

export default function ProductTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

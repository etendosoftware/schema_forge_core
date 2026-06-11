import { forwardRef } from 'react';
import { DataTable } from '@/components/contract-ui';
import { ProductNameCell, ProductPriceCell, ProductStockCell } from './ProductListCells';

/* eslint-disable react/prop-types */

const columns = [
  {
    key: 'nameAndSearchKey',
    labels: { en_US: 'Identifier & Name', es_ES: 'Identificador & Nombre' },
    type: 'custom',
    sortable: false,
    render: (row, { token, apiBaseUrl }) => (
      <ProductNameCell row={row} token={token} apiBaseUrl={apiBaseUrl} />
    ),
  },
  { key: 'productCategory', column: 'M_Product_Category_ID', type: 'selector', label: 'Product Category', required: true },
  { key: 'uOM',             column: 'C_UOM_ID',              type: 'selector', label: 'UOM',              required: true },
  {
    key: 'productType',
    column: 'ProductType',
    type: 'enum',
    label: 'Product Type',
    enumLabels: { E: 'Expense type', I: 'Item', R: 'Resource', S: 'Service' },
    enumVariants: { I: 'blue', S: 'purple', R: 'teal', E: 'orange' },
    required: true,
  },
  {
    key: 'price',
    labels: { en_US: 'Price', es_ES: 'Precio' },
    type: 'custom',
    sortable: false,
    render: (row, { token, apiBaseUrl }) => (
      <ProductPriceCell row={row} token={token} apiBaseUrl={apiBaseUrl} />
    ),
  },
  {
    key: 'stock',
    labels: { en_US: 'Stock', es_ES: 'Stock' },
    type: 'custom',
    sortable: false,
    render: (row, { token, apiBaseUrl }) => (
      <ProductStockCell row={row} token={token} apiBaseUrl={apiBaseUrl} />
    ),
  },
];

const filters = ['searchKey', 'name', 'productCategory', 'productType'];

const ProductCustomTable = forwardRef(function ProductCustomTable(props, ref) {
  return <DataTable ref={ref} columns={columns} filters={filters} {...props} />;
});

export default ProductCustomTable;

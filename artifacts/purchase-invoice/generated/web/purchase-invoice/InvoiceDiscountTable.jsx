import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:invoiceDiscount
const columns = [
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'discount', column: 'C_Discount_ID', type: 'string' },
  { key: 'cascade', column: 'Cascade', type: 'boolean' },
];
// @sf-generated-end columns:invoiceDiscount

const filters = [];

// @sf-generated-start component:InvoiceDiscountTable
export default function InvoiceDiscountTable(props) {
  // @sf-custom-slot hooks:InvoiceDiscountTable
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:InvoiceDiscountTable

// @sf-custom-slot section:InvoiceDiscountTable-custom

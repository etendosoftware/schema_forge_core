import { DataTable } from '@/components/contract-ui';
import { Tag } from '@/components/ui/tag';

function renderTaxRate(row) {
  const val = row?.rate;
  if (val == null) return '';
  return <Tag variant="green" label={`+${val} %`} />;
}

function renderTaxScope(row) {
  const value = row?.applicableTo;
  const showSales    = value === 'B' || value === 'S';
  const showPurchase = value === 'B' || value === 'P';
  if (!showSales && !showPurchase) return value ?? '';
  return (
    <span className="inline-flex items-center gap-1">
      {showSales    && <Tag variant="blue"   label="Sales" />}
      {showPurchase && <Tag variant="purple" label="Purchase" />}
    </span>
  );
}

// @sf-generated-start columns:tax
const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'rate', column: 'Rate', type: 'number', render: renderTaxRate },
  { key: 'applicableTo', column: 'SOPOType', type: 'string', render: renderTaxScope },
];
// @sf-generated-end columns:tax

const filters = ['name'];

// @sf-generated-start component:TaxTable
export default function TaxTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:TaxTable

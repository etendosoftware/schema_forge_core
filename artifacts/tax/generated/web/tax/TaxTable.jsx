import { DataTable } from '@/components/contract-ui';
import { Tag } from '@/components/ui/tag';
import { useUI } from '@/i18n';

function renderTaxRate(row) {
  const val = row?.rate;
  if (val == null) return '';
  return <Tag variant="green" label={`+${val} %`} />;
}

function TaxScopeCell({ row, fieldKey }) {
  const ui = useUI();
  const value = fieldKey ? row?.[fieldKey] : (row?.applicableTo ?? row?.salesPurchaseType);
  const showSales    = value === 'B' || value === 'S';
  const showPurchase = value === 'B' || value === 'P';
  if (!showSales && !showPurchase) return value ?? '';
  return (
    <span className="inline-flex items-center gap-1">
      {showSales    && <Tag variant="blue"   label={ui('taxScopeSales')} />}
      {showPurchase && <Tag variant="purple" label={ui('taxScopePurchase')} />}
    </span>
  );
}

// @sf-generated-start columns:tax
const columns = [
  { key: 'name', column: 'Name', type: 'string', label: 'Name' },
  { key: 'rate', column: 'Rate', type: 'number', label: 'Rate', render: renderTaxRate },
  { key: 'salesPurchaseType', column: 'SOPOType', type: 'enum', label: 'Sales/Purchase Type', enumLabels: { 'B': 'Both', 'P': 'Purchase Tax', 'S': 'Sales Tax' }, render: (row) => renderTaxScope(row, 'salesPurchaseType') },
];
// @sf-generated-end columns:tax

const filters = ['name'];

// @sf-generated-start component:TaxTable
export default function TaxTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:TaxTable

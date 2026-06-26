import InventoryTable from '@generated/physical-inventory/generated/web/physical-inventory/InventoryTable';
import GeneratedApp from '@generated/physical-inventory/generated/web/physical-inventory/index.jsx';
import { SortIcon, RefreshIcon } from '@/components/ui/custom-icons';

const COLUMNS = [
  { key: 'movementDate', column: 'MovementDate', type: 'date', dot: false },
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string' },
  { key: 'processed', column: 'Processed', type: 'status', label: 'Status', enumLabels: { 'true': 'statusProcessed', 'false': 'statusDraft' } },
];

function CustomInventoryTable(props) {
  return <InventoryTable columns={COLUMNS} {...props} data-testid="InventoryTable__4ca591" />;
}

function hideMenuActions({ data }) {
  return !data?.id || data?.processed === true || data?.processed === 'Y';
}

export default function PhysicalInventoryWindow(props) {
  return (
    <GeneratedApp
      {...props}
      Table={CustomInventoryTable}
      hideMoreMenu={hideMenuActions}
      SortIconComponent={SortIcon}
      RefreshIconComponent={RefreshIcon}
      data-testid="GeneratedApp__4ca591" />
  );
}

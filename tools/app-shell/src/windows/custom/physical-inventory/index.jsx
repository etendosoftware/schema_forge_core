import InventoryTable from '@generated/physical-inventory/generated/web/physical-inventory/InventoryTable';
import GeneratedApp from '@generated/physical-inventory/generated/web/physical-inventory/index.jsx';

const COLUMNS = [
  { key: 'movementDate', column: 'MovementDate', type: 'date', dot: false },
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string' },
  { key: 'inventoryType', column: 'Inventory_Type', type: 'enum', enumLabels: { 'C': 'Closing Inventory', 'N': 'Normal', 'O': 'Opening Inventory' } },
  { key: 'processed', column: 'Processed', type: 'status' },
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
      data-testid="GeneratedApp__4ca591" />
  );
}

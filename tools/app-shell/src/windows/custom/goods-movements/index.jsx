import MovementTable from '@generated/goods-movements/generated/web/goods-movements/MovementTable';
import GeneratedApp from '@generated/goods-movements/generated/web/goods-movements/index.jsx';

const COLUMNS = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'movementDate', column: 'MovementDate', type: 'date', dot: false },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'processed', column: 'Processed', type: 'status' },
];

function CustomMovementTable(props) {
  return <MovementTable columns={COLUMNS} {...props} />;
}

export default function GoodsMovementsWindow(props) {
  return <GeneratedApp {...props} Table={CustomMovementTable} />;
}

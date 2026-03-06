import WarehouseTable from './WarehouseTable';
import WarehouseForm from './WarehouseForm';

export default function App({ token, apiBaseUrl, window }) {
  return (
    <div>
      <WarehouseTable data={[]} />
    </div>
  );
}

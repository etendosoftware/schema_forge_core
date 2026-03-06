import { SingleEntityPage } from '@/components/contract-ui';
import WarehouseTable from './WarehouseTable';
import WarehouseForm from './WarehouseForm';
import catalogs from './mockCatalogs';

export default function App(props) {
  return (
    <SingleEntityPage
      entity="warehouse"
      Table={WarehouseTable}
      Form={WarehouseForm}
      catalogs={catalogs}
      entityLabel="Warehouse"
      {...props}
    />
  );
}

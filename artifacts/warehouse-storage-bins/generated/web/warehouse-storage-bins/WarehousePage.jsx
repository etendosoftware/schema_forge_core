import { MasterDetailPage } from '@/components/contract-ui';
import WarehouseTable from './WarehouseTable';
import WarehouseForm from './WarehouseForm';
import LocatorTable from './LocatorTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'isActive', label: 'Is Active', type: 'boolean' },
];

const statusField = null;

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'searchKey', label: 'Search Key', type: 'text', required: true, lookup: true },
    { key: 'x', label: 'X', type: 'text' },
    { key: 'y', label: 'Y', type: 'text' },
    { key: 'z', label: 'Z', type: 'text' },
    { key: 'priorityNo', label: 'Priority No', type: 'number' },
    { key: 'isDefault', label: 'Is Default', type: 'checkbox', required: true },
  ],
  derived: [

  ],
};

export default function WarehousePage(props) {
  return (
    <MasterDetailPage
      entity="warehouse"
      detailEntity="locator"
      Table={WarehouseTable}
      Form={WarehouseForm}
      DetailTable={LocatorTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Warehouse"
      detailLabel="Locator"
      {...props}
    />
  );
}

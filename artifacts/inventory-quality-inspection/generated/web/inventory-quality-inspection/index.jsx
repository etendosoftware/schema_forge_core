import { SingleEntityPage } from '@/components/contract-ui';
import QualityCheckTable from './QualityCheckTable';
import QualityCheckForm from './QualityCheckForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'warehouse', name: 'Inventory Quality Inspection' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="qualityCheck"
      Table={QualityCheckTable}
      Form={QualityCheckForm}
      catalogs={catalogs}
      entityLabel="Quality Check"
      window={windowMeta}
      {...props}
    />
  );
}

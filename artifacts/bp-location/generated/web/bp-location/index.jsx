import { SingleEntityPage } from '@/components/contract-ui';
import BpLocationTable from './BpLocationTable';
import BpLocationForm from './BpLocationForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'reference', name: 'BP Location' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="bpLocation"
      Table={BpLocationTable}
      Form={BpLocationForm}
      catalogs={catalogs}
      entityLabel="Bp Location"
      window={windowMeta}
      {...props}
    />
  );
}

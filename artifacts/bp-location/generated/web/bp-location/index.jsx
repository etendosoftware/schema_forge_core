import { SingleEntityPage } from '@/components/contract-ui';
import BpLocationTable from './BpLocationTable';
import BpLocationForm from './BpLocationForm';
import catalogs from './mockCatalogs';

export default function App(props) {
  return (
    <SingleEntityPage
      entity="bpLocation"
      Table={BpLocationTable}
      Form={BpLocationForm}
      catalogs={catalogs}
      entityLabel="Bp Location"
      {...props}
    />
  );
}

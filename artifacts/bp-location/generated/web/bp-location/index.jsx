import { SingleEntityPage } from '@/components/contract-ui';
import BpLocationTable from './BpLocationTable';
import BpLocationForm from './BpLocationForm';
import catalogs from './mockCatalogs';

export default function App({ token, apiBaseUrl, window }) {
  return (
    <SingleEntityPage
      entity="bpLocation"
      Table={BpLocationTable}
      Form={BpLocationForm}
      catalogs={catalogs}
      token={token}
      apiBaseUrl={apiBaseUrl}
      entityLabel="BP Location"
    />
  );
}

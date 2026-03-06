import { SingleEntityPage } from '@/components/contract-ui';
import UomTable from './UomTable';
import UomForm from './UomForm';
import catalogs from './mockCatalogs';

export default function App({ token, apiBaseUrl, window }) {
  return (
    <SingleEntityPage
      entity="uom"
      Table={UomTable}
      Form={UomForm}
      catalogs={catalogs}
      token={token}
      apiBaseUrl={apiBaseUrl}
      entityLabel="UOM"
    />
  );
}

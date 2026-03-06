import { SingleEntityPage } from '@/components/contract-ui';
import TaxTable from './TaxTable';
import TaxForm from './TaxForm';
import catalogs from './mockCatalogs';

export default function App({ token, apiBaseUrl, window }) {
  return (
    <SingleEntityPage
      entity="tax"
      Table={TaxTable}
      Form={TaxForm}
      catalogs={catalogs}
      token={token}
      apiBaseUrl={apiBaseUrl}
      entityLabel="Tax"
    />
  );
}

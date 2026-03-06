import { SingleEntityPage } from '@/components/contract-ui';
import BusinessPartnerTable from './BusinessPartnerTable';
import BusinessPartnerForm from './BusinessPartnerForm';
import catalogs from './mockCatalogs';

export default function App({ token, apiBaseUrl, window }) {
  return (
    <SingleEntityPage
      entity="businessPartner"
      Table={BusinessPartnerTable}
      Form={BusinessPartnerForm}
      catalogs={catalogs}
      token={token}
      apiBaseUrl={apiBaseUrl}
      entityLabel="Business Partner"
    />
  );
}

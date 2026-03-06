import { SingleEntityPage } from '@/components/contract-ui';
import PriceListTable from './PriceListTable';
import PriceListForm from './PriceListForm';
import catalogs from './mockCatalogs';

export default function App({ token, apiBaseUrl, window }) {
  return (
    <SingleEntityPage
      entity="priceList"
      Table={PriceListTable}
      Form={PriceListForm}
      catalogs={catalogs}
      token={token}
      apiBaseUrl={apiBaseUrl}
      entityLabel="Price List"
    />
  );
}

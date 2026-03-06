import { SingleEntityPage } from '@/components/contract-ui';
import PaymentMethodTable from './PaymentMethodTable';
import PaymentMethodForm from './PaymentMethodForm';
import catalogs from './mockCatalogs';

export default function App({ token, apiBaseUrl, window }) {
  return (
    <SingleEntityPage
      entity="paymentMethod"
      Table={PaymentMethodTable}
      Form={PaymentMethodForm}
      catalogs={catalogs}
      token={token}
      apiBaseUrl={apiBaseUrl}
      entityLabel="Payment Method"
    />
  );
}

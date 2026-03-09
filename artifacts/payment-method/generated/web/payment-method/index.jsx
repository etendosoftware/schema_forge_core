import { SingleEntityPage } from '@/components/contract-ui';
import PaymentMethodTable from './PaymentMethodTable';
import PaymentMethodForm from './PaymentMethodForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'reference', name: 'Payment Method' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="paymentMethod"
      Table={PaymentMethodTable}
      Form={PaymentMethodForm}
      catalogs={catalogs}
      entityLabel="Payment Method"
      window={windowMeta}
      {...props}
    />
  );
}

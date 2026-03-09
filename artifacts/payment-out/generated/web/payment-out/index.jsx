import { SingleEntityPage } from '@/components/contract-ui';
import PaymentOutTable from './PaymentOutTable';
import PaymentOutForm from './PaymentOutForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'accounting', name: 'Payment Out' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="paymentOut"
      Table={PaymentOutTable}
      Form={PaymentOutForm}
      catalogs={catalogs}
      entityLabel="Payment Out"
      window={windowMeta}
      {...props}
    />
  );
}

import { SingleEntityPage } from '@/components/contract-ui';
import PaymentInTable from './PaymentInTable';
import PaymentInForm from './PaymentInForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'accounting', name: 'Payment In' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="paymentIn"
      Table={PaymentInTable}
      Form={PaymentInForm}
      catalogs={catalogs}
      entityLabel="Payment In"
      window={windowMeta}
      {...props}
    />
  );
}

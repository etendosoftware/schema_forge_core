import { SingleEntityPage } from '@/components/contract-ui';
import PaymentTermTable from './PaymentTermTable';
import PaymentTermForm from './PaymentTermForm';
import catalogs from './mockCatalogs';

export default function App(props) {
  return (
    <SingleEntityPage
      entity="paymentTerm"
      Table={PaymentTermTable}
      Form={PaymentTermForm}
      catalogs={catalogs}
      entityLabel="Payment Term"
      {...props}
    />
  );
}

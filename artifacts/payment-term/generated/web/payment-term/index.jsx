import { ListView, DetailView } from '@/components/contract-ui';
import PaymentTermTable from './PaymentTermTable';
import PaymentTermForm from './PaymentTermForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'reference', name: 'Payment Term' };

export default function App({ windowName, recordId, ...props }) {
  if (recordId) {
    return (
      <DetailView
        entity="paymentTerm"
        Form={PaymentTermForm}
        catalogs={catalogs}
        entityLabel="Payment Term"
        windowName={windowName}
        recordId={recordId}
        window={windowMeta}
      {...props}
    />
  );
}

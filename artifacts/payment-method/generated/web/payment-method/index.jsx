import { ListView, DetailView } from '@/components/contract-ui';
import PaymentMethodTable from './PaymentMethodTable';
import PaymentMethodForm from './PaymentMethodForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'reference', name: 'Payment Method' };
const breadcrumb = 'Settings / Payment Method';

export default function App({ windowName, recordId, ...props }) {
  if (recordId) {
    return (
      <DetailView
        entity="paymentMethod"
        Form={PaymentMethodForm}
        catalogs={catalogs}
        entityLabel="Payment Method"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
        window={windowMeta}
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="paymentMethod"
      Table={PaymentMethodTable}
      entityLabel="Payment Method"
      windowName={windowName}
      breadcrumb={breadcrumb}
      window={windowMeta}
      {...props}
    />
  );
}

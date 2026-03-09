import { SingleEntityPage } from '@/components/contract-ui';
import RecurringInvoiceTable from './RecurringInvoiceTable';
import RecurringInvoiceForm from './RecurringInvoiceForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'finance', name: 'Recurring Invoice' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="recurringInvoice"
      Table={RecurringInvoiceTable}
      Form={RecurringInvoiceForm}
      catalogs={catalogs}
      entityLabel="Recurring Invoice"
      window={windowMeta}
      {...props}
    />
  );
}

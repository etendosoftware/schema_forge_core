import { useSearchParams } from 'react-router-dom';
import { ListView } from '@/components/contract-ui';
import HeaderTable from '@generated/sales-order/generated/web/sales-order/HeaderTable';
import GeneratedApp from '@generated/sales-order/generated/web/sales-order/index.jsx';

export default function SalesOrderWindow(props) {
  const { recordId, windowName } = props;
  const [searchParams] = useSearchParams();

  if (recordId) {
    return <GeneratedApp {...props} />;
  }

  const docStatus = searchParams.get('DocStatus');
  const initialColumnFilters = docStatus ? { documentStatus: docStatus } : undefined;

  return (
    <ListView
      entity="header"
      Table={HeaderTable}
      entityLabel="Sales Order"
      windowName={windowName}
      breadcrumb="Sales / Sales Order"
      {...props}
      initialColumnFilters={initialColumnFilters}
    />
  );
}

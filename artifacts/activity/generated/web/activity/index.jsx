import { SingleEntityPage } from '@/components/contract-ui';
import ActivityTable from './ActivityTable';
import ActivityForm from './ActivityForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'crm', name: 'Activity' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="activity"
      Table={ActivityTable}
      Form={ActivityForm}
      catalogs={catalogs}
      entityLabel="Activity"
      window={windowMeta}
      {...props}
    />
  );
}

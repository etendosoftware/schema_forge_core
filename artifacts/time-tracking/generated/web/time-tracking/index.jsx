import { SingleEntityPage } from '@/components/contract-ui';
import TimeTrackingTable from './TimeTrackingTable';
import TimeTrackingForm from './TimeTrackingForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'hr', name: 'Time Tracking' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="timeTracking"
      Table={TimeTrackingTable}
      Form={TimeTrackingForm}
      catalogs={catalogs}
      entityLabel="Time Tracking"
      window={windowMeta}
      {...props}
    />
  );
}

import { SingleEntityPage } from '@/components/contract-ui';
import LeadTable from './LeadTable';
import LeadForm from './LeadForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'crm', name: 'Lead' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="lead"
      Table={LeadTable}
      Form={LeadForm}
      catalogs={catalogs}
      entityLabel="Lead"
      window={windowMeta}
      {...props}
    />
  );
}

import { SingleEntityPage } from '@/components/contract-ui';
import DealTable from './DealTable';
import DealForm from './DealForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'crm', name: 'Deal' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="deal"
      Table={DealTable}
      Form={DealForm}
      catalogs={catalogs}
      entityLabel="Deal"
      window={windowMeta}
      {...props}
    />
  );
}

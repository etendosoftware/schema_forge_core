import { SingleEntityPage } from '@/components/contract-ui';
import AbsenceTable from './AbsenceTable';
import AbsenceForm from './AbsenceForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'hr', name: 'Absence' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="absence"
      Table={AbsenceTable}
      Form={AbsenceForm}
      catalogs={catalogs}
      entityLabel="Absence"
      window={windowMeta}
      {...props}
    />
  );
}

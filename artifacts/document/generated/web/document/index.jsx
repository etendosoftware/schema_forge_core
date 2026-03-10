import { SingleEntityPage } from '@/components/contract-ui';
import DocumentTable from './DocumentTable';
import DocumentForm from './DocumentForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'documents', name: 'Document' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="document"
      Table={DocumentTable}
      Form={DocumentForm}
      catalogs={catalogs}
      entityLabel="Document"
      window={windowMeta}
      {...props}
    />
  );
}

import { SingleEntityPage } from '@/components/contract-ui';
import UserTable from './UserTable';
import UserForm from './UserForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'reference', name: 'User' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="user"
      Table={UserTable}
      Form={UserForm}
      catalogs={catalogs}
      entityLabel="User"
      window={windowMeta}
      {...props}
    />
  );
}

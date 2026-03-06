import { SingleEntityPage } from '@/components/contract-ui';
import UserTable from './UserTable';
import UserForm from './UserForm';
import catalogs from './mockCatalogs';

export default function App({ token, apiBaseUrl, window }) {
  return (
    <SingleEntityPage
      entity="user"
      Table={UserTable}
      Form={UserForm}
      catalogs={catalogs}
      token={token}
      apiBaseUrl={apiBaseUrl}
      entityLabel="User"
    />
  );
}

import { SingleEntityPage } from '@/components/contract-ui';
import AccountTable from './AccountTable';
import AccountForm from './AccountForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'accounting', name: 'Chart of Accounts' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="account"
      Table={AccountTable}
      Form={AccountForm}
      catalogs={catalogs}
      entityLabel="Account"
      window={windowMeta}
      {...props}
    />
  );
}

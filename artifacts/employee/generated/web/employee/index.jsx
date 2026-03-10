import { SingleEntityPage } from '@/components/contract-ui';
import EmployeeTable from './EmployeeTable';
import EmployeeForm from './EmployeeForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'hr', name: 'Employee' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="employee"
      Table={EmployeeTable}
      Form={EmployeeForm}
      catalogs={catalogs}
      entityLabel="Employee"
      window={windowMeta}
      {...props}
    />
  );
}

import { SingleEntityPage } from '@/components/contract-ui';
import TaxTable from './TaxTable';
import TaxForm from './TaxForm';
import catalogs from './mockCatalogs';

export default function App(props) {
  return (
    <SingleEntityPage
      entity="tax"
      Table={TaxTable}
      Form={TaxForm}
      catalogs={catalogs}
      entityLabel="Tax"
      {...props}
    />
  );
}

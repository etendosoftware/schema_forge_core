import { SingleEntityPage } from '@/components/contract-ui';
import UomTable from './UomTable';
import UomForm from './UomForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'reference', name: 'UOM' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="uom"
      Table={UomTable}
      Form={UomForm}
      catalogs={catalogs}
      entityLabel="Uom"
      window={windowMeta}
      {...props}
    />
  );
}

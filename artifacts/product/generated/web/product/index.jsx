import { SingleEntityPage } from '@/components/contract-ui';
import ProductTable from './ProductTable';
import ProductForm from './ProductForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'reference', name: 'Product' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="product"
      Table={ProductTable}
      Form={ProductForm}
      catalogs={catalogs}
      entityLabel="Product"
      window={windowMeta}
      {...props}
    />
  );
}

import { SingleEntityPage } from '@/components/contract-ui';
import ProductCategoryTable from './ProductCategoryTable';
import ProductCategoryForm from './ProductCategoryForm';
import catalogs from './mockCatalogs';

export default function App(props) {
  return (
    <SingleEntityPage
      entity="productCategory"
      Table={ProductCategoryTable}
      Form={ProductCategoryForm}
      catalogs={catalogs}
      entityLabel="Product Category"
      {...props}
    />
  );
}

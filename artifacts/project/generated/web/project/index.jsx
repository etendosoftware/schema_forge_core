import { SingleEntityPage } from '@/components/contract-ui';
import ProjectTable from './ProjectTable';
import ProjectForm from './ProjectForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'projects', name: 'Project' };

export default function App(props) {
  return (
    <SingleEntityPage
      entity="project"
      Table={ProjectTable}
      Form={ProjectForm}
      catalogs={catalogs}
      entityLabel="Project"
      window={windowMeta}
      {...props}
    />
  );
}

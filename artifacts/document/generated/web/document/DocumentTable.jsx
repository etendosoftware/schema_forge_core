import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'category', label: 'Category', type: 'string' },
  { key: 'project', label: 'Project', type: 'string' },
  { key: 'uploadedBy', label: 'Uploaded By', type: 'string' },
  { key: 'uploadDate', label: 'Upload Date', type: 'date' },
  { key: 'fileSize', label: 'File Size', type: 'string' },
  { key: 'version', label: 'Version', type: 'string' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'tags', label: 'Tags', type: 'string' },
];

const filters = ['name', 'category', 'status'];

export default function DocumentTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

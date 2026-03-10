import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'category', column: 'Category', type: 'string' },
  { key: 'project', column: 'Project_ID', type: 'string' },
  { key: 'uploadedBy', column: 'UploadedBy_ID', type: 'string' },
  { key: 'uploadDate', column: 'UploadDate', type: 'date' },
  { key: 'fileSize', column: 'FileSize', type: 'string' },
  { key: 'version', column: 'Version', type: 'string' },
  { key: 'status', column: 'Status', type: 'status' },
  { key: 'tags', column: 'Tags', type: 'string' },
];

const filters = ['name', 'category', 'status'];

export default function DocumentTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}

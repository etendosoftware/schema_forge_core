import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'category', column: 'Category', type: 'selector', required: true, reference: 'DocumentCategory', inputMode: 'selector' },
  { key: 'project', column: 'Project_ID', type: 'selector', reference: 'Project', inputMode: 'selector' },
  { key: 'uploadedBy', column: 'UploadedBy_ID', type: 'selector', required: true, readOnly: true, reference: 'User', inputMode: 'selector' },
  { key: 'uploadDate', column: 'UploadDate', type: 'date', required: true, readOnly: true },
  { key: 'fileSize', column: 'FileSize', type: 'text', readOnly: true },
  { key: 'version', column: 'Version', type: 'text', readOnly: true },
  { key: 'status', column: 'Status', type: 'selector', required: true, reference: 'DocumentStatus', inputMode: 'selector' },
  { key: 'tags', column: 'Tags', type: 'text' },
];

export default function DocumentForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

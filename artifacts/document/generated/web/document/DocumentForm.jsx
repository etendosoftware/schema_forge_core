import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'category', label: 'Category', type: 'selector', required: true, reference: 'DocumentCategory', inputMode: 'selector' },
  { key: 'project', label: 'Project', type: 'selector', reference: 'Project', inputMode: 'selector' },
  { key: 'uploadedBy', label: 'Uploaded By', type: 'selector', required: true, readOnly: true, reference: 'User', inputMode: 'selector' },
  { key: 'uploadDate', label: 'Upload Date', type: 'date', required: true, readOnly: true },
  { key: 'fileSize', label: 'File Size', type: 'text', readOnly: true },
  { key: 'version', label: 'Version', type: 'text', readOnly: true },
  { key: 'status', label: 'Status', type: 'selector', required: true, reference: 'DocumentStatus', inputMode: 'selector' },
  { key: 'tags', label: 'Tags', type: 'text' },
];

export default function DocumentForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

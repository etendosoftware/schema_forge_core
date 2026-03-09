import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'category', label: 'Category', type: 'selector', required: true, reference: 'DocumentCategory', inputMode: 'selector' },
  { key: 'project', label: 'Project', type: 'selector', reference: 'Project', inputMode: 'selector' },
  { key: 'status', label: 'Status', type: 'selector', required: true, reference: 'DocumentStatus', inputMode: 'selector' },
  { key: 'tags', label: 'Tags', type: 'text' },
];

export default function DocumentForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

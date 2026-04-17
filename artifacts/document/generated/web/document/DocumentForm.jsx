import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:document
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'category', column: 'Category', type: 'selector', required: true, section: 'principal', reference: 'DocumentCategory', inputMode: 'selector' },
  { key: 'project', column: 'Project_ID', type: 'selector', section: 'principal', reference: 'Project', inputMode: 'selector' },
  { key: 'uploadedBy', column: 'UploadedBy_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'User', inputMode: 'selector' },
  { key: 'uploadDate', column: 'UploadDate', type: 'date', required: true, readOnly: true, section: 'other' },
  { key: 'fileSize', column: 'FileSize', type: 'text', readOnly: true, section: 'other' },
  { key: 'version', column: 'Version', type: 'text', readOnly: true, section: 'other' },
  { key: 'status', column: 'Status', type: 'selector', required: true, section: 'principal', reference: 'DocumentStatus', inputMode: 'selector' },
  { key: 'tags', column: 'Tags', type: 'text', section: 'other' },
];
// @sf-generated-end fields:document

// @sf-generated-start component:DocumentForm
export default function DocumentForm(props) {
  // @sf-custom-slot hooks:DocumentForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:DocumentForm

// @sf-custom-slot section:DocumentForm-custom

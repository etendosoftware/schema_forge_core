import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:user
const columns = [
  { key: 'name', column: 'Name', type: 'string', label: 'Name', required: true },
  { key: 'username', column: 'UserName', type: 'string', label: 'Username', required: true },
  { key: 'firstName', column: 'Firstname', type: 'string', label: 'First Name' },
  { key: 'lastName', column: 'Lastname', type: 'string', label: 'Last Name' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector', label: 'Business Partner' },
  { key: 'email', column: 'Email', type: 'string', label: 'Email' },
  { key: 'locked', column: 'IsLocked', type: 'boolean', label: 'Locked', required: true },
  { key: 'defaultRole', column: 'Default_Ad_Role_ID', type: 'selector', label: 'Default Role' },
];
// @sf-generated-end columns:user

const filters = ['name', 'username', 'email'];

// @sf-generated-start component:UserTable
const UserTable = forwardRef(function UserTable(props, ref) {
  // Inline-editable layout owns rendering of the existing rows. The add-line flow keeps
  // using the proven DataTable inline-add row (callouts, focus management, defaults) —
  // when addRow.active flips on, we hand off to DataTable so the user can fill the new
  // line, then return to InlineLinesPanel once addRow.active flips off again. The ref
  // is forwarded so DetailView can imperatively flush pending edits on global save.
  if (props.linesLayout === 'inlineEditable' && !props.addRow?.active) {
    return <InlineLinesPanel ref={ref} columns={columns} {...props} />;
  }
  return <DataTable columns={columns} filters={filters} {...props} />;
});

export default UserTable;
// @sf-generated-end component:UserTable

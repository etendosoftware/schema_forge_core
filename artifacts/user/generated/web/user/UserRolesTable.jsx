import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:userRoles
const columns = [
  { key: 'role', column: 'AD_Role_ID', type: 'selector', label: 'Role', required: true },
  { key: 'roleAdmin', column: 'Is_Role_Admin', type: 'boolean', label: 'Role Administrator', required: true },
];
// @sf-generated-end columns:userRoles

const filters = ['role'];

// @sf-generated-start component:UserRolesTable
const UserRolesTable = forwardRef(function UserRolesTable(props, ref) {
  // Inline-editable layout always uses InlineLinesPanel for existing rows so column
  // widths (flex layout) never shift when the add-row form opens. When addRow is
  // active we render a header-hidden, data-hidden DataTable below for just the
  // add-row form — it owns callouts, selectors, validation and the imperative flush
  // ref. The ref is forwarded to InlineLinesPanel so DetailView can flush pending
  // inline edits on global save.
  if (props.linesLayout === 'inlineEditable') {
    if (props.addRow?.active) {
      return (
        <>
          <InlineLinesPanel ref={ref} columns={columns} {...props} addRow={undefined} />
          <DataTable columns={columns} filters={filters} {...props} hideHeader hideDataRows />
        </>
      );
    }
    return <InlineLinesPanel ref={ref} columns={columns} {...props} />;
  }
  return <DataTable columns={columns} filters={filters} {...props} />;
});

export default UserRolesTable;
// @sf-generated-end component:UserRolesTable

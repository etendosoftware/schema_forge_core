import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:ticketbai
const fields = [
  { key: 'active', column: 'Isactive', type: 'checkbox', label: 'Activo', required: true, section: 'principal', defaultValue: 'Y' },
  { key: 'estado', column: 'Estado', type: 'text', label: 'Estado', readOnly: true, section: 'other' },
  { key: 'descripcion', column: 'Descripcion', type: 'text', label: 'Descripción', readOnly: true, section: 'other' },
  { key: 'invoice', column: 'C_Invoice_ID', type: 'selector', label: 'Factura', required: true, readOnly: true, section: 'other', reference: 'Invoice', inputMode: 'selector' },
];
// @sf-generated-end fields:ticketbai

// @sf-generated-start component:TicketbaiForm
export default function TicketbaiForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
TicketbaiForm.hasCollapsedFields = false;
// @sf-generated-end component:TicketbaiForm

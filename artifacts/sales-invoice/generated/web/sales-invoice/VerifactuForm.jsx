import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:verifactu
const fields = [
  { key: 'typeOperation', column: 'Type_Operation', type: 'select', label: 'Tipo de Operación', section: 'principal', options: [{ value: 'AL', label: 'ALTA' }, { value: 'BA', label: 'BAJA' }] },
  { key: 'registrationStatus', column: 'Registration_Status', type: 'select', label: 'Estado', section: 'principal', options: [{ value: 'AC', label: 'Aceptada' }, { value: 'AE', label: 'Aceptada con Errores' }, { value: 'IN', label: 'Inválida' }, { value: 'PE', label: 'Pendiente' }, { value: 'ER', label: 'Rechazada' }] },
  { key: 'cSV', column: 'Csv', type: 'text', label: 'CSV', section: 'principal' },
  { key: 'errorReason', column: 'Error_Reason', type: 'text', label: 'Descripción Error Registro', section: 'principal' },
  { key: 'codeError', column: 'Code_Error', type: 'text', label: 'Código de Error', section: 'other' },
  { key: 'isSubsanation', column: 'Issubsanation', type: 'checkbox', label: 'Es Subsanación', required: true, section: 'other' },
];
// @sf-generated-end fields:verifactu

// @sf-generated-start component:VerifactuForm
export default function VerifactuForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
VerifactuForm.hasCollapsedFields = false;
// @sf-generated-end component:VerifactuForm

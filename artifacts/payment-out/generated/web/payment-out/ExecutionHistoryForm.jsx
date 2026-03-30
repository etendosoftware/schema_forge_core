import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:executionHistory
const fields = [
  { key: 'executionDate', column: 'Executiondate', type: 'date', readOnly: true, section: 'other' },
  { key: 'paymentRun', column: 'FIN_Payment_Run_ID', type: 'search', readOnly: true, section: 'other', reference: 'Payment_Run', inputMode: 'search' },
  { key: 'paymentRunStatus', column: 'Prun_Status', type: 'text', readOnly: true, section: 'other' },
  { key: 'paymentRunMessage', column: 'Prun_Message', type: 'text', readOnly: true, section: 'other' },
  { key: 'sourceOfTheExecution', column: 'Prun_Source', type: 'text', readOnly: true, section: 'other' },
  { key: 'paymentExecutionResult', column: 'Paymentexec_Result', type: 'text', readOnly: true, section: 'other' },
  { key: 'paymentExecutionMessage', column: 'Paymentexec_Message', type: 'text', readOnly: true, section: 'other' },
];
// @sf-generated-end fields:executionHistory

// @sf-generated-start component:ExecutionHistoryForm
export default function ExecutionHistoryForm(props) {
  // @sf-custom-slot hooks:ExecutionHistoryForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:ExecutionHistoryForm

// @sf-custom-slot section:ExecutionHistoryForm-custom

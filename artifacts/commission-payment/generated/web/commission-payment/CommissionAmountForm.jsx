import { EntityForm } from '@/components/contract-ui';

const fields = [

];

export default function CommissionAmountForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

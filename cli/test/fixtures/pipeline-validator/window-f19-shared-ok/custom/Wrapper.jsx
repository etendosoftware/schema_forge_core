// Mirrors artifacts/payment-in/custom/PaymentHeaderTable.jsx: a thin wrapper
// that imports the shared base and passes props through.
import SharedBase from '@/windows/custom/shared/window-f19-shared-base.jsx';

export default function Wrapper(props) {
  return <SharedBase dir="a" specName="window-f19-shared-ok" {...props} />;
}

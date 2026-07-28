// Same shared base as window-f18-shared-ok/custom/Wrapper.jsx, but this
// window's contract disagrees with the shared column's required flag —
// proves the shared file is attributed to the correct window on each check.
import SharedBase from '@/windows/custom/shared/window-f18-shared-base.jsx';

export default function Wrapper(props) {
  return <SharedBase dir="b" specName="window-f18-shared-drift" {...props} />;
}

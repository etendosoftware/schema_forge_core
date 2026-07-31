// Same shared base as window-f19-shared-ok/custom/Wrapper.jsx, but this
// window's contract disagrees with the shared column's required flag —
// proves the shared file is attributed to the correct window on each check.
import SharedBase from '@/windows/custom/shared/window-f19-shared-base.jsx';

export default function Wrapper(props) {
  return <SharedBase dir="b" specName="window-f19-shared-drift" {...props} />;
}

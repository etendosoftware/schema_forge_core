/**
 * The engine's `onFinish` payload (ETP-5144).
 *
 * It grew from `{flowId, completed}` to also carry `{stepId, stepIndex,
 * totalSteps}` so a host can report WHERE a tour loses people — the datum a
 * bare `completed: false` cannot give. The subtlety being pinned here is the
 * ORDER inside `endTour`: the step fields are read from the render's snapshot
 * BEFORE `dispatch`, because the `complete` action resets `stepIndex` to 0. Move
 * the read after the dispatch and every completed run reports step 0.
 */
import { act, renderHook } from '@testing-library/react';
import { normalizeFlows } from '../flowSchema.js';
import { useWalkthroughEngine } from '../useWalkthroughEngine.js';

const RAW_FLOW = {
  id: 'create-contact',
  titleKey: 'title',
  revision: 2,
  steps: [
    { id: 'open-new', targetTestId: 'new-button', bodyKey: 'body1' },
    { id: 'legal-name', targetTestId: 'legal-name', bodyKey: 'body2' },
    { id: 'save', targetTestId: 'save', bodyKey: 'body3' },
  ],
};

const { flows } = normalizeFlows([RAW_FLOW]);

function mountEngine(onFinish) {
  return renderHook(() => useWalkthroughEngine({
    flows,
    navigate: () => {},
    pathname: '/',
    onFinish,
  }));
}

describe('useWalkthroughEngine — onFinish payload', () => {
  it('reports the step an abandoned run walked away from', () => {
    const onFinish = vi.fn();
    const { result } = mountEngine(onFinish);

    act(() => result.current.start('create-contact'));
    act(() => result.current.goToStep(1));
    act(() => result.current.stop());

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith({
      flowId: 'create-contact',
      completed: false,
      stepId: 'legal-name',
      stepIndex: 1,
      totalSteps: 3,
    });
  });

  it('reports the LAST step on a completed run, not the reset index 0', () => {
    const onFinish = vi.fn();
    const { result } = mountEngine(onFinish);

    act(() => result.current.start('create-contact'));
    act(() => result.current.goToStep(2));
    act(() => result.current.finish());

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith({
      flowId: 'create-contact',
      completed: true,
      // `complete` resets `stepIndex` to 0; these must still be the position the
      // run actually ended on.
      stepId: 'save',
      stepIndex: 2,
      totalSteps: 3,
    });
  });

  it('reports the first step for a run abandoned immediately', () => {
    const onFinish = vi.fn();
    const { result } = mountEngine(onFinish);

    act(() => result.current.start('create-contact'));
    act(() => result.current.stop());

    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({
      stepId: 'open-new',
      stepIndex: 0,
      completed: false,
    }));
  });

  it('reports a run at most once', () => {
    const onFinish = vi.fn();
    const { result } = mountEngine(onFinish);

    act(() => result.current.start('create-contact'));
    act(() => result.current.stop());
    act(() => result.current.stop());

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('reports nothing when no tour was ever running', () => {
    const onFinish = vi.fn();
    const { result } = mountEngine(onFinish);

    act(() => result.current.stop());

    expect(onFinish).not.toHaveBeenCalled();
  });
});

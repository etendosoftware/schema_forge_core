import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from '../checkbox';

// ETP-5067 — regression coverage for a real browser behavior the source-reading
// suite (checkbox.test.js) cannot see: clicking on the Checkbox's visible box
// (a <div> sibling of the sr-only <input>, both inside a <label>) makes the
// browser dispatch TWO click events — the original one (target = the div,
// bubbles straight past the <input>) and a synthetic one the <label> forwards
// to its associated <input> (which the input's own onClick can stop). A caller
// that nests Checkbox inside a row with its own onClick — the exact shape used
// by ImportLinesModal.jsx line/doc rows — must not have that row handler fire
// from the escaping first click, and a toggle handler shared between the row
// and the Checkbox must not run twice per click.

describe('Checkbox — nested in a clickable row (ETP-5067)', () => {
  it('does not let a click on the checkbox reach an ancestor row onClick', () => {
    const rowClick = vi.fn();
    const onChange = vi.fn();
    render(
      <div onClick={rowClick}>
        <Checkbox checked={false} onClick={e => e.stopPropagation()} onChange={onChange} aria-label="line" />
      </div>,
    );

    const input = screen.getByRole('checkbox', { name: 'line' });
    const visualBox = input.closest('label').querySelector('div');
    fireEvent.click(visualBox);

    expect(rowClick).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('toggles a shared handler exactly once per click, even when the row onClick and the Checkbox onChange both call it (ImportLinesModal shape)', () => {
    const toggle = vi.fn();
    render(
      <div onClick={toggle}>
        <Checkbox checked={false} onClick={e => e.stopPropagation()} onChange={toggle} aria-label="line" />
      </div>,
    );

    const input = screen.getByRole('checkbox', { name: 'line' });
    const visualBox = input.closest('label').querySelector('div');
    fireEvent.click(visualBox);

    expect(toggle).toHaveBeenCalledTimes(1);
  });
});

// @covers packages/etendo-go-core/src/onboarding/components/OnboardingSessionAction.jsx
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OnboardingSessionAction } from '../OnboardingSessionAction.jsx';

/**
 * ETP-4584 — the onboarding screens that hold a platform-account session all
 * gave the user their own hand-rolled "logout" control. They now share this one
 * accessible button, so the guarantees that used to be asserted against each
 * step's source (a real <button>, an onClick, the translated label, one stable
 * testid) are asserted once, on the rendered element, and the wiring files
 * assert that every screen actually renders it.
 */

const LABEL = 'Cerrar sesión';

afterEach(() => {
  cleanup();
});

function renderAction({ onLogout = vi.fn(), label = LABEL } = {}) {
  const utils = render(<OnboardingSessionAction onLogout={onLogout} label={label} />);
  return { ...utils, onLogout };
}

describe('OnboardingSessionAction', () => {
  it('exposes the label prop as the accessible name of the only button it renders', () => {
    renderAction();

    const button = screen.getByRole('button', { name: LABEL });
    expect(button).toBe(screen.getByTestId('onboarding-logout'));
    expect(button.textContent).toBe(LABEL);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('calls onLogout when clicked', async () => {
    const { onLogout } = renderAction();
    const button = screen.getByRole('button', { name: LABEL });

    await userEvent.setup().click(button);

    expect(onLogout).toHaveBeenCalledTimes(1);
    // Wired to the click itself (not to a surrounding element or a keyboard-only path).
    expect(onLogout.mock.calls[0][0].type).toBe('click');
  });

  it('is a type="button" control, so it never submits a surrounding form', () => {
    const onSubmit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <OnboardingSessionAction onLogout={vi.fn()} label={LABEL} />
      </form>,
    );

    const button = screen.getByRole('button', { name: LABEL });
    expect(button.getAttribute('type')).toBe('button');

    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders the label the caller passes, so each screen stays translated', () => {
    renderAction({ label: 'Log out' });

    expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: LABEL })).toBeNull();
  });
});

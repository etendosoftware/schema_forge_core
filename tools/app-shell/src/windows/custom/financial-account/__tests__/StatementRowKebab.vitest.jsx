import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/i18n', () => ({ useUI: () => (key) => key }));

import { StatementRowKebab } from '../StatementRowKebab.jsx';

const DRAFT = { id: 'd1', status: 'DRAFT', processed: 'N' };
const PROCESSED = { id: 'p1', status: 'PENDING', processed: 'Y' };

function renderKebab(statement, overrides = {}) {
  const props = {
    statement,
    onEdit: vi.fn(),
    onProcess: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  return { ...render(<StatementRowKebab {...props} />), props };
}

async function openMenu(user, id) {
  await user.click(screen.getByTestId(`statement-row-menu-${id}`));
}

describe('StatementRowKebab', () => {
  it('enables Edit / Process / Delete for a draft and fires the callbacks', async () => {
    const user = userEvent.setup();
    const { props } = renderKebab(DRAFT);
    await openMenu(user, 'd1');

    await user.click(screen.getByTestId('statement-row-edit'));
    expect(props.onEdit).toHaveBeenCalledWith(DRAFT);

    await openMenu(user, 'd1');
    await user.click(screen.getByTestId('statement-row-process'));
    expect(props.onProcess).toHaveBeenCalledWith(DRAFT);

    await openMenu(user, 'd1');
    await user.click(screen.getByTestId('statement-row-delete'));
    expect(props.onDelete).toHaveBeenCalledWith(DRAFT);
  });

  it('disables every action for a processed statement', async () => {
    const user = userEvent.setup();
    const { props } = renderKebab(PROCESSED);
    await openMenu(user, 'p1');

    const edit = screen.getByTestId('statement-row-edit');
    expect(edit).toHaveAttribute('aria-disabled', 'true');

    // Clicking a disabled item must not invoke the callback.
    await user.click(edit);
    expect(props.onEdit).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('statement-row-process'));
    expect(props.onProcess).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('statement-row-delete'));
    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it('treats a statement with processed="N" as a draft even without DRAFT status', async () => {
    const user = userEvent.setup();
    const { props } = renderKebab({ id: 'x', status: 'PARTIAL', processed: 'N' });
    await openMenu(user, 'x');
    await user.click(screen.getByTestId('statement-row-process'));
    expect(props.onProcess).toHaveBeenCalled();
  });
});

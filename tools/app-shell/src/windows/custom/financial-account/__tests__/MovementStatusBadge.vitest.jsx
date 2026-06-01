import { render, screen } from '@testing-library/react';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));

import { MovementStatusBadge } from '../MovementStatusBadge.jsx';

describe('MovementStatusBadge', () => {
  it('renders the consolidated label for a known status (RPR → Completed)', () => {
    render(<MovementStatusBadge status="RPR" />);
    expect(screen.getByText('financeAccountMovementsStatusCompleted')).toBeInTheDocument();
  });

  it('renders the consolidated label for a pending status (RPAP → Draft)', () => {
    render(<MovementStatusBadge status="RPAP" />);
    expect(screen.getByText('financeAccountMovementsStatusDraft')).toBeInTheDocument();
  });

  it('applies inline background/text colors based on the status family', () => {
    const { container } = render(<MovementStatusBadge status="RPR" />);
    const span = container.firstChild;
    // executed family: bg #EFEAFE, text #3D2D8E
    expect(span.style.backgroundColor).toMatch(/239,\s*234,\s*254|#EFEAFE/i);
  });

  it('uses the pending tone for RPAE', () => {
    const { container } = render(<MovementStatusBadge status="RPAE" />);
    const span = container.firstChild;
    // pending family: bg #FFF7E0
    expect(span.style.backgroundColor).toMatch(/255,\s*247,\s*224|#FFF7E0/i);
  });

  it('returns null for an unknown status code', () => {
    const { container } = render(<MovementStatusBadge status="UNKNOWN_CODE" />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when status is missing', () => {
    const { container } = render(<MovementStatusBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('forwards a custom className onto the badge span', () => {
    const { container } = render(
      <MovementStatusBadge status="RPR" className="ml-2 custom-class" />,
    );
    expect(container.firstChild.className).toContain('custom-class');
  });
});

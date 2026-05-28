import { render, screen } from '@testing-library/react';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));

import { PostingStatusDot } from '../PostingStatusDot.jsx';

describe('PostingStatusDot', () => {
  it('renders the "posted" label and a green dot for paymentStatus === RPPC', () => {
    const { container } = render(<PostingStatusDot paymentStatus="RPPC" />);
    expect(screen.getByText('financeAccountMovementsPosted')).toBeInTheDocument();
    const dot = container.querySelector('span > span');
    expect(dot.className).toContain('bg-[#26a95f]');
  });

  it('renders the "not posted" label and an orange dot for any other status', () => {
    const { container } = render(<PostingStatusDot paymentStatus="RPR" />);
    expect(screen.getByText('financeAccountMovementsNotPosted')).toBeInTheDocument();
    const dot = container.querySelector('span > span');
    expect(dot.className).toContain('bg-[#E68A00]');
  });

  it('treats missing paymentStatus as "not posted"', () => {
    render(<PostingStatusDot />);
    expect(screen.getByText('financeAccountMovementsNotPosted')).toBeInTheDocument();
  });

  it('appends a custom className to the wrapper', () => {
    const { container } = render(
      <PostingStatusDot paymentStatus="RPPC" className="ml-4 extra-class" />,
    );
    expect(container.firstChild.className).toContain('extra-class');
  });
});

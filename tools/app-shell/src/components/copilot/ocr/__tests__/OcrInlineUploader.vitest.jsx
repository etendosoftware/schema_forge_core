vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/components/CopilotContext', () => ({
  useCopilot: () => ({ token: 'test-token' }),
}));

vi.mock('../ocrDocTypes', () => ({
  getOcrDocType: (id) => id === 'purchase-invoice' ? {
    id: 'purchase-invoice',
    routePrefix: '/purchase-invoice/',
    toolName: 'SimpleOcrTool',
    eventName: 'copilot:ocr-prefill:purchase-invoice',
    question: 'Extract invoice fields',
    tabId: '290',
  } : null,
}));

vi.mock('../attachFile', () => ({
  attachFile: vi.fn().mockResolvedValue({}),
}));

vi.mock('../buildOcrSchema', () => ({
  buildOcrSchema: () => ({ type: 'object', properties: {} }),
}));

vi.mock('../useOcrExtraction', () => ({
  useOcrExtraction: () => ({
    extract: vi.fn(),
    status: 'idle',
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('../useOcrFlow', () => ({
  useOcrFlow: () => ({
    result: null,
    loading: false,
    pendingModal: null,
  }),
}));

vi.mock('@/windows/custom/shared/PdfViewer.jsx', () => ({
  default: () => <div data-testid="pdf-viewer">PDF</div>,
}));

import { render, screen } from '@testing-library/react';
import OcrInlineUploader from '../OcrInlineUploader.jsx';

describe('OcrInlineUploader', () => {
  const defaultProps = {
    docTypeId: 'purchase-invoice',
    isNew: true,
    apiBaseUrl: '/sws/neo/purchase-invoice',
    onRefresh: vi.fn(),
    token: 'test-token',
  };

  it('renders without crashing', () => {
    const { container } = render(<OcrInlineUploader {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it('shows the drop zone with upload hint', () => {
    render(<OcrInlineUploader {...defaultProps} />);
    expect(screen.getByText('ocrSidePanelDropTitle')).toBeInTheDocument();
    expect(screen.getByText('ocrSidePanelDropHint')).toBeInTheDocument();
  });

  it('returns null when isNew is false', () => {
    const { container } = render(
      <OcrInlineUploader {...defaultProps} isNew={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('returns null when docTypeId is unknown', () => {
    const { container } = render(
      <OcrInlineUploader {...defaultProps} docTypeId="unknown-type" />
    );
    expect(container.innerHTML).toBe('');
  });

  it('has a hidden file input accepting PDF', () => {
    const { container } = render(<OcrInlineUploader {...defaultProps} />);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
    expect(fileInput.getAttribute('accept')).toBe('application/pdf');
  });
});

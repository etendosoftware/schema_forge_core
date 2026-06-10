// Tests for downloadBlobAsFile (pdfUtils.js)
// Uses Vitest + jsdom because the function manipulates the DOM.

vi.mock('@/lib/locationAddress.js', () => ({
  buildLocationAddressLines: vi.fn(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return actual;
});

import { downloadBlobAsFile } from '../pdfUtils.js';

describe('downloadBlobAsFile', () => {
  let createObjectURLMock;
  let revokeObjectURLMock;
  let appendChildMock;
  let removeChildMock;
  let clickMock;
  let createElementMock;

  beforeEach(() => {
    clickMock = vi.fn();
    createObjectURLMock = vi.fn(() => 'blob:http://localhost/test-url');
    revokeObjectURLMock = vi.fn();

    globalThis.URL.createObjectURL = createObjectURLMock;
    globalThis.URL.revokeObjectURL = revokeObjectURLMock;

    appendChildMock = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    removeChildMock = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
    createElementMock = vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls URL.createObjectURL with the provided blob', () => {
    const blob = new Blob(['test'], { type: 'application/pdf' });
    downloadBlobAsFile(blob, 'report.pdf');
    expect(createObjectURLMock).toHaveBeenCalledWith(blob);
  });

  it('creates an anchor element', () => {
    const blob = new Blob(['test'], { type: 'application/pdf' });
    downloadBlobAsFile(blob, 'report.pdf');
    expect(createElementMock).toHaveBeenCalledWith('a');
  });

  it('sets href to the object URL on the anchor', () => {
    const blob = new Blob(['test'], { type: 'application/pdf' });
    const fakeAnchor = { href: '', download: '', click: clickMock };
    createElementMock.mockReturnValue(fakeAnchor);
    downloadBlobAsFile(blob, 'report.pdf');
    expect(fakeAnchor.href).toBe('blob:http://localhost/test-url');
  });

  it('sets download attribute to the provided filename', () => {
    const blob = new Blob(['test'], { type: 'application/pdf' });
    const fakeAnchor = { href: '', download: '', click: clickMock };
    createElementMock.mockReturnValue(fakeAnchor);
    downloadBlobAsFile(blob, 'my-document.pdf');
    expect(fakeAnchor.download).toBe('my-document.pdf');
  });

  it('appends the anchor to document.body', () => {
    const blob = new Blob(['test'], { type: 'application/pdf' });
    downloadBlobAsFile(blob, 'report.pdf');
    expect(appendChildMock).toHaveBeenCalled();
  });

  it('calls click() on the anchor to trigger download', () => {
    const blob = new Blob(['test'], { type: 'application/pdf' });
    downloadBlobAsFile(blob, 'report.pdf');
    expect(clickMock).toHaveBeenCalled();
  });

  it('removes the anchor from document.body after clicking', () => {
    const blob = new Blob(['test'], { type: 'application/pdf' });
    downloadBlobAsFile(blob, 'report.pdf');
    expect(removeChildMock).toHaveBeenCalled();
  });

  it('calls URL.revokeObjectURL with the created URL to free memory', () => {
    const blob = new Blob(['test'], { type: 'application/pdf' });
    downloadBlobAsFile(blob, 'report.pdf');
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:http://localhost/test-url');
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ImportDialog } from '../ImportDialog.jsx';
import { registerImportDescriptor } from '../../../lib/import/buildOperations.js';

afterEach(() => {
  cleanup();
});

const config = {
  spec: 'contacts',
  entity: 'businessPartner',
  fields: [
    { target: 'name', label: 'Name', required: true },
    { target: 'email', label: 'Email', isEmail: true },
  ],
  dedupe: { scope: 'file', key: ['email'] },
};

function makeFile(content, name = 'contacts.csv') {
  return new File([content], name, { type: 'text/csv' });
}

async function uploadFile(content) {
  const input = screen.getByTestId('ImportDropzone__fileInput');
  const file = makeFile(content);
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => screen.getByTestId('ImportColumnMapping__select-Name'));
}

describe('ImportDialog', () => {
  it('parses the file and shows the mapping step with auto-mapped columns', async () => {
    const postBatch = vi.fn();
    render(<ImportDialog open config={config} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    expect(screen.getByTestId('ImportColumnMapping__select-Name').textContent).toContain('Name');
    expect(screen.getByTestId('ImportColumnMapping__select-Email').textContent).toContain('Email');
  });

  it('regression: does not collapse distinct rows into duplicates of each other (config.dedupe.key, not a flat dedupeKeyTargets)', async () => {
    render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com\nAndres,andres@x.com\nSofia,sofia@x.com');
    // Every row is a valid, distinct record — the "Import N" button must count all 3,
    // not silently skip 2 of them as false-positive duplicates of the first.
    await waitFor(() => screen.getByTestId('ImportDialog__importButton'));
    expect(screen.getByTestId('ImportDialog__importButton').textContent).toBe('Import 3');
  });

  it('regression: a window with no dedupe config at all treats every row as unique', async () => {
    const noDedupeConfig = { ...config, dedupe: undefined };
    render(<ImportDialog open config={noDedupeConfig} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com\nAndres,andres@x.com');
    await waitFor(() => screen.getByTestId('ImportDialog__importButton'));
    expect(screen.getByTestId('ImportDialog__importButton').textContent).toBe('Import 2');
  });

  it('shows the file-error dialog for a malformed file and Retry returns to the dropzone', async () => {
    render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    const input = screen.getByTestId('ImportDropzone__fileInput');
    fireEvent.change(input, { target: { files: [makeFile('')] } });
    await waitFor(() => screen.getByTestId('ImportFileErrorDialog__title'));
    fireEvent.click(screen.getByTestId('ImportFileErrorDialog__retry'));
    await waitFor(() => screen.getByTestId('ImportDropzone__fileInput'));
  });

  it('flags an invalid email as a review-queue error before sending', async () => {
    render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nAndres,not-an-email');
    await waitFor(() => screen.getByTestId('ImportReviewQueue__fieldError-0-email'));
  });

  it('drives the confirm → progress → result flow and calls onImported with the sent count', async () => {
    const postBatch = vi.fn().mockResolvedValue({ committed: true, operations: [{ id: 'row', ok: true, recordId: 'REC-1' }] });
    const onImported = vi.fn();
    render(<ImportDialog open config={config} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={onImported} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(1));
  });

  it('regression: config.descriptor (the real decisions.json field) dispatches to the registered composite descriptor, not the flat single-op default', async () => {
    // Async, like the real Contacts descriptor (which awaits FK resolution) — a
    // synchronous mock here would not have caught the sibling bug where an unawaited
    // async descriptor's Promise got JSON.stringify'd as "{}" instead of the real array.
    const descriptorFn = vi.fn().mockImplementation(async () => {
      await Promise.resolve();
      return [
        { id: 'bp', spec: 'contacts', entity: 'businessPartner', body: { name: 'Custom BP body' } },
        { id: 'contact', spec: 'contacts', entity: 'contact', parentRef: 'bp', body: {} },
      ];
    });
    registerImportDescriptor('regression-test-descriptor', descriptorFn);
    const descriptorConfig = { ...config, descriptor: 'regression-test-descriptor' };
    const postBatch = vi.fn().mockResolvedValue({ committed: true, operations: [{ id: 'bp', ok: true, recordId: 'REC-1' }] });
    render(<ImportDialog open config={descriptorConfig} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    await waitFor(() => expect(descriptorFn).toHaveBeenCalled());
    // Prove postBatch received the descriptor's own resolved two-op array, not a flat
    // one-op default and not an unresolved Promise serialized as "{}".
    await waitFor(() => expect(postBatch).toHaveBeenCalled());
    const sentOps = postBatch.mock.calls[0][0];
    expect(Array.isArray(sentOps)).toBe(true);
    expect(sentOps).toHaveLength(2);
    expect(sentOps[0].body.name).toBe('Custom BP body');
  });

  it('shows a failed row in the result review queue with Retry re-invoking postBatch for that row', async () => {
    const postBatch = vi.fn().mockResolvedValue({ committed: false, failedAt: { index: 0 }, error: { message: 'Rejected by server' } });
    render(<ImportDialog open config={config} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    await waitFor(() => screen.getByTestId('ImportReviewQueue__rowError-0'));
    postBatch.mockResolvedValueOnce({ committed: true, operations: [{ id: 'row', ok: true, recordId: 'REC-2' }] });
    fireEvent.click(screen.getByTestId('ImportReviewQueue__retry-0'));
    await waitFor(() => expect(postBatch).toHaveBeenCalledTimes(2));
  });

  it('regression: post-send Retry awaits an async descriptor before calling postBatch, never sends an unresolved Promise', async () => {
    const descriptorFn = vi.fn().mockImplementation(async (row) => {
      await Promise.resolve();
      return [{ id: 'bp', spec: 'contacts', entity: 'businessPartner', body: { name: row.name } }];
    });
    registerImportDescriptor('async-retry-descriptor', descriptorFn);
    const descriptorConfig = { ...config, descriptor: 'async-retry-descriptor' };
    const postBatch = vi.fn().mockResolvedValue({ committed: false, failedAt: { index: 0 }, error: { message: 'Rejected by server' } });
    render(<ImportDialog open config={descriptorConfig} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    await waitFor(() => screen.getByTestId('ImportReviewQueue__rowError-0'));
    postBatch.mockResolvedValueOnce({ committed: true, operations: [{ id: 'bp', ok: true, recordId: 'REC-2' }] });
    fireEvent.click(screen.getByTestId('ImportReviewQueue__retry-0'));
    await waitFor(() => expect(postBatch).toHaveBeenCalledTimes(2));
    const retryOps = postBatch.mock.calls[1][0];
    expect(Array.isArray(retryOps)).toBe(true);
    expect(retryOps[0].body.name).toBe('Lucia');
  });
});

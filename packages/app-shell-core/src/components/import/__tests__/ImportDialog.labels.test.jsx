import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// ETP-4669: ImportDialog is the single point that fans the nested `labels` prop out to every
// child of the import flow. These tests mock each child so we can assert the EXACT sub-slice
// each one receives (by object identity), not merely that something rendered — a mis-wiring
// (e.g. forwarding `labels.confirm` where `labels.mapping` belongs) would slip past a
// render-only assertion but is caught here. The root-level chrome (title, downloadTemplate,
// importButton) is asserted through the real DOM, since ImportDialog renders it itself.

const captured = vi.hoisted(() => ({}));

vi.mock('../ImportDropzone.jsx', () => ({
  ImportDropzone: (props) => {
    captured.dropzone = props;
    return (
      <div data-testid="mock-dropzone">
        <button
          type="button"
          data-testid="mock-dropzone-select"
          onClick={() => props.onFileSelected(new File(['Name,Email\nLucia,lucia@x.com'], 'c.csv', { type: 'text/csv' }))}
        />
        <button
          type="button"
          data-testid="mock-dropzone-bad"
          onClick={() => props.onFileSelected(new File([''], 'empty.csv', { type: 'text/csv' }))}
        />
      </div>
    );
  },
}));

vi.mock('../ImportColumnMapping.jsx', () => ({
  ImportColumnMapping: (props) => {
    captured.mapping = props;
    return <div data-testid="mock-mapping" />;
  },
}));

// ImportDialog imports both ImportReviewQueue and buildErrorsCsv from this module — the mock
// must preserve both named exports or the import itself breaks.
vi.mock('../ImportReviewQueue.jsx', () => ({
  buildErrorsCsv: () => '',
  ImportReviewQueue: (props) => {
    captured.reviewQueue = props;
    return <div data-testid="mock-reviewQueue" />;
  },
}));

vi.mock('../ImportConfirmStep.jsx', () => ({
  ImportConfirmStep: (props) => {
    captured.confirm = props;
    return <button type="button" data-testid="mock-confirm" onClick={() => props.onConfirm()} />;
  },
}));

vi.mock('../ImportProgressStep.jsx', () => ({
  ImportProgressStep: (props) => {
    captured.progress = props;
    return <div data-testid="mock-progress" />;
  },
}));

vi.mock('../ImportFileErrorDialog.jsx', () => ({
  ImportFileErrorDialog: (props) => {
    captured.fileError = props;
    return <div data-testid="mock-fileError" />;
  },
}));

vi.mock('../ImportSystemErrorDialog.jsx', () => ({
  ImportSystemErrorDialog: (props) => {
    captured.systemError = props;
    return props.open ? <div data-testid="mock-systemError" /> : null;
  },
}));

import { ImportDialog } from '../ImportDialog.jsx';

// The real Radix Dialog stays mounted (only the step children are mocked); jsdom needs the
// same observer/pointer polyfills the sibling ImportDialog.test.jsx already installs.
if (!global.ResizeObserver) {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const config = {
  spec: 'contacts',
  entity: 'businessPartner',
  fields: [
    { target: 'name', label: 'Name', required: true },
    { target: 'email', label: 'Email', isEmail: true },
  ],
  dedupe: { scope: 'file', key: ['email'] },
};

// Distinct sentinel per slice — every child's sub-slice is a unique object, so an identity
// (toBe) assertion proves the RIGHT slice reached the RIGHT child, not just any label.
const labels = {
  title: 'L_title',
  revalidating: 'L_revalidating',
  downloadTemplate: 'L_downloadTemplate',
  importButton: (n) => `L_import_${n}`,
  dropzone: { dropHere: 'L_dropHere', dropHint: 'L_dropHint' },
  progress: { title: 'L_progressTitle', subtitle: 'L_progressSubtitle' },
  mapping: { notImported: 'L_notImported', mappedSummary: 'L_mappedSummary', editMatch: 'L_editMatch', editTitle: 'L_editTitle', save: 'L_save', cancel: 'L_cancel' },
  confirm: { title: 'L_confirmTitle', willImport: (n) => `L_willImport_${n}`, willSkip: (n) => `L_willSkip_${n}`, cancel: 'L_cancel', confirm: 'L_confirm' },
  fileError: { title: 'L_fileErrorTitle', cancel: 'L_cancel', retry: 'L_retry' },
  reviewQueue: { filterAll: 'L_filterAll', filterError: 'L_filterError', skip: 'L_skip', retry: 'L_rqRetry' },
  systemError: { title: 'L_sysTitle', subtitle: 'L_sysSubtitle', close: 'L_sysClose' },
};

function renderDialog(props = {}) {
  return render(
    <ImportDialog
      open
      config={config}
      token="t"
      postBatch={vi.fn()}
      simSearchFn={vi.fn()}
      onImported={() => {}}
      labels={labels}
      {...props}
    />,
  );
}

async function driveToMapping() {
  fireEvent.click(screen.getByTestId('mock-dropzone-select'));
  await waitFor(() => screen.getByTestId('mock-mapping'));
}

beforeEach(() => {
  for (const k of Object.keys(captured)) delete captured[k];
});
afterEach(() => cleanup());

describe('ImportDialog — label forwarding to every child', () => {
  it('forwards labels.dropzone to ImportDropzone and renders the root chrome (title, downloadTemplate) from the merged labels', () => {
    renderDialog();
    expect(captured.dropzone.labels).toBe(labels.dropzone);
    expect(screen.getByTestId('DialogTitle__38a6c3').textContent).toBe('L_title');
    expect(screen.getByTestId('ImportDialog__downloadTemplate').textContent).toBe('L_downloadTemplate');
  });

  it('always mounts ImportSystemErrorDialog with labels.systemError (closed until a failure occurs)', () => {
    renderDialog();
    expect(captured.systemError.labels).toBe(labels.systemError);
    expect(captured.systemError.open).toBe(false);
  });

  it('forwards labels.mapping to ImportColumnMapping, labels.reviewQueue to ImportReviewQueue, and interpolates the import button with the valid-row count', async () => {
    renderDialog();
    await driveToMapping();
    expect(captured.mapping.labels).toBe(labels.mapping);
    expect(captured.reviewQueue.labels).toBe(labels.reviewQueue);
    // Pre-send queue has no retry affordance — the (n) => string chrome label is what renders
    // on the real Import button, proving importButton() is called with the count, not a constant.
    expect(captured.reviewQueue.retryLabel).toBeUndefined();
    expect(screen.getByTestId('ImportDialog__importButton').textContent).toBe('L_import_1');
  });

  it('forwards labels.confirm to ImportConfirmStep', async () => {
    renderDialog();
    await driveToMapping();
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    await waitFor(() => screen.getByTestId('mock-confirm'));
    expect(captured.confirm.labels).toBe(labels.confirm);
  });

  it('forwards labels.progress to ImportProgressStep while a send is in flight', async () => {
    // A postBatch that never resolves pins the dialog on the SENDING step so the progress
    // child is deterministically observable (not a transient flash between confirm and result).
    const postBatch = vi.fn(() => new Promise(() => {}));
    renderDialog({ postBatch });
    await driveToMapping();
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(await screen.findByTestId('mock-confirm'));
    await waitFor(() => expect(captured.progress).toBeTruthy());
    expect(captured.progress.labels).toBe(labels.progress);
  });

  it('forwards labels.reviewQueue + retryLabel to the result-step queue and labels.systemError (now open) after a failed send', async () => {
    // Classified FAILED (unrecognized backend message) → the result step renders the review
    // queue with a retry affordance AND opens the system-error dialog.
    const postBatch = vi.fn().mockResolvedValue({ message: 'boom-unrecognized' });
    renderDialog({ postBatch });
    await driveToMapping();
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(await screen.findByTestId('mock-confirm'));
    await waitFor(() => expect(captured.systemError.open).toBe(true));
    expect(captured.reviewQueue.labels).toBe(labels.reviewQueue);
    expect(captured.reviewQueue.retryLabel).toBe(labels.reviewQueue.retry);
    expect(captured.systemError.labels).toBe(labels.systemError);
  });

  it('forwards labels.fileError to ImportFileErrorDialog when a file fails to parse', async () => {
    renderDialog();
    fireEvent.click(screen.getByTestId('mock-dropzone-bad'));
    await waitFor(() => screen.getByTestId('mock-fileError'));
    expect(captured.fileError.labels).toBe(labels.fileError);
  });
});

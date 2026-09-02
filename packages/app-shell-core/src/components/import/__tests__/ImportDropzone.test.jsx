import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ImportDropzone } from '../ImportDropzone.jsx';

afterEach(() => {
  cleanup();
});

describe('ImportDropzone', () => {
  it('renders default English copy', () => {
    render(<ImportDropzone onFileSelected={() => {}} />);
    expect(screen.getByTestId('ImportDropzone__title').textContent).toBe('Drop your file here');
    // The format list is interpolated from the window's declaration now, so the hint reads as a
    // list rather than the old welded-in "CSV or TXT".
    expect(screen.getByTestId('ImportDropzone__hint').textContent).toMatch(/Supported formats: CSV, TXT/);
  });

  // `formats` is window.import.formats. It must govern BOTH the accept attribute and the hint:
  // they were independently hardcoded before, which is how the declaration became config that
  // could say anything without consequence.
  it('derives the accept attribute and the hint from the declared formats', () => {
    render(<ImportDropzone onFileSelected={() => {}} formats={['csv', 'txt', 'xlsx']} />);
    expect(screen.getByTestId('ImportDropzone__fileInput').getAttribute('accept')).toBe('.csv,.txt,.xlsx');
    expect(screen.getByTestId('ImportDropzone__hint').textContent).toMatch(/CSV, TXT, XLSX/);
  });

  it('falls back to the pre-existing CSV/TXT accept when a window declares nothing', () => {
    render(<ImportDropzone onFileSelected={() => {}} />);
    expect(screen.getByTestId('ImportDropzone__fileInput').getAttribute('accept')).toBe('.csv,.txt');
  });

  it('lets an explicit accept win, for a caller that is not import-driven', () => {
    render(<ImportDropzone onFileSelected={() => {}} accept=".pdf" formats={['csv', 'xlsx']} />);
    expect(screen.getByTestId('ImportDropzone__fileInput').getAttribute('accept')).toBe('.pdf');
  });

  // SHELL-02 — the icon must match the toolbar button that opens this dialog (Import =
  // Download, because the DATA comes into Etendo). The dropzone shipped with `Upload`, so the
  // popup contradicted the button the user had just clicked. Asserted rather than left to
  // review: an icon swap is invisible to every other test in this file.
  it('carries the Download icon, not Upload', () => {
    render(<ImportDropzone onFileSelected={() => {}} />);
    expect(screen.getByTestId('Download__ImportDropzone')).toBeTruthy();
    expect(screen.queryByTestId('Upload__607f9c')).toBeNull();
  });

  it('renders overridden copy from labels', () => {
    render(<ImportDropzone onFileSelected={() => {}} labels={{ dropHere: 'Suelta tu archivo' }} />);
    expect(screen.getByTestId('ImportDropzone__title').textContent).toBe('Suelta tu archivo');
  });

  it('calls onFileSelected when a file is chosen via the hidden input', () => {
    const onFileSelected = vi.fn();
    render(<ImportDropzone onFileSelected={onFileSelected} />);
    const file = new File(['a,b\n1,2'], 'contacts.csv', { type: 'text/csv' });
    const input = screen.getByTestId('ImportDropzone__fileInput');
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it('calls onFileSelected on drop', () => {
    const onFileSelected = vi.fn();
    render(<ImportDropzone onFileSelected={onFileSelected} />);
    const file = new File(['a,b\n1,2'], 'contacts.csv', { type: 'text/csv' });
    const dropzone = screen.getByTestId('ImportDropzone__zone');
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it('does nothing when drop carries no files', () => {
    const onFileSelected = vi.fn();
    render(<ImportDropzone onFileSelected={onFileSelected} />);
    const dropzone = screen.getByTestId('ImportDropzone__zone');
    fireEvent.drop(dropzone, { dataTransfer: { files: [] } });
    expect(onFileSelected).not.toHaveBeenCalled();
  });
});

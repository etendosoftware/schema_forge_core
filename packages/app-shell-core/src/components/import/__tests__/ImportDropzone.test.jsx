import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ImportDropzone } from '../ImportDropzone.jsx';

afterEach(() => {
  cleanup();
});

describe('ImportDropzone', () => {
  it('renders default English copy', () => {
    render(<ImportDropzone onFileSelected={() => {}} />);
    expect(screen.getByText('Drop your file here')).toBeDefined();
    expect(screen.getByText(/Supported formats: CSV or TXT/)).toBeDefined();
  });

  it('renders overridden copy from labels', () => {
    render(<ImportDropzone onFileSelected={() => {}} labels={{ dropHere: 'Suelta tu archivo' }} />);
    expect(screen.getByText('Suelta tu archivo')).toBeDefined();
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

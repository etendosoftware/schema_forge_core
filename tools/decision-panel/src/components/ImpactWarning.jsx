import { useState } from 'react';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle = {
  background: '#fff',
  borderRadius: 8,
  padding: 24,
  maxWidth: 480,
  width: '90%',
  boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
};

const btnRow = { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 };

const btnBase = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontWeight: 600,
};

/**
 * ImpactWarning modal — shown when discarding a field or omitting a rule.
 * Props:
 *   message    — impact message string
 *   itemName   — name of the field/rule being affected
 *   onConfirm  — callback when user confirms
 *   onCancel   — callback when user cancels
 */
export default function ImpactWarning({ message, itemName, onConfirm, onCancel }) {
  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px', color: '#c0392b' }}>Impact Warning</h3>
        <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{itemName}</p>
        <p style={{ margin: '0 0 16px', color: '#555', lineHeight: 1.5 }}>{message}</p>
        <div style={btnRow}>
          <button
            style={{ ...btnBase, background: '#eee', color: '#333' }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            style={{ ...btnBase, background: '#c0392b', color: '#fff' }}
            onClick={onConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';

const PROFILES = [
  { key: 'sii',        label: 'SII' },
  { key: 'sii-navarra',label: 'SII Navarra' },
  { key: 'sii+tbai',   label: 'SII + TBAI' },
  { key: 'tbai',       label: 'TBAI' },
  { key: 'verifactu',  label: 'Verifactu' },
];

const panelStyle = {
  position: 'fixed',
  top: 56,
  right: 16,
  zIndex: 9999,
  background: '#1a1a2e',
  color: '#e0e0ff',
  borderRadius: 10,
  padding: '10px 14px',
  minWidth: 220,
  boxShadow: '0 4px 24px rgba(0,0,0,.45)',
  fontSize: 12,
  fontFamily: 'var(--font-mono, monospace)',
};

export default function FiscalMonitorDebugPanel({ activeProfile, onProfileChange, mockData, onMockDataChange }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsed ? 0 : 8 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.08em', color: '#a0a0cc', textTransform: 'uppercase' }}>
          ⚙ Debug · Fiscal Monitor
        </span>
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ background: 'none', border: 'none', color: '#a0a0cc', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
        >
          {collapsed ? '▾' : '▴'}
        </button>
      </div>

      {!collapsed && (
        <>
          <div style={{ fontSize: 10, color: '#a0a0cc', marginBottom: 6 }}>Profile override</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {PROFILES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => onProfileChange(activeProfile === key ? null : key)}
                style={{
                  background: activeProfile === key ? '#5423E7' : '#2d2d4a',
                  border: '1px solid ' + (activeProfile === key ? '#7a55ff' : '#3d3d5c'),
                  borderRadius: 6,
                  color: '#e0e0ff',
                  cursor: 'pointer',
                  padding: '4px 10px',
                  textAlign: 'left',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  transition: 'background .1s',
                }}
              >
                {activeProfile === key ? '✓ ' : '  '}{label}
              </button>
            ))}
          </div>
          {activeProfile && (
            <div style={{ marginTop: 8, fontSize: 10, color: '#7a7aaa', lineHeight: 1.4 }}>
              Showing design for <strong style={{ color: '#e0e0ff' }}>{activeProfile}</strong>.
            </div>
          )}
          {!activeProfile && (
            <div style={{ marginTop: 8, fontSize: 10, color: '#7a7aaa' }}>
              No override — real profile active.
            </div>
          )}

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #2d2d4a' }}>
            <div style={{ fontSize: 10, color: '#a0a0cc', marginBottom: 6 }}>Data</div>
            <button
              onClick={() => onMockDataChange(!mockData)}
              style={{
                width: '100%',
                background: mockData ? '#1a3a1a' : '#2d2d4a',
                border: '1px solid ' + (mockData ? '#2a5c2a' : '#3d3d5c'),
                borderRadius: 6,
                color: mockData ? '#b3ffb3' : '#e0e0ff',
                cursor: 'pointer',
                padding: '4px 10px',
                textAlign: 'left',
                fontSize: 12,
                fontFamily: 'inherit',
                transition: 'background .1s',
              }}
            >
              {mockData ? '✓ ' : '  '}Mock data
            </button>
            {mockData && (
              <div style={{ marginTop: 5, fontSize: 10, color: '#7a7aaa', lineHeight: 1.4 }}>
                KPIs and table rows are static samples.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

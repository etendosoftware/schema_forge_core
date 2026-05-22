import { useState } from 'react';

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.3)',
};

const containerStyle = {
  width: 400, borderRadius: 14,
  backgroundColor: '#fff',
  boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
  border: '0.5px solid #E5E7EB',
  overflow: 'hidden',
};

const btnSecondary = {
  fontSize: 12, padding: '7px 14px', borderRadius: 6,
  border: '1px solid #D1D5DB', background: 'transparent', color: '#6B7280', cursor: 'pointer',
};

const fmtNum = (v) =>
  Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ResultDocCard({ icon, label, amount, currency, color, ui, onClick }) {
  const [hovered, setHovered] = useState(false);
  const isBlue  = color === 'blue';
  const accent  = isBlue ? '#185FA5' : '#059669';
  const bg      = isBlue ? '#EFF6FF' : '#ECFDF5';
  const border  = isBlue ? '#BFDBFE' : '#A7F3D0';
  const hoverBg = isBlue ? '#DBEAFE' : '#D1FAE5';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        borderRadius: 10, cursor: 'pointer',
        border: `1px solid ${border}`,
        background: hovered ? hoverBg : bg,
        transition: 'background 0.15s',
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: accent }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          {amount != null && Number(amount) !== 0 && (
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              {fmtNum(amount)}{currency ? ` ${currency}` : ''}
            </span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
            background: '#FEF3C7', color: '#92400E',
          }}>
            {ui('statusDraft')}
          </span>
        </div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" style={{ flexShrink: 0 }}>
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  );
}

export function ConfirmResultModal({ title, cards = [], navigate, ui, currency = '', onClose }) {
  const hasDocs = cards.length > 0;

  return (
    <div style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={containerStyle}>

        <div style={{ padding: '28px 24px 20px', textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', margin: '0 auto 14px',
            background: '#ECFDF5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{title}</div>
          {hasDocs && (
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 5, lineHeight: 1.4 }}>
              {ui('soConfirmedSubtitle')}
            </div>
          )}
        </div>

        {hasDocs && (
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cards.map((card, i) => (
              <ResultDocCard
                key={i}
                icon={card.icon}
                label={card.label}
                amount={card.amount}
                currency={currency}
                color={card.color}
                ui={ui}
                onClick={() => { onClose(); navigate(card.route); }}
              />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '0.5px solid #E5E7EB' }}>
          <button type="button" onClick={() => { onClose(); window.location.reload(); }} style={btnSecondary}>
            {ui('soClose')}
          </button>
        </div>
      </div>
    </div>
  );
}

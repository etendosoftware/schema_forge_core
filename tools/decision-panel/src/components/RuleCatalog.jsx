import { useState } from 'react';
import ImpactWarning from './ImpactWarning.jsx';

const DECISIONS = ['Keep', 'Replace', 'Simplify', 'Omit'];

const cellStyle = { padding: '6px 10px', borderBottom: '1px solid #eee', verticalAlign: 'top' };
const headerStyle = {
  ...cellStyle,
  background: '#f8f9fa',
  fontWeight: 600,
  position: 'sticky',
  top: 0,
};

const badgeBase = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 10,
  fontSize: 11,
  fontWeight: 700,
  marginLeft: 4,
};

function TierBadge({ tier }) {
  const isAuto = tier === 'auto';
  return (
    <span
      style={{
        ...badgeBase,
        background: isAuto ? '#d5f5e3' : '#fdebd0',
        color: isAuto ? '#1e8449' : '#b7590e',
      }}
    >
      {isAuto ? 'auto' : 'human'}
    </span>
  );
}

function ComplexityIndicator({ complexity }) {
  const level = complexity || 'low';
  const colors = { low: '#27ae60', medium: '#f39c12', high: '#e74c3c' };
  return (
    <span style={{ color: colors[level] || '#999', fontWeight: 600, fontSize: 12 }}>
      {level.toUpperCase()}
    </span>
  );
}

function DmlBadge({ hasDml }) {
  if (!hasDml) return null;
  return (
    <span
      style={{
        ...badgeBase,
        background: '#fadbd8',
        color: '#c0392b',
      }}
    >
      DML
    </span>
  );
}

/**
 * RuleCatalog — table of business rules.
 * Props:
 *   rules           — array of rule objects from rules-raw.json / rules-classified.json
 *   impactMessages  — object from impact-messages.json
 *   onRuleChange    — (ruleId, changes) => void
 */
export default function RuleCatalog({ rules, impactMessages, onRuleChange }) {
  const [warning, setWarning] = useState(null);

  const handleDecisionChange = (rule, decision) => {
    if (decision === 'Omit') {
      const category = rule.impactCategory || 'internal';
      const message = impactMessages[category] || 'Omitting this rule may have side effects.';
      setWarning({ ruleId: rule.id || rule.name, ruleName: rule.name, message, decision });
    } else {
      onRuleChange(rule.id || rule.name, { decision, justification: '' });
    }
  };

  const confirmOmit = () => {
    if (warning) {
      onRuleChange(warning.ruleId, { decision: warning.decision });
      setWarning(null);
    }
  };

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <h2 style={{ padding: '12px 16px', margin: 0, background: '#f0f0f0', fontSize: 16 }}>
        Rule Catalog
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={headerStyle}>Rule</th>
            <th style={headerStyle}>Type</th>
            <th style={headerStyle}>Tier</th>
            <th style={headerStyle}>Decision</th>
            <th style={headerStyle}>Justification</th>
            <th style={headerStyle}>AI Hint</th>
            <th style={headerStyle}>Complexity</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => {
            const id = rule.id || rule.name;
            const tier = rule.tier || 'human';
            const decision = rule.decision || '';
            const isHuman = tier === 'human';
            return (
              <tr key={id}>
                <td style={cellStyle}>
                  {rule.name}
                  <DmlBadge hasDml={rule.hasDml} />
                </td>
                <td style={cellStyle}>{rule.type || '—'}</td>
                <td style={cellStyle}>
                  <TierBadge tier={tier} />
                </td>
                <td style={cellStyle}>
                  {tier === 'auto' && !rule.overridden ? (
                    <div>
                      <span style={{ fontSize: 12, color: '#666' }}>
                        Auto: <strong>{rule.autoDecision || 'Keep'}</strong>
                      </span>
                      <br />
                      <button
                        style={{
                          fontSize: 11,
                          marginTop: 4,
                          cursor: 'pointer',
                          color: '#2980b9',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                        onClick={() =>
                          onRuleChange(id, { overridden: true, decision: rule.autoDecision || 'Keep' })
                        }
                      >
                        Override
                      </button>
                    </div>
                  ) : (
                    <select
                      value={decision}
                      onChange={(e) => handleDecisionChange(rule, e.target.value)}
                      style={{
                        border: '1px solid #ccc',
                        borderRadius: 3,
                        padding: '2px 4px',
                      }}
                    >
                      <option value="">— select —</option>
                      {DECISIONS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td style={cellStyle}>
                  {decision === 'Omit' || isHuman ? (
                    <input
                      type="text"
                      value={rule.justification || ''}
                      placeholder={decision === 'Omit' ? 'Required justification' : 'Optional notes'}
                      onChange={(e) => onRuleChange(id, { justification: e.target.value })}
                      style={{
                        border: `1px solid ${decision === 'Omit' && !rule.justification ? '#e74c3c' : '#ccc'}`,
                        borderRadius: 3,
                        padding: '2px 6px',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ ...cellStyle, color: '#888', fontSize: 12, fontStyle: 'italic' }}>
                  {rule.aiRecommendation || '—'}
                </td>
                <td style={cellStyle}>
                  <ComplexityIndicator complexity={rule.complexity} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {warning && (
        <ImpactWarning
          itemName={warning.ruleName}
          message={warning.message}
          onConfirm={confirmOmit}
          onCancel={() => setWarning(null)}
        />
      )}
    </div>
  );
}

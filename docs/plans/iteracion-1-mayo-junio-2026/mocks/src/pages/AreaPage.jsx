import { useEffect, useMemo, useState } from 'react';
import { taskIsVisible } from '../data/areas.js';
import { windowProposals } from '../data/proposals/index.js';

function docName(path) {
  return path.split('/').pop();
}

function buildDetailLines(row, proposal) {
  const safeRow = row || [];
  return [
    ['10', safeRow[0] || proposal.title, safeRow[1] || 'Main record', safeRow[2] || 'Open'],
    ['20', 'Validation step', proposal.workflow?.[1] || 'Review data', safeRow[3] || proposal.primaryAction],
    ['30', 'Completion step', proposal.workflow?.[proposal.workflow.length - 1] || 'Complete workflow', proposal.primaryAction],
  ];
}

export function AreaPage({ area, stage }) {
  const firstVisibleTask = useMemo(
    () => area.tasks.find((task) => taskIsVisible(task, stage)) || area.tasks[0],
    [area, stage]
  );
  const [selectedTaskName, setSelectedTaskName] = useState(firstVisibleTask[0]);
  const [activeTab, setActiveTab] = useState('screen');
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const selectedTask = area.tasks.find((task) => task[0] === selectedTaskName) || firstVisibleTask;
  const proposal = windowProposals[selectedTask[0]] || {
    title: selectedTask[0],
    purpose: area.reviewerPoint,
    primaryAction: 'Primary action',
    secondaryActions: ['List', 'Detail', 'Audit'],
    kpis: area.kpis.map(([label, value, hint]) => [label, value, hint, `Review whether ${label} helps users complete ${selectedTask[0]}.`]),
    columns: [
      { label: 'Record', tip: 'The main business object for the selected point.' },
      { label: 'Context', tip: 'Context columns should be only what users need to decide the next action.' },
      { label: 'Status', tip: 'Status vocabulary should match the source task and final workflow.' },
      { label: 'Next action', tip: 'This should become the most obvious next step for the user.' },
    ],
    rows: area.records,
    fields: area.editor.map(([label, value]) => [label, value, `Validate whether ${label} belongs on this final page or in a detail drawer.`]),
    workflow: area.workflow,
    hoverNotes: {
      primaryAction: 'Primary action proposed for this final page. In implementation this may become a generated action or a NeoHandler-backed command.',
      table: `Example data for ${selectedTask[0]}. Replace with real NEO records when implementing.`,
      fields: `Fields proposed for ${selectedTask[0]}.`,
    },
  };
  const selectedRow = selectedRowIndex == null ? null : proposal.rows[selectedRowIndex];
  const detailLines = buildDetailLines(selectedRow, proposal);

  useEffect(() => {
    setSelectedRowIndex(null);
  }, [selectedTaskName]);

  return (
    <div className="tool-page">
      <section className="tool-hero">
        <div>
          <span className="muted-label">{area.priority} / {area.owner} / {area.timing}</span>
          <h2>{area.name}</h2>
          <p>{area.intent}</p>
        </div>
        <div className="tool-summary">
          <strong>What to decide</strong>
          <p>{area.decisionNeeded}</p>
        </div>
      </section>

      <div className="area-tabs" role="tablist" aria-label={`${area.name} review tabs`}>
        <button
          className={activeTab === 'screen' ? 'active' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === 'screen'}
          onClick={() => setActiveTab('screen')}
        >
          Final page
        </button>
        <button
          className={activeTab === 'definition' ? 'active' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === 'definition'}
          onClick={() => setActiveTab('definition')}
        >
          Definition
        </button>
      </div>

      {activeTab === 'definition' && (
        <section className="definition-layout">
        <aside className="tool-sidebar" aria-label="Source documents">
          <div className="panel-heading compact">
            <div>
              <span className="muted-label">1. Source documents</span>
              <h3>Plan input</h3>
            </div>
          </div>

          <div className="source-box">
            <span className="muted-label">Area index</span>
            <strong>{docName(area.taskLink)}</strong>
            <code>{area.taskLink.replace('../', '')}</code>
          </div>

          <div className="task-picker">
            {area.tasks.map((task) => {
              const visible = taskIsVisible(task, stage);
              const selected = selectedTask[0] === task[0];
              return (
                <button
                  key={task[0]}
                  className={[
                    'source-task',
                    selected ? 'active' : '',
                    visible ? '' : 'muted',
                  ].join(' ')}
                  type="button"
                  onClick={() => setSelectedTaskName(task[0])}
                >
                  <span className={visible ? 'status-dot ready' : 'status-dot'} />
                  <strong>{task[0]}</strong>
                  <small>{docName(task[2])} / starts {task[1]}</small>
                </button>
              );
            })}
          </div>

          <div className="source-box">
            <span className="muted-label">Selected task file</span>
            <strong>{docName(selectedTask[2])}</strong>
            <code>{selectedTask[2].replace('../', '')}</code>
          </div>
        </aside>

        <main className="definition-main" aria-label="Definition and traceability">
          <section className="mock-panel">
            <div className="panel-heading">
              <div>
                <span className="muted-label">What this area means</span>
                <h3>{selectedTask[0]}</h3>
              </div>
            </div>
            <p>{area.intent}</p>
            <div className="context-note">
              <strong>Mock point:</strong>
              <span>{area.reviewerPoint}</span>
            </div>
          </section>

          <section className="mock-panel">
            <div className="panel-heading compact">
              <div>
                <span className="muted-label">Schema Forge impact</span>
                <h3>Build mapping</h3>
              </div>
            </div>
            <div className="definition-schema-grid">
              {area.schemaForge.map((item, index) => (
                <div className="schema-row" key={item}>
                  <span>{index + 1}</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="definition-two-col">
            <article className="mock-panel">
              <h3>Feedback needed</h3>
              <ul className="plain-list">
                {area.questions.map((question) => <li key={question}>{question}</li>)}
              </ul>
            </article>
            <article className="mock-panel">
              <h3>Not decided in this mock</h3>
              <ul className="plain-list">
                {area.notInMock.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          </section>
        </main>
      </section>
      )}

      {activeTab === 'screen' && (
        <section className="screen-layout">
        <aside className="tool-sidebar" aria-label="Points">
          <div className="panel-heading compact">
            <div>
              <span className="muted-label">Point selector</span>
              <h3>Final pages</h3>
            </div>
          </div>

          <div className="task-picker">
            {area.tasks.map((task) => {
              const visible = taskIsVisible(task, stage);
              const selected = selectedTask[0] === task[0];
              return (
                <button
                  key={task[0]}
                  className={[
                    'source-task',
                    selected ? 'active' : '',
                    visible ? '' : 'muted',
                  ].join(' ')}
                  type="button"
                  onClick={() => setSelectedTaskName(task[0])}
                >
                  <span className={visible ? 'status-dot ready' : 'status-dot'} />
                  <strong>{task[0]}</strong>
                  <small>{visible ? 'Reviewable now' : `Starts at ${task[1]}`}</small>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="tool-main" aria-label="App surface preview">
          <div className="panel-heading">
            <div>
              <span className="muted-label">Final app page</span>
              <h3>{proposal.title}</h3>
            </div>
            <div className="segmented">
              {(proposal.secondaryActions?.length ? proposal.secondaryActions : ['List', 'Detail', 'Audit']).slice(0, 3).map((action, index) => (
                <button type="button" className={index === 0 ? 'active' : ''} key={action}>{action}</button>
              ))}
            </div>
          </div>

          <div className="context-note">
            <strong>Functionality:</strong>
            <span>{proposal.purpose}</span>
          </div>

          <section className="app-preview">
            <div className="preview-toolbar">
              <div>
                <strong>{proposal.title}</strong>
                <span>Grid first. Select a row to open header and lines.</span>
              </div>
              <button className="btn primary explainable" data-tip={proposal.hoverNotes?.primaryAction} type="button">{proposal.primaryAction}</button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  {proposal.columns.map((column) => (
                    <th key={column.label}><span className="explainable" data-tip={column.tip}>{column.label}</span></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proposal.rows.map((record, rowIndex) => (
                  <tr
                    className={[
                      'explainable-row',
                      'selectable-row',
                      selectedRowIndex === rowIndex ? 'selected' : '',
                    ].join(' ')}
                    data-tip={proposal.hoverNotes?.table}
                    key={`${selectedTask[0]}-${rowIndex}`}
                    onClick={() => setSelectedRowIndex(rowIndex)}
                  >
                    {record.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedRow ? (
              <div className="detail-panel">
                <div className="detail-heading">
                  <div>
                    <span className="muted-label">Selected record</span>
                    <h3>{selectedRow[0]}</h3>
                  </div>
                  <button className="btn secondary" type="button" onClick={() => setSelectedRowIndex(null)}>Close</button>
                </div>

                <section className="detail-section">
                  <div className="section-heading">
                    <span className="muted-label">Header</span>
                    <strong>Record fields</strong>
                  </div>
                  <div className="header-form-grid">
                    {proposal.fields.map(([label, value, tip]) => (
                      <label className="explainable" data-tip={tip || proposal.hoverNotes?.fields} key={label}>
                        <span>{label}</span>
                        <input value={value} readOnly />
                      </label>
                    ))}
                  </div>
                </section>

                <section className="detail-section">
                  <div className="section-heading">
                    <span className="muted-label">Lines</span>
                    <strong>Operational lines</strong>
                  </div>
                  <table className="data-table lines-table">
                    <thead>
                      <tr>
                        <th>Line</th>
                        <th>Description</th>
                        <th>Context</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailLines.map((line) => (
                        <tr key={line.join('-')}>
                          {line.map((cell) => <td key={cell}>{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </div>
            ) : (
              <div className="empty-detail">
                <strong>Select a row to review the form</strong>
                <p>The final page starts as a grid. The form appears only after a user selects a record, with header fields and operational lines.</p>
              </div>
            )}
          </section>

          <section className="mock-panel">
            <h3>User workflow to validate</h3>
            <ol className="step-list">
              {proposal.workflow.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </section>
        </main>

        <aside className="tool-inspector" aria-label="Screen review notes">
          <div className="panel-heading compact">
            <div>
              <span className="muted-label">Review notes</span>
              <h3>What to check on this screen</h3>
            </div>
          </div>

          <div className="inspector-section">
            <p>{proposal.purpose}</p>
          </div>

          <div className="inspector-section">
            <h3>Hover guide</h3>
            <p>Hover over table headers, rows, actions, and detail fields to see why each element exists and what feedback is needed.</p>
          </div>

          <div className="inspector-section">
            <h3>Feedback prompts</h3>
            <ul className="plain-list">
              {area.questions.map((question) => <li key={question}>{question}</li>)}
            </ul>
          </div>

          <div className="inspector-section">
            <h3>Source task</h3>
            <ul className="plain-list">
              <li>{selectedTask[0]}</li>
              <li>{selectedTask[2].replace('../', '')}</li>
            </ul>
          </div>
        </aside>
      </section>
      )}
    </div>
  );
}

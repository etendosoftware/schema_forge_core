import { stages, areas } from '../data/areas.js';

export function OverviewPage({ stage, visibleAreas }) {
  const currentStage = stages.find((item) => item.id === stage);

  return (
    <div className="page-stack">
      <section className="intro-panel">
        <div>
          <span className="muted-label">What this tool is</span>
          <h2>A planning review tool for Schema Forge work</h2>
          <p>
            Use this like an internal product tool: choose a module, read the source task,
            review the proposed app surface, then decide what Schema Forge must generate or
            customize. It is not the final app and it is not a generated artifact.
          </p>
        </div>
        <div className="note-box">
          <strong>Current stage: {currentStage.label}</strong>
          <span>{currentStage.title} - {currentStage.range}</span>
          <p>Use the stage selector to reveal areas progressively according to the Gantt plan.</p>
        </div>
      </section>

      <section className="trace-panel" aria-label="Traceability explanation">
        <div className="trace-step">
          <span>1</span>
          <strong>Plan docs</strong>
          <p>README, Gantt, TASKS.md, and the detailed files define scope, dependencies, acceptance criteria, and risks.</p>
        </div>
        <div className="trace-arrow">to</div>
        <div className="trace-step">
          <span>2</span>
          <strong>These mocks</strong>
          <p>Clickable review pages translate those requirements into screens, workflows, notes, and feedback questions.</p>
        </div>
        <div className="trace-arrow">to</div>
        <div className="trace-step">
          <span>3</span>
          <strong>Schema Forge</strong>
          <p>Approved decisions become specs, decisions.json entries, custom layouts, generated windows, and NeoHandler actions.</p>
        </div>
        <div className="trace-arrow">to</div>
        <div className="trace-step">
          <span>4</span>
          <strong>NEO app</strong>
          <p>Etendo Go serves the configured entities and actions through NEO Headless for the real React SPA.</p>
        </div>
      </section>

      <section className="explain-grid">
        <article className="mock-panel">
          <h3>How to use it</h3>
          <ul className="plain-list">
            <li>Open an area from the left menu.</li>
            <li>Select a source task in the document panel.</li>
            <li>Review the proposed app screen in the center.</li>
            <li>Use the right panel to decide Schema Forge impact and leave feedback.</li>
          </ul>
        </article>
        <article className="mock-panel">
          <h3>What it should answer</h3>
          <ul className="plain-list">
            <li>Which planning doc is the source of truth?</li>
            <li>What would the user see in the app?</li>
            <li>What must Schema Forge expose, generate, or customize?</li>
            <li>What feedback is needed before coding starts?</li>
          </ul>
        </article>
      </section>

      <section className="review-grid">
        {areas.map((area) => {
          const visible = visibleAreas.some((item) => item.id === area.id);
          return (
            <a key={area.id} className={visible ? 'area-card' : 'area-card locked'} href={visible ? area.route : '#/overview'}>
              <div className="card-title-row">
                <span className="badge">{area.priority}</span>
                <span className="subtle">{area.timing}</span>
              </div>
              <h3>{area.name}</h3>
              <p>{area.intent}</p>
              <span className="card-link">{visible ? 'Open review page' : `Visible from ${area.start}`}</span>
            </a>
          );
        })}
      </section>
    </div>
  );
}

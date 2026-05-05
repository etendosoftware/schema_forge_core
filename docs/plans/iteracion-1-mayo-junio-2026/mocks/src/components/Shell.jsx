import { areaIsVisible } from '../data/areas.js';
import logoUrl from '../assets/etendo-logo.svg';

export function Shell({ areas, stages, currentRoute, stage, onStageChange, visibleAreas, children }) {
  return (
    <div className="app-frame">
      <nav className="icon-rail" aria-label="Primary navigation">
        <a className="rail-logo" href="#/overview" aria-label="Etendo review home">
          <img src={logoUrl} alt="" />
        </a>
        <a className={currentRoute === 'overview' ? 'rail-item active' : 'rail-item'} href="#/overview" title="Home">
          <span>H</span>
        </a>
        <a className="rail-item" href="../README.md" title="Plan">
          <span>P</span>
        </a>
        <a className="rail-item" href="../gantt.md" title="Gantt">
          <span>G</span>
        </a>
        <span className="rail-separator" />
        <button className="rail-item" type="button" title="Help">
          <span>?</span>
        </button>
      </nav>

      <aside className="side-menu" aria-label="Mock navigation">
        <a className="brand" href="#/overview" aria-current={currentRoute === 'overview' ? 'page' : undefined}>
          <span>
            <strong>Schema Forge review</strong>
            <small>Iteration 1 planning tool</small>
          </span>
        </a>

        <nav className="menu-list" aria-label="Functional areas">
          <span className="menu-section">General</span>
          <a className={currentRoute === 'overview' ? 'menu-item active' : 'menu-item'} href="#/overview">
            <span className="menu-icon">OV</span>
            <span>Overview</span>
          </a>
          <span className="menu-section">Areas</span>
          {areas.map((area) => {
            const enabled = areaIsVisible(area, stage);
            return (
              <a
                key={area.id}
                className={[
                  'menu-item',
                  currentRoute === area.id ? 'active' : '',
                  enabled ? '' : 'disabled',
                ].join(' ')}
                href={enabled ? area.route : '#/overview'}
                aria-disabled={!enabled}
              >
                <span className="menu-icon">{area.priority}</span>
                <span>{area.name}</span>
              </a>
            );
          })}
        </nav>
      </aside>

      <div className="page-shell">
        <header className="top-bar">
          <div>
            <span className="breadcrumb">Iteration 1 / May-Jun 2026</span>
            <h1>Schema Forge review tool</h1>
          </div>
          <div className="top-actions">
            <a className="btn secondary" href="../README.md">Plan</a>
            <a className="btn secondary" href="../gantt.md">Gantt</a>
          </div>
        </header>

        <section className="stage-strip" aria-label="Iteration stage">
          <div>
            <span className="muted-label">Progressive stage</span>
            <strong>{visibleAreas.length} visible areas</strong>
          </div>
          <div className="stage-buttons">
            {stages.map((item) => (
              <button
                key={item.id}
                className={item.id === stage ? 'stage-button active' : 'stage-button'}
                type="button"
                onClick={() => onStageChange(item.id)}
              >
                <span>{item.label}</span>
                <small>{item.title}</small>
              </button>
            ))}
          </div>
        </section>

        <main className="content-card">{children}</main>
      </div>
    </div>
  );
}

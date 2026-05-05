import { useEffect, useMemo, useState } from 'react';
import { areas, stages, getArea, areaIsVisible } from '../data/areas.js';
import { Shell } from '../components/Shell.jsx';
import { AreaPage } from './AreaPage.jsx';
import { OverviewPage } from './OverviewPage.jsx';

function readRoute() {
  const value = window.location.hash.replace(/^#\/?/, '');
  return value || 'overview';
}

export function App() {
  const [route, setRoute] = useState(readRoute);
  const [stage, setStage] = useState('s1');

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const visibleAreas = useMemo(
    () => areas.filter((area) => areaIsVisible(area, stage)),
    [stage]
  );

  const page = route === 'overview'
    ? <OverviewPage stage={stage} visibleAreas={visibleAreas} />
    : <AreaPage area={getArea(route)} stage={stage} />;

  return (
    <Shell
      areas={areas}
      stages={stages}
      currentRoute={route}
      stage={stage}
      onStageChange={setStage}
      visibleAreas={visibleAreas}
    >
      {page}
    </Shell>
  );
}

import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import SideMenu from '@/components/layout/SideMenu';
import { SidebarProvider, useSidebar } from '@/components/layout/SidebarContext';
import { FavoritesProvider } from '@/components/layout/FavoritesContext';
import { PageMetaProvider, usePageMeta } from '@/components/layout/PageMetaContext';
import TopBar from '@/components/layout/TopBar';
import { CommandPalette } from '@/components/CommandPalette.jsx';
import { CopilotProvider } from '@/components/CopilotContext';
import { CopilotWidget } from '@/components/CopilotWidget';

const COLLAPSED_W = 60;
const EXPANDED_W = 240;

function AppLayoutInner({ menuGroups, embedded }) {
  const location = useLocation();
  const { expanded, toggle } = useSidebar();
  const meta = usePageMeta();
  const marginLeft = expanded ? EXPANDED_W : COLLAPSED_W;

  return (
    <>
      {!embedded && (
        <SideMenu
          menuGroups={menuGroups}
          expanded={expanded}
          onToggle={toggle}
        />
      )}
      <div
        className="flex h-screen flex-col overflow-hidden transition-[margin-left] duration-200 ease-in-out bg-page-bg"
        style={{ marginLeft: embedded ? 0 : marginLeft }}
      >
        {!embedded && (
          <TopBar
            title={meta?.title}
            breadcrumb={meta?.breadcrumb}
            recordCount={meta?.recordCount}
            menuAction={meta?.menuAction}
            onAddToFavorites={meta?.onAddToFavorites}
            isFavorite={meta?.isFavorite}
            onPageHelp={meta?.onPageHelp}
            onAIClick={meta?.onAIClick}
            rightExtras={meta?.rightExtras}
          />
        )}
        <div
          key={location.pathname}
          className="relative flex-1 flex flex-col overflow-hidden page-transition pr-3 pb-3"
        >
          <div className="flex-1 flex flex-col min-h-0 bg-white rounded-r-xl border-y border-r border-border/30 overflow-hidden">
            <Outlet />
          </div>
        </div>
      </div>
      {!embedded && <CommandPalette />}
      {!embedded && <CopilotWidget hideTrigger />}
    </>
  );
}

export default function AppLayout({ menuGroups }) {
  const [searchParams] = useSearchParams();
  const embedded = searchParams.get('embedded') === '1';

  return (
    <CopilotProvider>
      <FavoritesProvider>
        <SidebarProvider>
          <PageMetaProvider>
            <AppLayoutInner menuGroups={menuGroups} embedded={embedded} />
          </PageMetaProvider>
        </SidebarProvider>
      </FavoritesProvider>
    </CopilotProvider>
  );
}

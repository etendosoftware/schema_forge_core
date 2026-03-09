import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Folder, FlaskConical, ChevronRight, Loader2, AlertCircle, AppWindow, Cog } from 'lucide-react';
import { useSpecs, fetchMenuTree } from '@/explorer/useDiscovery.js';
import { useAuth } from '@/auth/AuthContext.jsx';

/**
 * Walk the menu tree and build a map: windowId/processId -> top-level folder name.
 */
function buildMenuIndex(tree) {
  const index = {};
  for (const topNode of tree) {
    const folderName = topNode.name;
    const queue = [topNode];
    while (queue.length > 0) {
      const node = queue.shift();
      if (node.type === 'window' && node.windowId) {
        index[`w:${node.windowId}`] = folderName;
      } else if (node.type === 'process' && node.processId) {
        index[`p:${node.processId}`] = folderName;
      }
      if (node.children) {
        for (const child of node.children) queue.push(child);
      }
    }
  }
  return index;
}

function SpecGroup({ label, icon: Icon, specs, isOpen, onToggle, onSelect }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/40 hover:text-white/60 transition-colors"
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1 text-left">{label}</span>
        <span className="text-[10px] font-normal text-white/30">{specs.length}</span>
        <ChevronRight className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-90')} />
      </button>
      {isOpen && (
        <div className="ml-4 space-y-0.5">
          {specs.map(spec => (
            <button
              key={spec.id}
              onClick={() => onSelect(spec.name)}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors text-white/60 hover:bg-white/10 hover:text-white text-left"
            >
              {spec.type === 'W' ? (
                <AppWindow className="h-3 w-3 text-blue-400/60 flex-shrink-0" />
              ) : (
                <Cog className="h-3 w-3 text-purple-400/60 flex-shrink-0" />
              )}
              <span className="truncate">{spec.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { isAuthenticated } = useAuth();
  const { specs, loading, error, refresh } = useSpecs();
  const navigate = useNavigate();
  const [openGroups, setOpenGroups] = useState({});
  const [menuIndex, setMenuIndex] = useState(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const menuCacheRef = useRef(null);

  // Load menu tree once and cache it
  useEffect(() => {
    if (!isAuthenticated || menuCacheRef.current) return;
    setMenuLoading(true);
    fetchMenuTree()
      .then(data => {
        const tree = data.tree || [];
        const index = buildMenuIndex(tree);
        menuCacheRef.current = index;
        setMenuIndex(index);
      })
      .catch(() => {
        // If menu tree fails, we just won't group by menu
        menuCacheRef.current = {};
        setMenuIndex({});
      })
      .finally(() => setMenuLoading(false));
  }, [isAuthenticated]);

  const toggle = (group) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const handleSelect = (specName) => {
    navigate(`/explorer?spec=${encodeURIComponent(specName)}`);
  };

  // Group specs by top-level menu folder
  const groups = (() => {
    if (!menuIndex || specs.length === 0) return {};
    const result = {};
    for (const spec of specs) {
      let folderName;
      if (spec.type === 'W' && spec.windowId) {
        folderName = menuIndex[`w:${spec.windowId}`];
      } else if (spec.type === 'P' && spec.processId) {
        folderName = menuIndex[`p:${spec.processId}`];
      }
      const group = folderName || 'Other';
      if (!result[group]) result[group] = [];
      result[group].push(spec);
    }
    return result;
  })();

  // Sort group names alphabetically, but "Other" always last
  const sortedGroupNames = Object.keys(groups).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });

  // Auto-open groups on first load
  useEffect(() => {
    if (sortedGroupNames.length > 0 && Object.keys(openGroups).length === 0) {
      const initial = {};
      for (const name of sortedGroupNames) initial[name] = true;
      setOpenGroups(initial);
    }
  }, [sortedGroupNames.length]);

  const isLoadingAll = loading || menuLoading;

  // Fallback: if menu index not loaded yet, group by type
  const useFallbackGroups = !menuIndex && !menuLoading && specs.length > 0;

  return (
    <aside className="w-60 flex flex-col" style={{ backgroundColor: 'hsl(var(--sidebar-bg))' }}>
      <div className="px-5 py-5 border-b border-white/10">
        <h1 className="text-lg font-bold tracking-tight text-white">Schema Forge</h1>
        <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--sidebar-text))' }}>NEO Headless</p>
      </div>
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {!isAuthenticated ? (
          <p className="px-3 py-2 text-xs text-white/30">Sign in to see specs</p>
        ) : isLoadingAll ? (
          <div className="flex items-center gap-2 px-3 py-4 text-white/40">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Loading specs...</span>
          </div>
        ) : error ? (
          <div className="px-3 py-2 space-y-2">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs">Failed to load</span>
            </div>
            <button
              onClick={refresh}
              className="text-xs text-white/40 hover:text-white/60 underline"
            >
              Retry
            </button>
          </div>
        ) : specs.length === 0 ? (
          <p className="px-3 py-2 text-xs text-white/30">
            No specs yet. Use the Explorer to add one.
          </p>
        ) : useFallbackGroups ? (
          // Fallback: group by type if menu tree unavailable
          <>
            {specs.filter(s => s.type === 'W').length > 0 && (
              <SpecGroup
                label="Windows"
                icon={AppWindow}
                specs={specs.filter(s => s.type === 'W')}
                isOpen={openGroups['Windows'] !== false}
                onToggle={() => toggle('Windows')}
                onSelect={handleSelect}
              />
            )}
            {specs.filter(s => s.type === 'P').length > 0 && (
              <SpecGroup
                label="Processes"
                icon={Cog}
                specs={specs.filter(s => s.type === 'P')}
                isOpen={openGroups['Processes'] !== false}
                onToggle={() => toggle('Processes')}
                onSelect={handleSelect}
              />
            )}
          </>
        ) : (
          // Menu-tree grouped specs
          sortedGroupNames.map(groupName => (
            <SpecGroup
              key={groupName}
              label={groupName}
              icon={groupName === 'Other' ? Cog : Folder}
              specs={groups[groupName]}
              isOpen={openGroups[groupName] !== false}
              onToggle={() => toggle(groupName)}
              onSelect={handleSelect}
            />
          ))
        )}
      </nav>
      <div className="border-t border-white/10 p-3 space-y-1">
        <NavLink
          to="/explorer"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              isActive
                ? 'bg-white/15 text-white'
                : 'text-white/40 hover:bg-white/10 hover:text-white/80'
            )
          }
        >
          <FlaskConical className="h-3.5 w-3.5" />
          API Explorer
        </NavLink>
      </div>
    </aside>
  );
}

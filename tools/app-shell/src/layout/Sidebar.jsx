import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext.jsx';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar.jsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible.jsx';
import {
  Eye,
  ChevronRight,
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Calculator,
  Package,
  Users,
  Settings,
  FolderKanban,
  Target,
  LogOut,
  FileJson,
} from 'lucide-react';
import { useMenuLabel } from '@/i18n';

const ICON_MAP = {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Calculator,
  Package,
  Users,
  Settings,
  FolderKanban,
  Target,
  Eye,
  FileJson,
};

/**
 * Determines which menu group is active based on current route.
 */
export function findActiveGroup(menuGroups, pathname) {
  const currentPath = pathname.replace(/^\//, '');
  return menuGroups.find((g) =>
    g.items.some((item) => item.name === currentPath)
  ) || null;
}

function NavMenuGroup({ group, icon, items, isActive, tMenu }) {
  const Icon = ICON_MAP[icon] || Package;

  return (
    <Collapsible asChild defaultOpen={isActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={tMenu(group)}>
            <Icon className="h-4 w-4" />
            <span>{tMenu(group)}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) => (
              <SidebarMenuSubItem key={item.name}>
                <SidebarMenuSubButton asChild>
                  <NavLink
                    to={`/${item.name}`}
                    className={({ isActive: active }) => (active ? 'font-medium' : '')}
                  >
                    {tMenu(item.label)}
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export default function AppSidebar({ menuGroups }) {
  const { username, logout } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname.replace(/^\//, '');
  const tMenu = useMenuLabel();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <img
            src="/favicon.png"
            alt="Etendo"
            className="h-7 w-7 shrink-0 rounded-md"
          />
          <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sm">Schema Forge</span>
            <span className="text-xs text-sidebar-foreground/60">ERP Generator</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {menuGroups.map((g) => (
            <NavMenuGroup
              key={g.group}
              group={g.group}
              icon={g.icon}
              items={g.items}
              isActive={g.items.some((item) => item.name === currentPath)}
              tMenu={tMenu}
            />
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Artifacts">
              <NavLink to="/artifacts">
                <FileJson className="h-4 w-4" />
                <span>Artifacts</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={username}>
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-sidebar-primary-foreground">
                <span className="text-[10px] font-semibold">{username?.charAt(0).toUpperCase()}</span>
              </div>
              <span className="truncate">{username}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Logout" onClick={logout}>
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

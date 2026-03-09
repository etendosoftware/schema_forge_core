import { NavLink } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext.jsx';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
  ShoppingCart,
  Truck,
  Package,
  Database,
  DollarSign,
  Settings,
  LogOut,
} from 'lucide-react';

const ICON_MAP = {
  ShoppingCart,
  Truck,
  Package,
  Database,
  DollarSign,
  Settings,
};

function NavMenuGroup({ group, icon, items }) {
  const Icon = ICON_MAP[icon] || Database;

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup className="p-0">
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="flex w-full items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="flex-1 text-left">{group}</span>
            <ChevronRight className="h-3 w-3 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild tooltip={item.label}>
                    <NavLink
                      to={`/${item.name}`}
                      className={({ isActive }) => (isActive ? 'font-medium' : '')}
                    >
                      {({ isActive }) => (
                        <span data-active={isActive || undefined}>{item.label}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export default function AppSidebar({ menuGroups }) {
  const { username, logout } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Package className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sm">Schema Forge</span>
            <span className="text-xs text-sidebar-foreground/60">ERP Generator</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {menuGroups.map((g) => (
          <NavMenuGroup
            key={g.group}
            group={g.group}
            icon={g.icon}
            items={g.items}
          />
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Preview">
              <NavLink to="/preview">
                <Eye className="h-4 w-4" />
                <span>Preview</span>
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

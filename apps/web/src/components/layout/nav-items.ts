import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Book,
  LayoutDashboard,
  ListChecks,
  Settings,
  Settings2,
  Timer,
  UserRound,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  items?: NavItem[];
}

export const SETTINGS_NAV_ITEMS: NavItem[] = [
  {
    href: "/settings/sla/configuration",
    label: "SLA",
    icon: Timer,
    description: "Configure SLA policies, targets, and escalation timers.",
  },
  {
    href: "/settings/integrations",
    label: "Integrations",
    icon: Settings2,
    description: "Connect and manage third-party services like Zendesk.",
  },
  {
    href: "/settings/notifications",
    label: "Notifications",
    icon: Bell,
    description: "Configure how and when you're notified of SLA events.",
  },
  {
    href: "/settings/monitoring",
    label: "Monitoring",
    icon: Activity,
    description: "Monitor worker health and adjust polling intervals.",
  },
  {
    href: "/settings/profile",
    label: "Profile",
    icon: UserRound,
    description: "Manage your personal profile and appearance preferences.",
  },
];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cases", label: "All cases", icon: ListChecks },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    items: SETTINGS_NAV_ITEMS,
  },

  { href: "/docs", label: "Documentation", icon: Book },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function hasActiveDescendant(pathname: string, item: NavItem): boolean {
  return !!item.items?.some((child) => isNavItemActive(pathname, child.href));
}

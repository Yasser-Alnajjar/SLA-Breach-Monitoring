import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, ListChecks, Settings2, Timer } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cases", label: "All cases", icon: ListChecks },
  { href: "/settings/sla/configuration", label: "SLA", icon: Timer },
  { href: "/settings/integrations", label: "Integrations", icon: Settings2 },
];

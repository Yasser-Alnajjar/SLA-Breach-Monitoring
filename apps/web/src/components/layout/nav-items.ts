import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Settings2 } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings/integrations", label: "Integrations", icon: Settings2 },
];

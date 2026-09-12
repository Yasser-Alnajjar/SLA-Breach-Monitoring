import type { LucideIcon } from "lucide-react";
import {
  BookText,
  LayoutDashboard,
  ListChecks,
  Settings2,
  Timer,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cases", label: "All cases", icon: ListChecks },
  { href: "/settings/sla/configuration", label: "SLA", icon: Timer },
  { href: "/settings/integrations", label: "Integrations", icon: Settings2 },
  { href: "/docs", label: "Documentation", icon: BookText },
];
const ALL_NAV_HREFS = NAV_ITEMS.map((item) => item.href);

export function isActivePath(pathname: string, href: string): boolean {
  const domain = `/${href.split("/")[1]}`;
  const inDomain = pathname === domain || pathname.startsWith(`${domain}/`);
  if (!inDomain) return false;

  const siblings = ALL_NAV_HREFS.filter((h) => h.startsWith(`${domain}/`));
  if (siblings.length <= 1) return true;

  const pathSecondSegment = pathname.split("/")[2];
  const matchesASibling = siblings.some(
    (sibling) => sibling.split("/")[2] === pathSecondSegment,
  );

  if (!matchesASibling) {
    return href === siblings[0];
  }

  return href.split("/")[2] === pathSecondSegment;
}

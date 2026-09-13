"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  CircleHelp,
  CirclePlay,
  FileText,
  GitBranch,
  GitPullRequest,
  LayoutDashboard,
  LifeBuoy,
  Settings2,
  ShieldAlert,
  Ticket,
  Workflow,
  Wrench,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandMark } from "../shared/brand-mark";
import type { LucideIcon } from "lucide-react";

type DocsItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

type DocsSection = {
  title: string;
  items: DocsItem[];
};

const sections: DocsSection[] = [
  {
    title: "Overview",
    items: [
      {
        title: "Getting Started",
        href: "/docs/getting-started",
        icon: CirclePlay,
      },
      {
        title: "How It Works",
        href: "/docs/how-it-works",
        icon: GitBranch,
      },
    ],
  },
  {
    title: "Product",
    items: [
      {
        title: "Cases",
        href: "/docs/cases",
        icon: Ticket,
      },
      {
        title: "SLA & Targets",
        href: "/docs/sla",
        icon: ShieldAlert,
      },
      {
        title: "Dashboard",
        href: "/docs/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Notifications",
        href: "/docs/notifications",
        icon: Bell,
      },
    ],
  },
  {
    title: "Integrations",
    items: [
      {
        title: "Zendesk",
        href: "/docs/integrations/zendesk",
        icon: FileText,
      },
      {
        title: "Jira",
        href: "/docs/integrations/jira",
        icon: FileText,
      },
      {
        title: "Slack",
        href: "/docs/integrations/slack",
        icon: FileText,
      },
      {
        title: "Linear",
        href: "/docs/integrations/linear",
        icon: Workflow,
      },
      {
        title: "Intercom",
        href: "/docs/integrations/intercom",
        icon: LifeBuoy,
      },
      {
        title: "GitHub",
        href: "/docs/integrations/github",
        icon: GitPullRequest,
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        title: "Configuration",
        href: "/docs/configuration",
        icon: Settings2,
      },
      {
        title: "Troubleshooting",
        href: "/docs/troubleshooting",
        icon: Wrench,
      },
      {
        title: "FAQ",
        href: "/docs/faq",
        icon: CircleHelp,
      },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/docs/getting-started" aria-label="Documentation">
          <BrandMark />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                      >
                        <Link href={item.href}>
                          <Icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <div className="border-t p-2">
        <div className="flex items-center justify-end">
          <ThemeToggle />
        </div>
      </div>

      <SidebarRail />
    </Sidebar>
  );
}

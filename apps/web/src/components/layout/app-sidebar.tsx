"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

import { BrandMark } from "../shared/brand-mark";
import { isNavItemActive, NAV_ITEMS, type NavItem } from "./nav-items";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar side="left" collapsible="icon">
      <SidebarHeader>
        <Link href="/dashboard" aria-label="dashboard">
          <BrandMark logoClassName="size-8" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                if (item.items?.length) {
                  return (
                    <NavGroupItem
                      key={item.href}
                      item={item as NavItem & { items: NavItem[] }}
                      pathname={pathname}
                    />
                  );
                }

                const active = isNavItemActive(pathname, item.href);
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}

function NavGroupItem({
  item,
  pathname,
}: {
  item: NavItem & { items: NavItem[] };
  pathname: string;
}) {
  const { state } = useSidebar();

  const isCollapsed = state === "collapsed";
  const isGroupRouteActive = isNavItemActive(pathname, item.href);
  const [open, setOpen] = useState(isGroupRouteActive);

  const Icon = item.icon;

  useEffect(() => {
    if (isGroupRouteActive) {
      setOpen(true);
    }
  }, [isGroupRouteActive]);

  if (isCollapsed) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              isActive={isGroupRouteActive}
              tooltip={item.label}
            >
              <Icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side="right"
            align="start"
            sideOffset={8}
            className="min-w-48"
          >
            {item.items.map((child) => {
              const ChildIcon = child.icon;
              const childActive = isNavItemActive(pathname, child.href);

              return (
                <DropdownMenuItem
                  key={child.href}
                  asChild
                  data-active={childActive}
                >
                  <Link href={child.href}>
                    <ChildIcon />
                    <span>{child.label}</span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={pathname === item.href}
            tooltip={item.label}
            className="cursor-pointer"
          >
            <Icon />
            <span>{item.label}</span>

            <SidebarMenuAction asChild>
              <span>
                <ChevronDown className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                <span className="sr-only">Toggle {item.label}</span>
              </span>
            </SidebarMenuAction>
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items.map((child) => {
              const ChildIcon = child.icon;
              const childActive = isNavItemActive(pathname, child.href);

              return (
                <SidebarMenuSubItem key={child.href}>
                  <SidebarMenuSubButton asChild isActive={childActive}>
                    <Link href={child.href}>
                      <ChildIcon />
                      <span>{child.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

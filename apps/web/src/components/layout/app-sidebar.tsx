"use client";

import { IUser } from "@/lib/types/user";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { isActivePath, NAV_ITEMS } from "./nav-items";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import { signOut } from "next-auth/react";
import { BrandMark } from "../shared/brand-mark";

function initialsOf(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    const initials = parts
      .slice(0, 2)
      .map((part) => part[0])
      .join("");
    if (initials) return initials.toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

interface AppSidebarProps {
  user: IUser;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const initials = initialsOf(user.name, user.email);
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const displayName = user.name || user.email?.split("@")[0] || "User";

  return (
    <Sidebar side={"left"} collapsible="icon">
      <SidebarHeader>
        <Link href="/dashboard" aria-label="dashboard">
          <BrandMark />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = isActivePath(pathname, item.href);
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

      <SidebarFooter>
        <SidebarSeparator />

        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar size="default">
                    <AvatarImage src={user.image ?? undefined} alt="" />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>

                  <div className="grid flex-1 text-start text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {user.email}
                    </span>
                  </div>

                  <Settings className="ms-auto size-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                side={isMobile ? "bottom" : "top"}
                align="end"
                sideOffset={8}
                className="w-56"
              >
                {/* User */}
                <div className="flex items-center gap-2 px-2 py-2">
                  <Avatar size="default">
                    <AvatarImage src={user.image ?? undefined} alt="" />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {displayName}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {user.email}
                    </p>
                  </div>
                </div>

                <DropdownMenuSeparator />

                {/* Theme */}
                <div className="flex items-center justify-between gap-3 px-2 py-1.5">
                  <span className="text-sm">Theme</span>
                  <ThemeToggle />
                </div>

                <DropdownMenuSeparator />

                {/* Logout */}
                <DropdownMenuItem
                  onSelect={() => signOut({ callbackUrl: "/sign-in" })}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarRail />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

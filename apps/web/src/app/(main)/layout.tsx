import type { Metadata } from "next";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Actions } from "@/actions";
import { SlaAutoRefreshProvider } from "@/components/shared/SlaAutoRefreshProvider";
import { UserMenu } from "@/components/layout/user-menu";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AppLayout({ children }: AppLayoutProps) {
  // Read fresh from the database rather than the JWT session: name and
  // avatar are user-editable from the Profile page (@modules/settings/profile)
  // and must show up here immediately via `router.refresh()`, not just after
  // the next sign-in.
  const user = await Actions.Profile.getData();
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="border-border bg-background/80 sticky top-0 z-40 flex h-16 items-center gap-2 border-b px-4 backdrop-blur-md">
          <SidebarTrigger />
          <div className="flex-1" />
          <UserMenu user={user} />
        </header>
        <main className="mx-auto min-w-0 w-full flex-1 px-4 py-4">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

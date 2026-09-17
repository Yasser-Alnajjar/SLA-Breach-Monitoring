import type { Metadata } from "next";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Actions } from "@/actions";
import { SlaAutoRefreshProvider } from "@/components/shared/SlaAutoRefreshProvider";

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
  const session = await getServerSession(authOptions);
  return (
    <SidebarProvider>
      <AppSidebar user={session?.user!} />
      <SidebarInset>
        <header className="border-border bg-background/80 sticky top-0 z-40 flex h-16 items-center gap-2 border-b px-4 backdrop-blur-md">
          <SidebarTrigger />
          <div className="flex-1" />

          <Button asChild size="sm" variant="secondary">
            <Link href="/docs">Documentation</Link>
          </Button>
        </header>
        <main className="mx-auto min-w-0 w-full max-w-7xl flex-1 px-4 py-4">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

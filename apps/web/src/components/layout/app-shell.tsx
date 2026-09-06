import { getServerSession } from "next-auth";
import type { ReactNode } from "react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { BrandMark } from "@/components/shared/brand-mark";
import { authOptions } from "@/lib/auth";

export async function AppShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-card/60 px-4 py-5 lg:flex">
        <div className="mb-8 px-1">
          <BrandMark />
        </div>
        <SidebarNav />
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
          <MobileNav />
          <h1 className="font-display text-lg font-medium tracking-tight">{title}</h1>
          <div className="ml-auto flex items-center gap-3">
            {actions}
            <UserMenu email={session?.user?.email} />
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

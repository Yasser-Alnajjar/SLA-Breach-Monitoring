import type { ReactNode } from "react";
import { BrandMark } from "@/components/shared/brand-mark";

export function OnboardingShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-10 sm:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grain"
      />
      <div className="relative mx-auto flex max-w-xl flex-col gap-8">
        <header className="flex items-center justify-between">
          <BrandMark logoClassName="size-12" />
          <a
            href="/dashboard"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip to dashboard
          </a>
        </header>
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-medium tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {children}
      </div>
    </main>
  );
}

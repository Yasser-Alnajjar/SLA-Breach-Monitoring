import { BrandMark } from "@/components/shared/brand-mark";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors `OnboardingShell` with a placeholder title, since it covers both onboarding and findings. */
export default function OnboardingLoading() {
  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-10 sm:py-14">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grain" />
      <div className="relative mx-auto flex max-w-xl flex-col gap-8">
        <header className="flex items-center justify-between">
          <BrandMark />
        </header>
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </main>
  );
}

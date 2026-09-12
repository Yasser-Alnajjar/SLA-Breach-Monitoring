import type { ReactNode } from "react";

/** Quiet, borderless label marking a top-level page section (e.g. "SLA Analytics"). */
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

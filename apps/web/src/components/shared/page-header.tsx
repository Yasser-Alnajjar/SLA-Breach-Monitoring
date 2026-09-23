import type { ReactNode } from "react";

/**
 * Top-of-page eyebrow + title, reused across route pages. `actions` is for
 * controls that already exist for that page (e.g. an existing export
 * button) — this component itself adds no new affordances.
 */
export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

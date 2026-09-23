import type { ReactNode } from "react";

/** Eyebrow + headline used at the top of each settings section. */
export function SettingsSectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
      <div>
        <span className="text-outline font-mono text-xxs font-semibold uppercase tracking-wider">
          {eyebrow}
        </span>
        <h2 className="text-on-surface font-display mt-1 text-xl font-medium tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-on-surface-variant mt-1 max-w-3xl text-sm">
            {description}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
}

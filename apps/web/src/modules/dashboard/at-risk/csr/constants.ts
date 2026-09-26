import type { LegFilter, SeverityFilter } from "./types";

type FilterOption<T extends string> = {
  value: T;
  label: string;
  tone: string;
  dot: string;
  badge: string;
};

export const AT_RISK_SEVERITY_FILTERS: FilterOption<SeverityFilter>[] = [
  {
    value: "all",
    label: "All",
    tone: "",
    dot: "",
    badge: "",
  },
  {
    value: "P1",
    label: "P1 Critical",
    tone: "text-error",
    dot: "bg-error",
    badge: "bg-error/10 text-error",
  },
  {
    value: "P2",
    label: "P2 High",
    tone: "text-warning",
    dot: "bg-warning",
    badge: "bg-warning/10 text-warning",
  },
  {
    value: "P3",
    label: "P3 Normal",
    tone: "text-on-surface-variant",
    dot: "bg-on-surface-variant",
    badge: "bg-surface-container-lowest text-on-surface-variant",
  },
  {
    value: "P4",
    label: "P4 Low",
    tone: "text-outline",
    dot: "bg-outline",
    badge: "bg-surface-container-lowest text-outline",
  },
];

export const AT_RISK_LEG_FILTERS: FilterOption<LegFilter>[] = [
  {
    value: "all",
    label: "All",
    tone: "",
    dot: "",
    badge: "",
  },
  {
    value: "engineering",
    label: "Engineering Leg",
    tone: "text-primary",
    dot: "bg-primary",
    badge: "bg-surface-container-lowest text-primary",
  },
  {
    value: "support",
    label: "Support Leg",
    tone: "text-tertiary",
    dot: "bg-tertiary",
    badge: "bg-surface-container-lowest text-tertiary",
  },
];

export const GROUP_LABEL =
  "px-2 font-mono text-xxs font-semibold tracking-wider text-outline sm:inline";

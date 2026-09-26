export type StatusFilter = "all" | "breached" | "at_risk" | "on_track" | "met";

export type OpenFilter = "all" | "open" | "closed";

export type LinkFilter = "all" | "linked" | "unlinked";

export type SeverityFilter = "all" | "P1" | "P2" | "P3" | "P4";

type FilterOption<T extends string> = {
  value: T;
  label: string;
  tone: string;
  dot: string;
  badge: string;
};

export const STATUS_FILTERS: FilterOption<StatusFilter>[] = [
  {
    value: "all",
    label: "All Cases",
    tone: "",
    dot: "",
    badge: "",
  },
  {
    value: "at_risk",
    label: "At Risk",
    tone: "text-warning",
    dot: "bg-warning animate-pulse",
    badge: "bg-warning-container text-warning",
  },
  {
    value: "breached",
    label: "Breached",
    tone: "text-error",
    dot: "bg-error",
    badge: "bg-surface-container-low text-error",
  },
  {
    value: "on_track",
    label: "On Track",
    tone: "text-primary",
    dot: "bg-primary",
    badge: "bg-surface-container-lowest text-primary",
  },
  {
    value: "met",
    label: "Met",
    tone: "text-tertiary",
    dot: "bg-tertiary",
    badge: "bg-surface-container-lowest text-tertiary",
  },
];

export const OPEN_FILTERS: FilterOption<OpenFilter>[] = [
  {
    value: "all",
    label: "All",
    tone: "",
    dot: "",
    badge: "",
  },
  {
    value: "open",
    label: "Open",
    tone: "text-primary",
    dot: "bg-primary",
    badge: "bg-surface-container-lowest text-primary",
  },
  {
    value: "closed",
    label: "Closed",
    tone: "text-tertiary",
    dot: "bg-tertiary",
    badge: "bg-surface-container-lowest text-tertiary",
  },
];

export const LINK_FILTERS: FilterOption<LinkFilter>[] = [
  {
    value: "all",
    label: "All",
    tone: "",
    dot: "",
    badge: "",
  },
  {
    value: "linked",
    label: "Linked",
    tone: "text-tertiary",
    dot: "bg-tertiary",
    badge: "bg-surface-container-lowest text-tertiary",
  },
  {
    value: "unlinked",
    label: "Unlinked",
    tone: "text-on-surface-variant",
    dot: "bg-outline",
    badge: "bg-surface-container-lowest text-on-surface-variant",
  },
];

export const SEVERITY_FILTERS: FilterOption<SeverityFilter>[] = [
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

export const GROUP_LABEL =
  "px-2 font-mono text-xxs font-semibold tracking-wider text-outline sm:inline";

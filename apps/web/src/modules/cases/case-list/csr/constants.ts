export type StatusFilter = "all" | "breached" | "at_risk" | "on_track" | "met";

export type OpenFilter = "all" | "open" | "closed";

export type LinkFilter = "all" | "linked" | "unlinked";

export type SeverityFilter = "all" | "P1" | "P2" | "P3" | "P4";

export const STATUS_FILTERS: {
  value: StatusFilter;
  label: string;
  tone: string;
  dot: string;
  badge: string;
}[] = [
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
    tone: "text-error",
    dot: "bg-error animate-pulse",
    badge: "bg-error-container text-error",
  },
  {
    value: "breached",
    label: "Breached",
    tone: "text-error",
    dot: "bg-error",
    badge: "bg-surface-container-lowest text-error",
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

export const OPEN_FILTERS: {
  value: OpenFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

export const LINK_FILTERS: {
  value: LinkFilter;
  label: string;
  tone: string;
}[] = [
  {
    value: "all",
    label: "All",
    tone: "text-on-surface",
  },
  {
    value: "linked",
    label: "Linked",
    tone: "text-tertiary",
  },
  {
    value: "unlinked",
    label: "Unlinked",
    tone: "text-on-surface-variant",
  },
];

export const SEVERITY_FILTERS: {
  value: SeverityFilter;
  label: string;
  tone: string;
}[] = [
  {
    value: "all",
    label: "All",
    tone: "text-primary",
  },
  {
    value: "P1",
    label: "P1 Critical",
    tone: "text-error",
  },
  {
    value: "P2",
    label: "P2 High",
    tone: "text-primary-fixed-dim",
  },
  {
    value: "P3",
    label: "P3 Normal",
    tone: "text-on-surface-variant",
  },
  {
    value: "P4",
    label: "P4 Low",
    tone: "text-outline",
  },
];
export const GROUP_LABEL =
  "px-2 font-mono text-xxs font-semibold tracking-wider text-outline sm:inline";

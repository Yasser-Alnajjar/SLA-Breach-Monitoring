export const STATUS_BORDER_CLASS: Record<string, string> = {
  on_track: "border-l-muted-foreground/50",
  at_risk: "border-l-warning",
  met: "border-l-success",
  breached: "border-l-destructive",
  cancelled: "border-l-muted-foreground/20",
};

export const LEG_BG_CLASS: Record<string, string> = {
  support: "bg-leg-support",
  engineering: "bg-leg-engineering",
  waiting_customer: "bg-leg-waiting",
  unknown: "bg-leg-unknown",
};

/** Badge variant per NormalizedState — one consistent color per state everywhere it's shown (timeline, glossary). */
export const NORMALIZED_STATE_VARIANT: Record<
  string,
  "default" | "primary" | "secondary" | "warning" | "success" | "destructive" | "outline"
> = {
  new: "default",
  open: "primary",
  in_progress: "primary",
  pending_customer: "warning",
  pending_internal: "secondary",
  escalated: "destructive",
  resolved: "success",
  closed: "outline",
};

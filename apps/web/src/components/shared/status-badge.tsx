import { Badge, type BadgeProps } from "@/components/ui/badge";
import { formatCommitmentStatus } from "@/lib/format";

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  on_track: "default",
  at_risk: "warning",
  met: "success",
  breached: "destructive",
  cancelled: "outline",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={STATUS_VARIANT[status] ?? "default"}
      className="text-nowrap"
    >
      {formatCommitmentStatus(status)}
    </Badge>
  );
}

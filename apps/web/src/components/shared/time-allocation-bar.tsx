import { formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Stitch's "Time Allocation" widget (`at_risk_queue/code.html`): how much of
 * the commitment's target has been consumed so far, and how that consumed
 * time splits between the support and engineering legs. Two genuinely
 * different figures sharing one caption line — `elapsedMinutes` positions
 * the bar against `targetMinutes`, while `supportLegMinutes`/
 * `engineeringLegMinutes` (cumulative wall-clock leg time, from
 * `sumLegMinutes`) split the filled portion by leg. Never fabricates a
 * number neither source provides.
 */
export function TimeAllocationBar({
  targetMinutes,
  elapsedMinutes,
  remainingMinutes,
  supportLegMinutes,
  engineeringLegMinutes,
}: {
  targetMinutes: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  supportLegMinutes: number;
  engineeringLegMinutes: number;
}) {
  const percentExpended =
    targetMinutes > 0 ? Math.min(100, (elapsedMinutes / targetMinutes) * 100) : 0;

  const legTotal = supportLegMinutes + engineeringLegMinutes;
  const supportShare = legTotal > 0 ? (supportLegMinutes / legTotal) * 100 : 0;
  const engineeringShare = legTotal > 0 ? (engineeringLegMinutes / legTotal) * 100 : 0;

  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">
        Time allocation:{" "}
        <span className="font-mono tabular-nums text-foreground">
          {formatMinutes(elapsedMinutes)}
        </span>{" "}
        of{" "}
        <span className="font-mono tabular-nums text-foreground">
          {formatMinutes(targetMinutes)}
        </span>{" "}
        target ({percentExpended.toFixed(1)}% expended)
      </p>

      <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-interactive">
        <div
          className="h-full bg-leg-support"
          style={{ width: `${(percentExpended * supportShare) / 100}%` }}
        />
        <div
          className="h-full bg-leg-engineering"
          style={{ width: `${(percentExpended * engineeringShare) / 100}%` }}
        />
      </div>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xxs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className={cn("size-1.5 rounded-full bg-leg-support")} />
          Support: <span className="font-mono tabular-nums">{formatMinutes(supportLegMinutes)}</span>{" "}
          ({supportShare.toFixed(0)}%)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className={cn("size-1.5 rounded-full bg-leg-engineering")} />
          Eng: <span className="font-mono tabular-nums">{formatMinutes(engineeringLegMinutes)}</span>{" "}
          ({engineeringShare.toFixed(0)}%)
        </span>
        <span>
          Runway: <span className="font-mono tabular-nums">{formatMinutes(remainingMinutes)}</span>
        </span>
      </p>
    </div>
  );
}

import { CircuitBoard } from "lucide-react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCaseLinkMethod, formatMinutes } from "@/lib/format";
import type { AgingEscalationRow } from "@/lib/types/dashboard";

/**
 * The Stitch dashboard's "Aging in Engineering Queue" card list — an icon
 * tile, dual-ticket identity, link-confidence badge, and elapsed duration
 * per case. Jira-side queue/assignee data is a genuine backend gap (no such
 * field exists anywhere in the schema — see the reconstruction audit), so
 * that line renders an explicit "not tracked yet" state rather than a
 * fabricated name. "Ping Team" is a real write-back action this app doesn't
 * implement yet, so the button stays visible but disabled.
 */
export function AgingQueueList({ rows }: { rows: AgingEscalationRow[] }) {
  return (
    <div className="divide-y divide-surface-container-highest/30">
      {rows.map((row) => {
        const overTarget = row.legTarget?.status === "breached";
        return (
          <div
            key={row.caseId}
            className="hover:bg-surface-container/50 flex flex-col gap-3 p-4 transition-colors md:flex-row md:items-center md:justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="bg-surface-container mt-0.5 flex size-9 shrink-0 items-center justify-center rounded">
                <CircuitBoard className="text-outline size-4.5" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/cases/${row.caseId}`}
                    className="text-on-surface hover:text-primary font-mono text-sm font-semibold"
                  >
                    #{row.externalId}
                  </Link>
                  {row.linkedIssue ? (
                    <>
                      <span className="text-outline">↔</span>
                      <span className="text-primary font-mono text-sm">
                        {row.linkedIssue.externalId}
                      </span>
                      <span
                        className="bg-tertiary/10 text-tertiary rounded px-2 py-0.5 font-mono text-xxs"
                        title={formatCaseLinkMethod(row.linkedIssue.method)}
                      >
                        Linked — {row.linkedIssue.confidence === "certain" ? "Certain" : "Probable"}
                      </span>
                    </>
                  ) : (
                    <span className="bg-surface-container-highest text-outline rounded px-2 py-0.5 font-mono text-xxs">
                      No engineering link yet
                    </span>
                  )}
                </div>
                <div className="text-outline flex items-center gap-2 text-sm">
                  <span>
                    Queue:{" "}
                    <span className="text-outline italic">not tracked yet</span>
                  </span>
                  <span className="text-outline-variant">•</span>
                  <span>
                    Assignee:{" "}
                    <span className="text-outline italic">
                      not tracked yet
                    </span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 pl-12 md:justify-end md:pl-0">
              <div className="flex flex-col md:items-end">
                <span className="text-outline font-mono text-xxs font-semibold uppercase tracking-wider">
                  Eng leg elapsed
                </span>
                <span
                  className={`font-mono text-sm font-semibold ${overTarget ? "text-error" : "text-on-surface"}`}
                >
                  {formatMinutes(row.minutesInCurrentLeg)}
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled
                    className="bg-surface-container text-on-surface cursor-not-allowed rounded px-3 py-1.5 text-xs opacity-60"
                  >
                    Ping team
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  Slack/Jira write-back isn&apos;t implemented yet.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );
}

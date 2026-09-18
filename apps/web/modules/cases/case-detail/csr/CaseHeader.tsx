"use client";

import { ExternalLink } from "lucide-react";

import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatLeg, formatTicketSource } from "@/lib/format";
import { Priority, PRIORITY_VARIANT } from "@/lib/status-styles";
import type { CaseDetailData } from "@/lib/types/cases";

/**
 * Customer (account/company) and Requester (the individual who submitted
 * the ticket) are distinct concepts and must never be merged: a requester is
 * never shown as if it were the customer. When there's no customer, the
 * requester is labeled explicitly rather than filling the customer's slot
 * unlabeled — that would read as "this is the customer."
 */
export function formatCaseIdentity(
  customerName: string | null,
  requesterName: string | null,
): string {
  if (customerName && requesterName)
    return `${customerName} · Requester: ${requesterName}`;
  if (customerName) return customerName;
  if (requesterName) return `Requester: ${requesterName}`;
  return "—";
}

export function CaseHeader({ data }: { data: CaseDetailData }) {
  const { case: caseData, currentLeg } = data;
  const identity = formatCaseIdentity(
    caseData.customerName,
    caseData.requesterName,
  );

  return (
    <Reveal delay={0.05} className="mt-5">
      <div className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className="min-w-0 max-w-3xl font-display text-2xl font-medium tracking-tight"
              title={caseData.subject ?? `#${caseData.externalId}`}
            >
              {caseData.subject ?? `${identity} · #${caseData.externalId}`}
            </h1>

            <Badge variant="outline" className="shrink-0">
              {formatLeg(currentLeg)}
            </Badge>
          </div>

          {caseData.subject && (
            <p className="mt-1 text-sm text-muted-foreground">
              {identity} · #{caseData.externalId}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {caseData.priority && (
              <Badge variant={PRIORITY_VARIANT[caseData.priority as Priority]}>
                {caseData.priority}
              </Badge>
            )}

            {caseData.tier && <Badge variant="default">{caseData.tier}</Badge>}

            {caseData.channel && (
              <Badge variant="default">{caseData.channel}</Badge>
            )}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Opened {formatDateTime(caseData.openedAt)}
            {caseData.closedAt
              ? ` · Resolved ${formatDateTime(caseData.closedAt)}`
              : ` · Currently in ${formatLeg(currentLeg)}`}
          </p>
        </div>

        {caseData.ticketUrl && (
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <a href={caseData.ticketUrl} target="_blank" rel="noreferrer">
              Open in {formatTicketSource(caseData.system)}
              <ExternalLink />
            </a>
          </Button>
        )}
      </div>
    </Reveal>
  );
}

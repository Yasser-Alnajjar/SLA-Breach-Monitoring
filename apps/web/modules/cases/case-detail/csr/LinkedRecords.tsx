"use client";

import { ExternalLink } from "lucide-react";

import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCaseLinkMethod, formatTicketSource } from "@/lib/format";
import type { CaseDetailData } from "@/lib/types/cases";

export function LinkedRecords({ data }: { data: CaseDetailData }) {
  return (
    <Reveal delay={0.05}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked records</CardTitle>
        </CardHeader>

        <CardContent className="max-h-128 overflow-y-auto">
          <ul className="space-y-3">
            {data.case.ticketUrl && (
              <li>
                <a
                  href={data.case.ticketUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between gap-3 rounded-md border border-border p-2.5 transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">
                      {formatTicketSource(data.case.system)}
                    </span>
                    <span className="block truncate text-sm font-medium">
                      #{data.case.externalId}
                    </span>
                  </span>

                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </a>
              </li>
            )}

            {data.links.map((link, index) => {
              const provider =
                link.system === "jira"
                  ? "Jira"
                  : link.system === "linear"
                    ? "Linear"
                    : link.system === "github"
                      ? "GitHub"
                      : "Zendesk";

              return (
                <li key={`${link.system}-${link.externalId}-${index}`}>
                  {link.url ? (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group block rounded-md border border-border p-2.5 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="block text-xs text-muted-foreground">
                            {provider}
                          </span>

                          <span className="block truncate text-sm font-medium">
                            {link.externalId}
                          </span>
                        </div>

                        <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {formatCaseLinkMethod(link.method)}
                        </Badge>

                        <Badge variant="outline" className="text-[10px]">
                          {link.confidence}
                        </Badge>

                        {link.statusName && (
                          <Badge variant="outline" className="text-[10px]">
                            {link.statusName}
                          </Badge>
                        )}
                      </div>
                    </a>
                  ) : (
                    <div className="rounded-md border border-border p-2.5">
                      <span className="block text-xs text-muted-foreground">
                        {provider}
                      </span>

                      <span className="block truncate text-sm font-medium">
                        {link.externalId}
                      </span>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {formatCaseLinkMethod(link.method)}
                        </Badge>

                        <Badge variant="outline" className="text-[10px]">
                          {link.confidence}
                        </Badge>

                        {link.statusName && (
                          <Badge variant="secondary" className="text-[10px]">
                            {link.statusName}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}

            {!data.case.ticketUrl && data.links.length === 0 && (
              <li className="py-4 text-center text-sm text-muted-foreground">
                No linked records.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </Reveal>
  );
}

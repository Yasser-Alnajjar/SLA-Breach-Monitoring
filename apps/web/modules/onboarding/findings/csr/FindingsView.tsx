"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { OnboardingShell } from "@/components/shared/onboarding-shell";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMinutes } from "@/lib/format";
import type { FindingsData } from "@/lib/types/findings";

interface FindingsViewProps {
  data: FindingsData;
}

export const FindingsView = ({ data }: FindingsViewProps) => {
  return (
    <OnboardingShell title="Your findings">
      {data.totalEscalated === 0 ? (
        <Reveal>
          <EmptyState
            icon={Sparkles}
            title="No escalations yet"
            description={`No tickets have been escalated to Jira in the last ${data.periodDays} days. Once Jira is connected and issues get linked, findings will appear here automatically — nothing to configure.`}
          />
        </Reveal>
      ) : (
        <Reveal>
          <Card>
            <CardContent className="space-y-5 pt-5">
              <p className="text-base leading-relaxed text-foreground">
                Over the last {data.periodDays} days, <strong className="text-primary">{data.totalEscalated}</strong>{" "}
                ticket{data.totalEscalated === 1 ? " was" : "s were"} escalated to Jira.{" "}
                <strong className="text-warning">{data.exceededTarget}</strong> of{" "}
                {data.exceededTarget === 1 ? "it" : "them"} exceeded {data.exceededTarget === 1 ? "its" : "their"}{" "}
                customer resolution target.
                {data.avgEngineeringMinutes !== null && (
                  <>
                    {" "}
                    Escalated tickets spent an average of{" "}
                    <strong>{formatMinutes(data.avgEngineeringMinutes)}</strong> waiting to be picked up in Jira.
                  </>
                )}
              </p>

              {data.topAccounts.length > 0 && (
                <div>
                  <h2 className="mb-3 text-sm font-medium text-foreground">Top affected accounts</h2>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Escalations</TableHead>
                        <TableHead>Exceeded target</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topAccounts.map((row) => (
                        <TableRow key={row.customerName}>
                          <TableCell className="font-medium">{row.customerName}</TableCell>
                          <TableCell>{row.escalatedCases}</TableCell>
                          <TableCell>{row.breachedCases}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </Reveal>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" asChild>
          <a href="/settings/integrations">Confirm SLA policies &amp; connect Slack</a>
        </Button>
        <Button asChild>
          <a href="/dashboard">
            Go to dashboard
            <ArrowRight />
          </a>
        </Button>
      </div>
    </OnboardingShell>
  );
};

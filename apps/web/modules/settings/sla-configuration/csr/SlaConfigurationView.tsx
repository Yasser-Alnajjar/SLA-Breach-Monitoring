"use client";

import { CalendarClock, SlidersHorizontal, Timer } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SlaConfigurationData } from "@/lib/types/sla-configuration";
import { EngineeringTargetForm } from "./EngineeringTargetForm";
import { SlaPoliciesCard } from "./SlaPoliciesCard";
import { CustomerCalendarsCard } from "./CustomerCalendarsCard";

const iconWrapper =
  "flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground";

const descriptionClass = "text-sm leading-6 text-muted-foreground";

interface SlaConfigurationViewProps {
  data: SlaConfigurationData;
}

/**
 * Org-wide SLA engine configuration — engineering leg target, policy target
 * overrides, and customer calendar overrides. Moved out of the Integrations
 * page since none of these are provider-specific: they govern how the SLA
 * engine calculates and monitors commitments, not how a connection to
 * Zendesk/Jira/Linear is made.
 */
export const SlaConfigurationView = ({ data }: SlaConfigurationViewProps) => {
  const {
    engineeringLegTargetMinutes,
    slaPolicies,
    businessCalendars,
    customerCalendars,
  } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Engineering target */}
        <Reveal delay={0}>
          <Card className="h-full overflow-hidden">
            <CardHeader className="border-b bg-muted/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className={iconWrapper}>
                  <Timer className="size-4" />
                </span>

                <div>
                  <CardTitle className="text-sm font-semibold">
                    Engineering leg target
                  </CardTitle>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Team-wide engineering response target
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 px-5 py-5">
              <p className={descriptionClass}>
                Optional team-wide target for cases in the engineering leg.
                Cases exceeding this duration are marked at-risk or breached —
                not a policy builder, just one target for the whole team.
              </p>

              <EngineeringTargetForm
                initialTargetMinutes={engineeringLegTargetMinutes}
              />
            </CardContent>
          </Card>
        </Reveal>

        {/* Customer calendar overrides */}
        <Reveal delay={0.1}>
          <Card className="h-full overflow-hidden">
            <CardHeader className="border-b bg-muted/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className={iconWrapper}>
                  <CalendarClock className="size-4" />
                </span>

                <div>
                  <CardTitle className="text-sm font-semibold">
                    Customer calendars
                  </CardTitle>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Per-customer business hours override
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 px-5 py-5">
              <p className={descriptionClass}>
                Override business hours for specific customers — pin a customer
                to one of the org&apos;s existing calendars instead of whatever
                their matched SLA policy would otherwise resolve to. Only new
                commitments pick up the change.
              </p>

              <CustomerCalendarsCard
                customers={customerCalendars}
                calendars={businessCalendars}
              />
            </CardContent>
          </Card>
        </Reveal>
      </div>
      {/* SLA policies */}
      <Reveal delay={0.05}>
        <Card className="h-full overflow-hidden">
          <CardHeader className="border-b bg-muted/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className={iconWrapper}>
                <SlidersHorizontal className="size-4" />
              </span>

              <div>
                <CardTitle className="text-sm font-semibold">
                  SLA policy overrides
                </CardTitle>

                <p className="mt-1 text-xs text-muted-foreground">
                  Override targets for matched policies
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 px-5 py-5">
            <p className={descriptionClass}>
              Override targets for matched SLA policies. This creates a new
              policy version — existing commitments keep the version they were
              created under, changes apply to new commitments only.
            </p>

            <SlaPoliciesCard policies={slaPolicies} />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
};

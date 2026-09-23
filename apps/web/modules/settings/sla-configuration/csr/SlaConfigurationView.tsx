"use client";

import { SettingsSectionHeader } from "@/components/settings/section-header";
import { CalendarClock, CalendarDays, SlidersHorizontal, Timer } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SlaConfigurationData } from "@/lib/types/sla-configuration";
import { EngineeringTargetForm } from "./EngineeringTargetForm";
import { SlaPoliciesCard } from "./SlaPoliciesCard";
import { CustomerCalendarsCard } from "./CustomerCalendarsCard";
import { BusinessCalendarsCard } from "./BusinessCalendarsCard";

const iconWrapper =
  "flex size-10 shrink-0 items-center justify-center rounded bg-surface-container-highest text-primary";

const descriptionClass = "text-sm text-on-surface-variant";

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
    defaultCalendarId,
    slaPolicies,
    businessCalendars,
    customerCalendars,
  } = data;

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        eyebrow="Deterministic timers"
        title="SLA Configuration"
        description="Engineering targets, policies, and the calendars that govern the SLA clock."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Engineering target */}
        <Reveal delay={0}>
          <Card className="bg-surface-container-low rounded-xl border-0 shadow-sm h-full overflow-hidden">
            <CardHeader className="p-6 pb-0">
              <div className="flex items-center gap-3">
                <span className={iconWrapper}>
                  <Timer className="size-4" />
                </span>

                <div>
                  <CardTitle className="text-on-surface text-xl font-semibold tracking-tight">
                    Engineering leg target
                  </CardTitle>

                  <p className="mt-1 text-xs text-on-surface-variant">
                    Team-wide engineering response target
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 p-6 pt-4">
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
          <Card className="bg-surface-container-low rounded-xl border-0 shadow-sm h-full overflow-hidden">
            <CardHeader className="p-6 pb-0">
              <div className="flex items-center gap-3">
                <span className={iconWrapper}>
                  <CalendarClock className="size-4" />
                </span>

                <div>
                  <CardTitle className="text-on-surface text-xl font-semibold tracking-tight">
                    Customer calendars
                  </CardTitle>

                  <p className="mt-1 text-xs text-on-surface-variant">
                    Per-customer business hours override
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 p-6 pt-4">
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
      {/* Business calendars */}
      <Reveal delay={0.05}>
        <Card className="bg-surface-container-low rounded-xl border-0 shadow-sm h-full overflow-hidden">
          <CardHeader className="p-6 pb-0">
            <div className="flex items-center gap-3">
              <span className={iconWrapper}>
                <CalendarDays className="size-4" />
              </span>

              <div>
                <CardTitle className="text-on-surface text-xl font-semibold tracking-tight">
                  Business calendars
                </CardTitle>

                <p className="mt-1 text-xs text-on-surface-variant">
                  Working hours, timezone, and holidays
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 p-6 pt-4">
            <p className={descriptionClass}>
              Imported (Zendesk) and native calendars. The org default is pre-selected when creating
              a native policy or calendar; it never overrides an existing customer calendar or a
              policy&apos;s own calendar at evaluation time.
            </p>

            <BusinessCalendarsCard calendars={businessCalendars} defaultCalendarId={defaultCalendarId} />
          </CardContent>
        </Card>
      </Reveal>
      {/* SLA policies */}
      <Reveal delay={0.05}>
        <Card className="bg-surface-container-low rounded-xl border-0 shadow-sm h-full overflow-hidden">
          <CardHeader className="p-6 pb-0">
            <div className="flex items-center gap-3">
              <span className={iconWrapper}>
                <SlidersHorizontal className="size-4" />
              </span>

              <div>
                <CardTitle className="text-on-surface text-xl font-semibold tracking-tight">
                  SLA policies
                </CardTitle>

                <p className="mt-1 text-xs text-on-surface-variant">
                  Imported and native policies, and their targets
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 p-6 pt-4">
            <p className={descriptionClass}>
              Imported (Zendesk) policies are read-only — only their targets can be overridden —
              and are matched first. Native policies are created here and are matched only when no
              imported policy matches a case (D12). Every edit creates a new policy version;
              existing commitments keep the version they were created under.
            </p>

            <SlaPoliciesCard
              policies={slaPolicies}
              businessCalendars={businessCalendars}
              customers={customerCalendars}
              defaultCalendarId={defaultCalendarId}
            />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
};

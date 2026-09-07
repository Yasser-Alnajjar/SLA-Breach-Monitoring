# Build Roadmap

Tracks implementation progress after the foundation pass. Source of truth for
scope is `plans/03-Product-and-MVP.md` (Phase 10's MUST HAVE list) and
`plans/04-Architecture-Sketch.md` (Phases 12–17). Each step below is roughly
one PR-sized chunk of work, in dependency order.

To continue: say "go to next step" (or "next") and the first unchecked item
gets built, tested, and turned into a PR — same as the foundation pass. This
file gets checked off and committed as each step lands.

## Status

- [x] **0 — Foundation**: pure SLA/OLA engine (`packages/core`), Prisma schema
      (`packages/db`), pnpm workspace scaffold. [PR #2](https://github.com/Yasser-Alnajjar/SLA-Breach-Monitoring/pull/2)

- [x] **1 — Auth + org bootstrap**
      Next.js App Router setup in `apps/web`, minimal email-based auth, sign-up
      flow that creates an `Organization` + `User`. No roles/permissions (Phase
      10: "minimal, no roles/permissions in v1"). This unblocks everything
      UI-facing.

- [x] **2 — Zendesk integration: connect + ingest**
      Read-only OAuth connect flow, adapter pulling tickets, audits/events,
      organizations, and SLA policy definitions into `RawEvent`. Historical
      backfill of the last 60–90 days (Phase 10: "the entire go-to-market
      depends on this"). No normalization yet — raw ingestion only.
      [PR #4](https://github.com/Yasser-Alnajjar/SLA-Breach-Monitoring/pull/4)

- [x] **3 — Zendesk normalizer + Case/Customer projection**
      `RawEvent` → `NormalizedEvent` for Zendesk: ticket state transitions
      mapped to `NormalizedState`, actor resolution, `Case` opened per ticket,
      `Customer` auto-derived from Zendesk organizations (never manually
      entered). [PR #5](https://github.com/Yasser-Alnajjar/SLA-Breach-Monitoring/pull/5)

- [x] **4 — Jira integration: connect + ingest**
      Read-only OAuth connect flow, adapter pulling issues, changelog, status
      transitions, and remote links into `RawEvent`. Mirrors step 2's shape for
      the second provider. [PR #6](https://github.com/Yasser-Alnajjar/SLA-Breach-Monitoring/pull/6)

- [x] **5 — Jira normalizer + deterministic correlator**
      `RawEvent` → `NormalizedEvent` for Jira. Correlator creates `CaseLink`
      rows using only the deterministic tier (Phase 15): the official
      Zendesk↔Jira link, Jira remote links, or an explicit external-id field.
      No fuzzy matching. Report link coverage honestly.
      [PR #7](https://github.com/Yasser-Alnajjar/SLA-Breach-Monitoring/pull/7)

- [x] **6 — SLA policy import + commitment pipeline**
      `RawEvent` (sla_policy snapshots) → `SLAPolicy`/`SLAPolicyVersion`.
      Zendesk lets one policy define different first-reply/resolution
      targets per ticket priority, so each priority tier becomes its own
      versioned `SLAPolicy` identity; `filter` conditions on priority and
      organization translate to `match.priority`/`match.customerIds`,
      anything else is dropped and counted rather than guessed at.
      Idempotent — a re-run only creates a new version when a policy's
      match or targets actually changed. New `packages/commitments` wires
      `matchPolicyVersion`/`createCommitment` into real `Case` data: every
      case gets whichever of first-response/resolution its matched policy
      defines, once, permanently (`@@unique([caseId, kind])`). No business
      hours import yet — every policy is anchored to one always-open
      calendar per organization until Zendesk schedules are ingested.
      [PR #9](https://github.com/Yasser-Alnajjar/SLA-Breach-Monitoring/pull/9)

- [x] **7 — Worker: two-speed polling + evaluation**
      `apps/worker` becomes real: 5-minute active-set poll, 60-minute
      reconciliation sweep (Phase 16). Each cycle calls `evaluateCommitment`
      from `packages/core` and persists `Evaluation` rows. Idempotency via
      `(integrationId, providerEventId)`.
      Both cycles run the same ingestion path — the provider adapters already
      fetch from the cursor on `Integration`, so a five-minute cycle pulls
      only what changed in those five minutes and the hourly sweep re-runs it
      as a safety net when a cycle failed or was delayed. What separates the
      two speeds is evaluation scope: the poll evaluates commitments that
      aren't finalized yet, the sweep re-checks every one. Cycles are
      serialized so they can't race on a shared cursor, and a failing
      integration is recorded per organization rather than thrown, so one
      broken connection never stops the rest of the cycle. `Evaluation` rows
      record transitions, not heartbeats: the first evaluation, every status
      change, and the final snapshot when a case closes — elapsed time stays
      derived, never accrued into a row every five minutes.

- [x] **8 — Notifications: Slack**
      Slack OAuth (bot-only scopes) + channel selection in settings, backed
      by a new `SlackIntegration` model — not an `Integration`, since it
      neither ingests `RawEvent`s nor advances a cursor. `packages/core`'s
      `evaluateCommitment` now reports the highest `warnAtPercent` threshold
      crossed (or a `BREACH_NOTIFICATION_THRESHOLD` sentinel), independent of
      the coarser `CommitmentStatus`, because a commitment can sit in
      `at_risk` for many cycles while climbing through 50% -> 80% -> 95%
      without its status ever changing — the evaluation pipeline now
      surfaces every such crossing as a notification candidate, not just
      status-changing ones. New `packages/notifications` formats and sends
      the Slack message and is the actual dedup enforcement point via the
      `Notification` table's `@@unique([commitmentId, threshold])`
      constraint. The only notification channel in v1 (Phase 10).

- [x] **9 — Dashboard UI**
      The one screen (Phase 17): at-risk now (sorted by remaining time),
      breached this period, escalations aging in engineering, compliance %.
      Usable without scrolling, comprehensible in under five seconds.
      `apps/web/src/lib/dashboard-data.ts` computes the at-risk list and the
      engineering-aging list live with `evaluateCommitment`/`deriveLegSpans`
      (remaining time is derived, never stored); the breach count and
      compliance % read persisted `Commitment`/`Evaluation` state over a
      trailing 30-day window instead, since those are "already happened"
      reporting metrics, not live ones. Built before step 8 (Slack
      notifications) at the user's request; both are done now.

- [x] **10 — Case detail page**
      Header (customer, ticket, commitment, remaining/breached-by, current
      leg), the rendered timeline with working/paused shading and leg
      boundaries, time-by-stage bar, links out to both systems, and the "how
      this was calculated" disclosure (policy version, calendar, pause rules).
      `apps/web/src/app/cases/[caseId]/page.tsx` reuses the same pure
      `deriveLegSpans`/`evaluateCommitment`/`computeElapsedWorkingMinutes`
      functions the dashboard and worker already call — nothing new is
      persisted, the whole page is a read model over existing
      `NormalizedEvent`/`Commitment` rows. Both commitments on a case share
      one matched `SLAPolicyVersion` (`createCommitment` always matches once
      per case), so the working/paused overlay uses that shared
      `pauseOnStates` rather than needing one per commitment. Zendesk/Jira
      outbound links are built from each integration's stored credentials
      (`subdomain` / `siteUrl`) rather than a stored URL, since neither is
      persisted anywhere else. Dashboard rows now link to their case.

- [x] **11 — CSV export + onboarding polish**
      `/api/reports/commitments` streams every commitment (open and closed) as
      CSV — the reporting floor (Phase 11). `/onboarding` replaces the manual
      "run backfill twice" flow with automatic backfill + live progress
      polling (`RawEvent`/`Case`/`CaseLink` counts every 2.5s); Jira stays
      optional and never blocks the handoff. `/onboarding/findings` computes a
      zero-input findings screen live from existing data, no worker cycle
      needed.

- [x] **12 — Visual redesign**
      Rebuilt every page (auth, onboarding, dashboard, case detail, settings)
      on a Tailwind v4 + shadcn-style component system (obsidian / electric
      lime / warm sand theme), shared app shell/navigation, and Framer Motion
      micro-interactions — no changes to data-fetching or business logic.
      Paired with a full dependency upgrade to latest stable across the
      monorepo (Next 16, React 19, Prisma 7 driver-adapter architecture,
      TypeScript 7, next-auth 4.24.15), including the `middleware.ts` →
      `proxy.ts` rename Next 16 requires.

- [x] **13 — Zendesk business-hours import**
      The last open item on Phase 10's MUST HAVE list: "SLA engine: ...
      business hours, holidays, pause states." `packages/zendesk/src/backfill.ts`
      now pulls `/business_hours/schedules.json` and each schedule's holidays
      into `RawEvent`; `runZendeskBusinessCalendarImport`
      (`packages/zendesk/src/calendars.ts`) maps them to a versioned
      `BusinessCalendarVersion` per schedule (`BusinessCalendar.externalId` =
      Zendesk schedule id — same append-only, name-plus-version shape as
      `SLAPolicy`/`SLAPolicyVersion`). `runZendeskSlaPolicyImport` resolves
      each policy's `schedule_id` to that calendar via
      `resolvePolicyCalendarVersion`, falling back to the always-open default
      (and counting it, never guessing) when a policy points at a schedule
      not yet imported. Existing commitments keep the calendar version bound
      at creation time — only new commitments pick up real hours.
      Per-customer calendars stay a SHOULD, not a MUST.

- [x] **14 — Linear integration: connect + ingest**
      First SHOULD HAVE item (`plans/03-Product-and-MVP.md`). New
      `packages/linear`, mirroring step 4's Jira shape: read-only OAuth
      connect flow, adapter pulling issues, status transitions, and linked
      resources into `RawEvent`. Ships as an alternative engineering-leg
      source alongside Jira, not a replacement. Linear's GraphQL API embeds
      each workflow state's fixed-vocabulary `type` directly on every issue
      and history entry, so — unlike Jira — there's no separate site-wide
      status lookup to backfill. Linear's OAuth tokens also carry no refresh
      token (they don't expire), so `tokenLifecycle.ts` only ever needs to
      mark `reauthRequired` on a 401, never refresh.

- [x] **15 — Linear normalizer + correlator extension**
      `RawEvent` → `NormalizedEvent` for Linear (`packages/linear/src/normalize.ts`),
      mirroring step 5's Jira normalizer — simpler in one respect, since
      Linear's history entries embed the full workflow state (including its
      fixed-vocabulary `type`) directly, unlike Jira's changelog which needs
      a separate site-wide status lookup. A new `packages/linear/src/correlate.ts`
      produces `CaseLink` rows from Zendesk↔Linear links on the same
      deterministic-tier basis as Zendesk↔Jira (Linear attachments standing
      in for Jira remote links) — no fuzzy matching here either.
      `packages/core`'s `SourceSystem` widens to include `"linear"`, and
      `deriveLegSpans` now ends the engineering leg on a resolved/closed
      state from *either* tracker, not just Jira. Also fixed a bug in the
      worker's two-speed cycle: it had been routing every non-Zendesk
      integration through the Jira ingestion path, so a connected Linear
      integration never actually ran its poll/sweep cycle before this. The
      case detail page, CSV export, and findings screen now recognize
      Linear-sourced links and engineering time alongside Jira's; unlike
      Jira (`siteUrl`) or Zendesk (`subdomain`), Linear's stored OAuth
      credentials carry no workspace URL to reconstruct a browse link from,
      so the correlator captures the linked issue's own `url` into the
      CaseLink's `evidence` at link time instead. Onboarding's progress
      tracking stays Jira-only for now — a deliberate scope cut, not an
      oversight, since Linear was never part of that flow's design.

- [ ] **16 — Optional per-team leg targets**
      The OLA configuration surface stays deliberately tiny per Phase 10's
      scope reduction: one optional target duration per engineering leg, not
      a policy builder. Settings UI to set/clear a target on a team; when set,
      `evaluateCommitment` reports at-risk/breach on the engineering leg the
      same way it already does for SLA commitments.

- [ ] **17 — Email notifications**
      Second notification channel in `packages/notifications`, alongside
      Slack (step 8). Same dedup enforcement point (`Notification` table's
      `@@unique([commitmentId, threshold])`) and the same threshold-crossing
      evaluation output — only the formatter and transport are new.

- [ ] **18 — SLA policy override UI**
      Manual override of a matched policy's targets, surfaced in
      `apps/web/src/app/settings/integrations`. An override creates a new
      `SLAPolicyVersion` through the existing versioning path (step 6) rather
      than a side channel, so overridden commitments stay just as
      reproducible and auditable as imported ones.

- [ ] **19 — Webhooks for real-time freshness**
      Zendesk/Jira webhook receivers that push events into the same
      `RawEvent` ingestion path the two-speed poller (step 7) already writes
      to, closing the gap between an event happening and the next 5-minute
      poll. The poll/sweep cycles stay in place as the reconciliation safety
      net for missed or out-of-order webhook deliveries.

- [ ] **20 — Intercom integration (first NICE TO HAVE source)**
      Only if pulled by customers (`plans/03-Product-and-MVP.md`). New
      `packages/intercom` as a third read-only ticket source, mirroring the
      Zendesk ingest/normalize shape (steps 2–3). Picked first among
      Intercom/Freshdesk/Pylon per whichever integration actual prospects
      ask for.

- [ ] **21 — GitHub integration**
      Engineering-leg source alongside Jira/Linear: PR and commit events
      correlated to a `Case` via the same deterministic-link tier, giving a
      third option for teams that track engineering work in GitHub Issues/PRs
      rather than a dedicated tracker.

- [ ] **22 — Custom business calendars per customer**
      Extends step 13's calendar engine: today one `BusinessCalendar` covers
      an entire organization. This lets a customer with contractually
      different hours (e.g. 24/7 enterprise tier vs. standard business hours)
      get its own calendar version, matched via `Commitment.calendarVersionId`
      same as today, just resolved per-customer instead of per-org.

- [ ] **23 — Public API**
      Read-only API exposing dashboard and case-detail data
      (`apps/web/src/lib/dashboard-data.ts`, `case-detail-data.ts`) for
      customers wiring their own BI tools or internal dashboards to it.
      API-key auth, not OAuth — this is machine-to-machine, not a new user
      surface.

- [ ] **24 — SSO/SAML**
      Enterprise auth requirement once deals need it. Layers onto the
      existing minimal email/OAuth auth (step 1) rather than replacing it;
      Phase 10 explicitly kept auth minimal for v1, so this only gets built
      when a specific deal is blocked on it.

- [ ] **25 — Anomaly detection on cycle times**
      Statistical (not AI/LLM — Phase 10's DO NOT BUILD list rules that out)
      detection of unusual cycle-time patterns across `Evaluation` history,
      surfaced as a dashboard callout. Lowest-priority NICE TO HAVE item;
      only worth building once there's enough historical `Evaluation` volume
      per customer for a baseline to mean anything.

## Explicitly deferred past v1

Per Phase 10's DO NOT BUILD list: financial/service-credit calculation, any AI
feature, team mapping/org-chart config, an OLA policy builder, a
configurable rules engine, customer-facing portals, write-back/escalation
actions, a generic connector framework, and additional integrations beyond
Zendesk + Jira. Revisit only after 10+ paying customers ask.

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
      state from _either_ tracker, not just Jira. Also fixed a bug in the
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
      [PR #18](https://github.com/Yasser-Alnajjar/SLA-Breach-Monitoring/pull/18)

- [x] **16 — Optional per-team leg targets**
      One optional target duration for the engineering leg, org-scoped rather
      than a real per-team entity — no `Team` model exists (Jira project /
      Linear team aren't even persisted), and building one would re-open the
      "team mapping/org-chart config" item this roadmap's own DO NOT BUILD
      list excludes. `Organization.engineeringLegTargetMinutes` is a single
      nullable, clearable field (mirrors `SlackIntegration.channelId`, not a
      versioned policy). `packages/core`'s new `sumLegMinutes` sums wall-clock
      minutes across every `LegSpan` of a leg — cumulative, not "current span
      only" — and `evaluateEngineeringLegTarget` reuses the same
      `on_track → at_risk → met | breached` ladder `evaluateCommitment`
      already uses, at a fixed 80% warn threshold rather than a configurable
      `warnAtPercent` array. No worker/`Evaluation`/`Notification` wiring:
      like the dashboard's existing "aging in engineering" list, status is
      computed live in `dashboard-data.ts`/`case-detail-data.ts` from the same
      `deriveLegSpans` output both already call, so the two pages can never
      disagree on a case's status. Settings UI added as a fifth card on
      `/settings/integrations` (the only settings surface today), following
      the Slack channel picker's set/clear pattern exactly.
      [PR #19](https://github.com/Yasser-Alnajjar/SLA-Breach-Monitoring/pull/19)

- [x] **17 — Integration lifecycle management: disconnect, reconnect, health**
      Prioritized ahead of the rest of this list — an audit of the settings
      UI → API routes → `Integration` schema → each package's
      `tokenLifecycle.ts` → worker cycle found that a connected provider
      could only ever be connected, never disconnected, disabled, or shown as
      unhealthy: no disconnect route existed for any provider, the
      `Integration` model had no `status` field, and worker cycle failures
      were logged only to stdout, never persisted anywhere the UI could read.
      `Integration` gains a `status` enum (`connected | disconnected |
reauth_required`), `disconnectedAt`, `lastSyncAt`, `lastSyncError`.
      Disconnect is always a soft state change — credentials cleared to
      `Prisma.JsonNull`, row kept, never `prisma.integration.delete` — since
      `RawEvent.integrationId` cascades on delete and would destroy the
      immutable replay log the architecture depends on, whereas
      `Case`/`Commitment`/`Evaluation` are never FK'd to `Integration` and so
      already survive disconnect untouched; this step makes that existing
      guarantee correct and visible rather than accidental. New
      `POST /api/integrations/{provider}/disconnect` per provider
      (`apps/web/src/app/api/integrations/{provider}/disconnect/route.ts`)
      soft-disconnects, and the worker's per-organization query in
      `apps/worker/src/cycle.ts` now excludes `disconnected` integrations, so
      polling stops on the next tick. No vendor-side token revocation is
      attempted: none of Zendesk/Atlassian/Linear expose a self-service
      revoke endpoint that's reachable from what we actually store (Zendesk's
      needs the token's numeric id, which the OAuth response never returns;
      Atlassian's 3LO apps and Linear's OAuth API document no public revoke
      at all) — clearing the local credentials is what actually stops
      further access, so that's what disconnect does, and the roadmap's
      original "revoke where the vendor supports it" framing turned out not
      to hold for any of the three. Every worker cycle attempt (success or
      failure) now writes `lastSyncAt`/`lastSyncError` per integration
      instead of only console-logging, and reconnecting through any
      provider's OAuth callback resets `status`/`disconnectedAt`/
      `lastSyncError` back to a clean connected state. The Zendesk-only
      `ReauthBanner` (`apps/web/src/components/shared/reauth-banner.tsx`)
      generalizes to a `{provider, reconnectHref}` shape and now covers Jira
      and Linear too, whose backfill routes already returned
      `reauthRequired: true` but whose buttons (`jira-actions.tsx`,
      `linear-actions.tsx`) silently ignored it until now. Fixed a related
      bug found in the same audit: the Jira/Linear settings cards rendered
      "Connected" off the integration row's mere existence rather than
      checking `credentials` the way the Zendesk card always did, so a
      soft-disconnected Jira/Linear integration would have kept showing as
      connected. Explicit non-goals, unchanged from the original scope:
      per-provider settings (project/team allowlists, sync scope) and
      displaying the connected account/workspace name are new product
      surface, not lifecycle management.

- [x] **18 — Email notifications**
      Second notification channel in `packages/notifications`, alongside
      Slack (step 8), over SMTP rather than a transactional-email REST API
      (user preference) — the one deliberate deviation from this repo's
      zero-dependency `fetch`-client convention (`@sla/slack`), since SMTP is
      a stateful protocol `fetch` cannot speak; new `packages/email` wraps
      `nodemailer`, its only dependency. Unlike Slack, email needs no
      connect/settings step: `User.email` is the only per-org identity that
      already exists (roadmap step 1 — "no roles/permissions in v1" means
      exactly one `User` row per org today), so recipients are just every
      `User.email` in the organization, and the transport is a single
      ops-level SMTP credential (`SMTP_HOST`/`PORT`/`SECURE`/`USER`/
      `PASSWORD`, `EMAIL_FROM`) loaded in `apps/worker/src/config.ts`
      exactly like the nullable `zendesk`/`jira` OAuth configs — missing
      credentials mean the channel is skipped, not a crash.
      `packages/notifications/src/dispatch.ts` sends to _both_ configured
      channels per candidate before writing a `Notification` row, rather
      than one row per channel: the `@@unique([commitmentId, threshold])`
      constraint dedups "was this alert dispatched at all", not per-channel,
      so if a second channel's send were deferred until after the first
      channel's row existed, it would read that row as "already sent" and
      silently skip itself. `channel` now records which channels actually
      delivered (`"slack"`, `"email"`, or `"slack,email"`) instead of always
      `"slack"`. `formatEmailMessage` mirrors `formatSlackMessage`'s pure,
      side-effect-free shape (same `NotificationCandidate`/
      `NotificationContext` inputs) for the same reason — testable without
      an SMTP server. No settings UI: unlike Slack's channel picker, there
      is nothing per-org to configure beyond the ops-level SMTP credential,
      so `apps/web/settings/integrations` is untouched — a deliberate scope
      cut, not an oversight.

- [x] **19 — SLA policy override UI**
      Manual override of a matched policy's targets, surfaced as a sixth card
      on `apps/web/src/app/settings/integrations`. An override creates a new
      `SLAPolicyVersion` through the existing versioning path (step 6) rather
      than a side channel: `normalizeMatch`/`normalizeTargets`/
      `policyVersionContentEquals` moved out of `packages/zendesk` into a new
      `packages/core/src/policy-versions.ts` (re-exported from `@sla/zendesk`
      unchanged, so its existing tests didn't need to move) since the
      idempotency check — "would this new version be identical to the
      current one" — was never Zendesk-specific and the override path needed
      it too. New `overridePolicyTargets` (`packages/commitments/src/override.ts`)
      loads a policy's latest `SLAPolicyVersion`, carries `match`,
      `pauseOnStates`, `calendarVersionId`, and `warnAtPercent` over
      unchanged, and appends a new version with only `targets` replaced — a
      no-op submission (identical targets) creates nothing, same guarantee
      step 6 already gives Zendesk re-imports. `Commitment.policyVersionId`
      stays frozen at creation (the reproducibility anchor from step 6's
      schema), so existing commitments are untouched; only cases that get a
      commitment after the override picks up the new targets, via the same
      "latest version per policy" resolution `runCommitmentPipeline` already
      does — no separate wiring needed. No settings UI existed for listing
      SLA policies at all before this step, so `apps/web/src/lib/sla-policies-data.ts`
      is new (`SLAPolicy` + latest `SLAPolicyVersion`, `externalId !== null`
      distinguishing "Imported" from "Manual" since no separate provenance
      field exists on either model), wired into the existing
      `IntegrationsPageData` SSR read model rather than a lazily-fetched
      client endpoint (unlike Slack's channel picker, this is a plain DB read
      with no external API call to defer). `POST /api/settings/sla-policies/override`
      follows this settings surface's established flat-route, manual-
      validation convention (no dynamic route segments or Zod schema exist
      elsewhere in `apps/web/src/app/api/settings`, so this doesn't
      introduce either) and takes `{ policyId, targets }` rather than a
      path param. `CommitmentCard`'s inline policy-match formatting on the
      case detail page was extracted to a shared `formatPolicyMatch` in
      `lib/format.ts` so the new override UI and the existing "how this was
      calculated" disclosure render match conditions identically instead of
      duplicating the logic.

- [x] **20 — Webhooks for real-time freshness**
      Zendesk/Jira webhook receivers (`POST /api/webhooks/{provider}/{integrationId}`)
      that push events into the same `RawEvent` ingestion path the two-speed
      poller (step 7) already writes to, then run that org's full
      commitment/evaluation/notification tail synchronously — writing a
      RawEvent alone does nothing until something re-evaluates commitments
      and dispatches alerts, and that's the actual point of "real-time":
      Phase 16's own arithmetic (a 1h P1 first response needs an 80% warning
      inside a 12-minute window) is what a 5-minute poll can miss. The
      poll/sweep cycles stay in place unchanged as the reconciliation safety
      net for missed or out-of-order webhook deliveries.
      No provider-side auto-registration: both OAuth clients stay read-only
      (Phase 10), and Zendesk's webhook-admin scope and Jira's
      `manage:jira-webhook` scope are both write scopes this app deliberately
      never requests, so the customer registers the webhook by hand in their
      own Zendesk/Jira admin UI, using the URL (and, for Zendesk, bearer
      token) shown on a new "Real-time webhook" section of each provider's
      settings card. `Integration.webhookSecret` is generated once at first
      connect and never rotated on reconnect (mirrors `connectedAt`), so the
      customer's already-configured webhook keeps working across a
      disconnect/reconnect cycle; integrations connected before this step
      have no secret until they reconnect, and the settings card says so.
      Neither receiver uses HMAC request signing, despite Zendesk documenting
      one: that scheme needs a secret both sides agree on _before_ the
      webhook exists, but Zendesk's own signing secret is only generated
      _after_ creation, with no field anywhere in its webhook-creation form
      to hand Zendesk a secret of our choosing — confirmed against the actual
      creation form, whose only Authentication options are None/API
      key/Basic/Bearer token. So both providers verify the same way, a
      shared secret we generate: Zendesk's is pasted into that form's Bearer
      token field and checked against the `Authorization` header
      (`verifyZendeskWebhookSecret`, `packages/zendesk/src/webhook.ts`);
      Jira's classic webhooks have no auth config at creation at all, so its
      secret rides in the URL as `?secret=`, compared in constant time
      (`verifyJiraWebhookSecret`, `packages/jira/src/webhook.ts`). Each
      receiver does a _targeted_ single-ticket/single-issue refetch
      (`runZendeskWebhookIngest`/`runJiraWebhookIngest`, new client methods
      `fetchTicket`/`fetchIssue`) through the same RawEvent mapping functions
      the poller uses — deliberately never touching `Integration.cursor`,
      which belongs to the incremental-export/JQL-window watermark the
      poller advances, not a one-off refetch. `apps/web` gained `@sla/email`
      and `@sla/notifications` as direct dependencies so the webhook route
      can run `runCommitmentPipeline`/`runEvaluationPipeline({scope:
"active"})`/`runNotificationPipeline` itself rather than only waiting
      for the worker; running concurrently with the worker's own cycle is
      safe by construction — both paths share the same
      `@@unique([commitmentId, threshold])`-guarded dedup. A payload naming a
      ticket/issue that 404s on direct fetch (deleted between the event
      firing and the refetch) or an integration that needs reauth is
      accepted (200) rather than retried, since no number of webhook retries
      fixes either; Jira's `jira:issue_deleted` event is accepted and
      ignored outright, matching the poller's own no-deletion-handling scope.

- [x] **21 — Tenant-scoped integration configuration**
      Zendesk/Jira/Slack OAuth **app** credentials (`client_id`/`client_secret`)
      moved from a single global `.env` to a new `IntegrationConfig` model
      (`organizationId` + `provider`, `@@unique` on the pair), set from a new
      "Configure" step on each provider's settings card
      (`IntegrationConfigGate`/`IntegrationConfigForm`,
      `GET/POST /api/integrations/{provider}/config`) — so each customer on
      the shared deployment brings its own OAuth app rather than sharing
      this project's. `IntegrationConfig` stays a separate model from
      `Integration`/`SlackIntegration` (different lifecycle: disconnect
      clears connection credentials but keeps the org's OAuth app config, so
      reconnect needs no reconfiguration) and provider packages stay
      `process.env`-free — `apps/web`'s `{jira,zendesk,slack}-env.ts` and
      `apps/worker`'s `cycle.ts` resolve each org's config via `@sla/db`'s
      `getIntegrationConfig`/`getIntegrationConfigStatus` instead. The
      client secret is AES-256-GCM encrypted at rest under a dedicated
      `INTEGRATION_CONFIG_ENCRYPTION_KEY` (kept separate from
      `NEXTAUTH_SECRET` so rotating one never invalidates the other); a row
      that fails to decrypt (wrong/rotated key, corrupted ciphertext) throws
      a distinct `IntegrationConfigUnreadableError` with a stable, safe
      message rather than a raw crypto error, so a 5xx never leaks
      ciphertext or the underlying cause. There is no `.env` fallback and no
      migration path from one — the product had no production tenants yet,
      so the simplest correct thing was to make `IntegrationConfig` the only
      source outright. Onboarding's Zendesk/Jira connect prompts
      (`OnboardingFlow.tsx`) are gated the same way the settings cards are,
      so a fresh organization with no configuration sees "Configure" instead
      of a raw JSON 500 from an OAuth route with nothing to authenticate
      with. The OAuth `state.organizationId === session.user.organizationId`
      tenant check every connect/callback pair already enforced is now one
      shared, unit-tested `validateOAuthState` (`apps/web/src/lib/oauth-state.ts`)
      instead of three near-identical inline copies. The worker's per-cycle
      `continue` on a provider with no app URL or no saved config was
      replaced with a recorded diagnostic entry (`result.failures`) and a
      written `Integration.lastSyncError`, so an unconfigured integration
      shows up the same way a failed sync does instead of silently never
      polling.

- [x] **22 — Intercom integration (first NICE TO HAVE source)**
      New `packages/intercom` as a third read-only ticket source, mirroring
      the Zendesk ingest/normalize shape (steps 2–3): OAuth connect (no
      refresh token — Intercom access tokens don't expire, so
      `tokenLifecycle.ts` mirrors Linear's shape, not Zendesk's), backfill of
      conversations/conversation parts/companies/contacts into `RawEvent`,
      and normalization into `Case`/`Customer`/`NormalizedEvent`. Intercom's
      conversation parts carry no explicit before/after state the way
      Zendesk's audit `Change` events do, so `deriveNormalizedEventsForConversation`
      replays parts chronologically against a running state tracked from
      "open" (every conversation starts open) instead of reading an explicit
      previous value. A conversation's `Customer` is resolved by following
      its primary contact to that contact's first company — Intercom carries
      no company id directly on the conversation the way a Zendesk ticket's
      `organization_id` does, so this is one extra hop (`GET /contacts/{id}`)
      per conversation.
      `Customer` gains `intercomCompanyId` (a separate unique key from
      `zendeskOrgId`, not a shared generic column). `Case` gains a `system`
      field (`IntegrationProvider`, defaulted to `zendesk` for existing rows)
      recording which ticket-source integration created it — an audit of
      `case-detail-data.ts` and `report-data.ts` found both built an outbound
      Zendesk ticket link off "is Zendesk connected for this org" alone, with
      no way to tell a Zendesk-sourced case from an Intercom-sourced one; both
      now gate on `case.system === "zendesk"` instead. `packages/core`'s
      `SourceSystem` and `deriveLegSpans` widen the same way Jira/Linear
      already share one "engineering" branch: a Zendesk-or-Intercom event now
      drives the same helpdesk-state branch, since a case only ever comes
      from one of them. Deliberately NOT part of `Case`'s unique key —
      Jira/Linear's correlator looks up a case by `externalId` alone with no
      way to know in advance which ticket source created it, and an org
      connecting two ticket sources whose externalIds collide is an accepted,
      uncommon edge case (the product positions Zendesk and Intercom as
      alternatives — `plans/02-Vertical-Wedge-ICP.md` — not both at once).
      No outbound Intercom conversation link is built yet: unlike Zendesk's
      subdomain or Jira's siteUrl, Intercom's stored credentials carry no
      workspace identifier to build an inbox URL from (the same gap
      `packages/linear` already has) — a deliberate scope cut, not an
      oversight. Also deliberately out of scope, matching this step's own
      "ingest/normalize shape (steps 2–3)" framing: SLA policy import (no
      Intercom-native equivalent modeled; an Intercom-only organization gets
      no commitments until a policy exists, whether imported for some other
      provider or created through step 19's override UI), business calendar
      import, webhook receiver, and onboarding wiring (mirrors Linear's own
      settings-only connect flow). `IntegrationConfig` gains `"intercom"`
      alongside zendesk/jira/slack/linear so it uses the same tenant-scoped
      OAuth app credentials as every other provider, with the settings card
      and `/settings/integrations/intercom` detail page following the
      existing per-provider pattern exactly. Verified end-to-end against
      Intercom's real OAuth server (the connect route correctly redirects to
      `app.intercom.com`'s live sign-in page) and against its real API's 401
      response (an invalid token correctly flows through
      `IntercomReauthRequiredError` into both the web backfill route and the
      worker's cycle, surfacing as a `ReauthBanner` in the UI and
      `status: reauth_required` on the `Integration` row) — confirmed via the
      already-running dev `next` and `worker` processes picking up the new
      code through their own hot reload.

- [x] **23 — GitHub integration**
      New `packages/github` as a third engineering-leg tracker alongside
      Jira/Linear. GitHub has no first-party structured "link to Zendesk"
      object the way Jira remote-links/Linear attachments do, so correlation
      works transitively instead: `runGithubCorrelation` extracts a
      Jira/Linear-shaped issue identifier (`TEAM-123`) from a pull request's
      title or branch name, and if that identifier already has a `certain`
      Jira/Linear `CaseLink`, mints a matching `github` `CaseLink` on the
      same `Case` — `method: "pattern"`, an enum value the schema had
      anticipated but neither Jira nor Linear ever used. Needs no Zendesk
      knowledge inside the package at all. Pull requests are the unit of
      work (mirrors Jira/Linear's issue), scoped to PR-centric ingestion
      only — deliberately excludes standalone commits pushed outside any PR,
      which have no open/resolve lifecycle to hang a leg off of. `client.ts`
      is GraphQL (`api.github.com/graphql`), mirroring Linear's shape rather
      than Jira's REST client; `searchPullRequests` goes through GitHub's
      `search` API with a `repo:{owner}/{repo} is:pr updated:>={date}` query
      since the plain `pullRequests` connection has no "since" filter.
      `normalize.ts` maps GitHub's own small fixed PR-state vocabulary
      (`ReadyForReviewEvent`/`ReviewRequestedEvent`/`PullRequestReview` ->
      `in_progress`, `MergedEvent` -> `resolved`, `ClosedEvent` -> `closed`,
      `ReopenedEvent` -> `open`) directly off each timeline item — no
      separate site-wide lookup needed, simpler even than Linear's per-team
      `type`. Actor resolution deliberately diverges from Jira/Linear's
      "author === reporter -> customer" heuristic: a GitHub PR participant is
      always an engineer, never the customer who filed the originating
      ticket, so it's just `null actor -> system`, else `agent`.
      `packages/core`'s `SourceSystem`/`deriveLegSpans` widen the same way
      Jira/Linear already share one engineering branch. GitHub OAuth Apps
      have no single "workspace" the way a Jira site or Linear workspace
      does, so the org picks one `owner/repo` explicitly at connect time
      (`GithubConnectForm`, mirroring Zendesk's subdomain-input pattern) —
      multi-repo support is a clear future extension, not built here. GitHub
      OAuth App tokens, like Linear's, carry no refresh token and don't
      expire, so `tokenLifecycle.ts` mirrors Linear's shape exactly, not
      Jira's. No settings UI beyond the connect card and no onboarding
      wiring — mirrors Linear's/Intercom's own settings-only connect flow.
      No webhook receiver: matches the precedent both Linear (step 14) and
      Intercom (step 22) set for a provider joining outside its own
      dedicated webhook step (step 20), even though GitHub — unlike Jira's
      signing workaround — supports proper HMAC-signed webhooks, a clean
      future addition. `apps/worker/src/cycle.ts`'s previously-implicit
      `else` branch (silently catching "anything that isn't
      zendesk/jira/linear" as Intercom) is now an explicit
      `else if (integration.provider === "intercom")` plus a new `github`
      branch, with integrations sorted so `jira`/`linear` process before
      `github` in the same cycle — GitHub correlation depends on that org's
      Jira/Linear `CaseLink`s already existing, and this avoids an
      unnecessary extra cycle's delay on a miss (still self-heals via the
      next poll either way, upsert-based like every other correlator here).

- [x] **24 — Custom business calendars per customer**
      Extends step 13's calendar engine: today one `BusinessCalendar` covers
      an entire organization. This lets a customer with contractually
      different hours (e.g. 24/7 enterprise tier vs. standard business hours)
      get its own calendar version, matched via `Commitment.calendarVersionId`
      same as today, just resolved per-customer instead of per-org.
      Implemented as a pointer, not a clone: `Customer.calendarId` (new,
      optional, `SetNull` on delete) references an existing `BusinessCalendar`
      row directly — the same org-level calendars step 13 already populates
      (imported Zendesk schedules, plus the always-open default from
      `ensureDefaultCalendarVersion`) — rather than inventing a second,
      customer-owned calendar-content model or a manual weekly-hours editor
      that has no precedent anywhere in this codebase (org calendars have
      never been hand-built, only imported or defaulted). `runCommitmentPipeline`
      (`packages/commitments/src/pipeline.ts`) preloads each org's
      customer-override calendars alongside the policy-matched ones and picks
      between them with the new `resolveCommitmentCalendarVersion` — customer
      override wins when set, otherwise the matched `SLAPolicyVersion`'s
      calendar exactly as before. Still resolves to a `BusinessCalendarVersion`
      and still freezes onto `Commitment.calendarVersionId` at creation, so
      existing commitments are untouched and evaluation/worker code needed no
      changes. New `setCustomerCalendar` (`packages/commitments/src/customer-calendar.ts`)
      validates the calendar belongs to the same organization as the customer
      before assigning (or clears it with `null`), mirroring step 19's
      not-found-error-class pattern. Surfaced as a third card —
      "Customer calendars" — in the existing Configuration section of
      `/settings/integrations` (`CustomerCalendarsCard.tsx`), a per-customer
      select between "Default (from matched policy)" and the org's available
      calendars; `POST /api/settings/customer-calendars` follows this
      surface's established flat-route, manual-validation convention like the
      SLA override route. `getBusinessCalendars`/`getCustomerCalendarSummaries`
      (new `apps/web/src/lib/customer-calendars-data.ts`) feed the picker,
      wired into the same `IntegrationsPageData` SSR read model as everything
      else on this page.

- [x] **25 — Anomaly detection on cycle times**
      Statistical (not AI/LLM — Phase 10's DO NOT BUILD list rules that out)
      detection of unusual cycle-time patterns across `Evaluation` history,
      surfaced as a dashboard callout. New pure `detectCycleTimeAnomaly`
      (`packages/core/src/anomaly.ts`) compares a recent run of closed-commitment
      cycle times against a longer baseline using Iglewicz & Hoaglin's
      modified z-score (median/MAD, not mean/stddev — cycle times are
      right-skewed, so a handful of very slow cases would otherwise inflate
      a stddev check and mask the anomaly). Falls back to mean absolute
      deviation when the baseline MAD is degenerate (e.g. identical
      historical times), and returns null below a minimum baseline/recent
      sample size — the "enough historical volume for a baseline to mean
      anything" gate this step calls for. New `getCycleTimeAnomalies`
      (`apps/web/src/lib/anomaly-data.ts`) groups closed commitments
      (`status` met/breached, `closedAt` set) by customer + commitment kind,
      takes each commitment's cycle time from its terminal `Evaluation`'s
      `elapsedWorkingMinutes` (the same row `evaluate-pipeline.ts` persists
      when it finalizes a commitment, matched by `evaluatedAt <= closedAt`
      rather than recomputed here), splits the last 5 closed per group as
      "recent" against everything older as baseline, and runs the detector
      per group. Wired into the existing `getDashboardData` /
      `DashboardActions.getData` read model as `cycleTimeAnomalies` — no new
      route. Surfaced as a warning `Alert` callout at the top of
      `DashboardView.tsx`, above the existing stat tiles, listing each
      flagged customer/kind with its recent vs. baseline median and sample
      counts; renders nothing when the list is empty.

- [x] **26 — Fix the two confirmed-broken behaviors from the post-roadmap audit**
      A full post-roadmap product audit (`implementation-plans/prod-roadmap.md`)
      re-verified steps 0–25 against the actual code rather than trusting
      prior docs, and found two things that were actively broken rather than
      merely incomplete. First: `packages/db/test/integration-config.test.ts`
      asserted `isConfigurableIntegrationProvider("linear")` was `false`, but
      `CONFIGURABLE_PROVIDERS` (`packages/db/src/integration-config.ts`) has
      correctly included Linear since GitHub/Intercom shipped — the code was
      right, the test was stale; fixed the assertion. Second, and more
      material: `Integration.webhookSecret` (roadmap step 20) was only ever
      generated on the OAuth callback's `create` branch. Disconnect never
      deletes the row (soft state change, by design), so reconnecting always
      hit the `update` branch, which never touched `webhookSecret` — meaning
      any integration connected before webhook support shipped had a
      permanently null secret, even though the settings UI
      (`WebhookInfo.tsx`) told users to "disconnect and reconnect" to fix
      exactly that. Both `apps/web/src/app/api/integrations/{zendesk,jira}/callback/route.ts`
      now run a race-safe `updateMany` predicated on `webhookSecret: null`
      immediately after the upsert, so reconnect actually backfills it —
      Postgres re-evaluates the predicate after the row lock releases, so a
      concurrent reconnect can't double-write. `schema.prisma`'s doc comment
      on `webhookSecret` updated to match (backfilled on reconnect, never
      rotated once set, null only for Linear which has no webhook receiver).
      Also removed a stale `{/* Linear — this is disabled for now */}`
      comment sitting above a fully working Linear card in
      `IntegrationsView.tsx`, and un-commented Linear/Intercom in the
      marketing homepage's integration list (`HomeView.tsx`) — both were
      leftover "not ready yet" markers on integrations that have shipped
      since roadmap steps 14/15 and 22.

- [ ] **27 — CI pipeline** (typecheck, lint, test, build on push/PR; fix or
      delete the root `pnpm build` script, which fails on `packages/core`/`packages/slack` today but is dead code nothing consumes).
- [ ] **28 — Containerize and document deployment** (Dockerfile for
      `apps/web` and `apps/worker`, a prod compose file, `docs/deployment.md`
      — targeting Docker + self-host/VPS, not a specific managed host).
- [ ] **29 — Health checks and observability** (`/api/health`, a worker
      liveness surface, Sentry or equivalent in both apps, alerting on a
      stalled worker cycle).
- [ ] **30 — Inbound abuse protection and webhook replay protection** (rate
      limiting on the two webhook routes and `/api/sign-up`; a timestamp
      check alongside the existing constant-time secret verification).
- [ ] **31 — Fix the notification double-delivery race** (claim the
      `Notification` row via `create()` before sending Slack/email, not
      after — closes the window where a webhook-triggered pipeline and a
      concurrent poll cycle can both send the same alert).
- [ ] **32 — Detect silent permission loss (403)** across all five
      `tokenLifecycle.ts` files — today a connecting user losing
      Browse/Read access degrades ingestion silently, with no
      `reauthRequired` signal and no operator-visible symptom.
- [ ] **33 — Security headers and CSRF hardening** (CSP/HSTS/X-Frame-Options/
      X-Content-Type-Options; an Origin-header check on state-changing
      `/api/settings/**` and disconnect routes as defense in depth beyond
      SameSite cookies).
- [ ] **34 — DST/timezone correctness for the business-hours engine** — fix
      or bound `calendar.ts`'s self-documented DST approximation, and add the
      non-UTC/DST-transition test coverage that currently doesn't exist for
      the one case the code warns about itself.
- [ ] **35 — Close the remaining UI/trust gaps** (a visible link to the
      existing full CSV export route, `error.tsx`/`not-found.tsx` boundaries,
      `loading.tsx` on the routes still missing one).
- [ ] **36 — Reconcile documentation with shipped integrations** (five
      `docs/*.md` files still only mention Zendesk/Jira/Slack and predate
      Linear/GitHub/Intercom; `README.md` is a one-line stub).
- [ ] **37 — Backup runbook and tenant-isolation regression tests** (document + minimally automate Postgres backup/restore; add regression tests
      proving the org-scoping pattern the IDOR audit verified by hand
      actually holds, since nothing currently would catch a future
      regression in it).
- [ ] **38 — Minimize GitHub's OAuth scope** — GitHub is the one integration
      requesting a write-capable scope (`repo`, a Classic OAuth App
      limitation); evaluate migrating to a GitHub App with read-only,
      repo-selected installation permissions. Lower urgency than 27–37 since
      GitHub is a nice-to-have source, not required for the core Zendesk+Jira
      pilot.

## Explicitly deferred past v1

Per Phase 10's DO NOT BUILD list: financial/service-credit calculation, any AI
feature, team mapping/org-chart config, an OLA policy builder, a
configurable rules engine, customer-facing portals, write-back/escalation
actions, a generic connector framework, and additional integrations beyond
Zendesk + Jira. Revisit only after 10+ paying customers ask.

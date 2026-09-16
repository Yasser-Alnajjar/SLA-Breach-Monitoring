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

- [x] **27 — CI pipeline** `.github/workflows/ci.yml` runs on every push to
      `main` and every PR: install, generate the Prisma client, then
      type-check, test, and build the whole workspace. Investigated the root
      `pnpm build` failure on `packages/core`/`packages/slack` rather than
      deleting the script — both packages' `tsconfig.json` had `"types":
      ["node"]` as a sibling of `compilerOptions` instead of nested inside
      it, a silently-ignored key in every one of the 10 non-`db` packages'
      `tsconfig.json`. With no ambient Node types loaded, `core`'s
      `node:crypto` import and `slack`'s global `fetch`/`URL`/
      `URLSearchParams` usage didn't resolve — not dead code, a config typo.
      Moved `types` into `compilerOptions` in all 10; `pnpm build` now passes
      clean, so it stays wired into CI instead of being removed. Added a
      `type-check` script (`tsc --noEmit`) to those same 10 packages and to
      `apps/worker` (mirroring `apps/web`'s existing `type-check`), plus a
      root `pnpm type-check` that runs all of them via `pnpm -r run
      type-check` — `packages/db` has no such script (its own
      `tsconfig.json` has a `rootDir` that doesn't include the generated
      Prisma client, never exercised before since nothing built or
      typechecked it standalone) and `pnpm -r run` skips packages missing
      the script rather than erroring, so it's correctly left alone. CI sets
      dummy values for `DATABASE_URL`/`NEXTAUTH_SECRET`/`NEXTAUTH_URL`/
      `INTEGRATION_CONFIG_ENCRYPTION_KEY`/`SMTP_ENCRYPTION_KEY` directly as
      job env — verified locally with no `.env` file present that `prisma
      generate` (needs `DATABASE_URL` to resolve, doesn't connect) and
      `next build` (fully static/dynamic-route analysis, no live DB query at
      build time) both succeed on dummy values alone, so CI never needs a
      real database.
- [x] **28 — Containerize and document deployment** `apps/web/Dockerfile`
      and `apps/worker/Dockerfile`, `docker-compose.prod.yml`, and
      `docs/deployment.md` — targeting Docker + self-host/VPS, not a
      specific managed host. The two apps needed different treatment.
      `apps/web` gets a standard multi-stage build using Next's `output:
      "standalone"` (added to `next.config.mjs`, with
      `outputFileTracingRoot` pointed at the monorepo root so pnpm-workspace
      packages trace correctly) — the runtime image ships only the traced
      server bundle, no devDependencies. `apps/worker` can't do the same:
      its own `start` script runs TypeScript directly via `tsx` rather than
      a compiled `dist/`, and every `@sla/*` package it imports resolves to
      workspace TS source (`main` points at `src/index.ts`, not a build
      artifact) — so its image keeps the full monorepo install, including
      devDependencies, and just runs the existing `pnpm start`. Neither
      image needed Prisma's query-engine binaries or `libssl` — `packages/db`
      generates the driver-adapter client (`@prisma/adapter-pg`), which is
      pure JS/TS — so plain `node:22-alpine` works for both. Actually built
      and ran both images against a real Postgres container to verify (not
      just inspected): this surfaced two real bugs a read-through wouldn't
      have caught. First, the repo had no `packageManager` field, so
      Corepack re-resolved (and, at runtime with a non-root user, tried to
      migrate) a different pnpm version than the one node_modules was
      installed with, hard-failing `apps/worker`'s container on startup with
      `ERR_PNPM_PACKAGE_MANAGER_REMOVE_MODULES_DIR`; pinned
      `"packageManager": "pnpm@10.33.0"` in the root `package.json` (matches
      CI's `pnpm/action-setup` major version) to make Corepack deterministic
      across build and run. Second, `apps/web/Dockerfile` unconditionally
      copied a `public/` directory the app doesn't have; removed that COPY.
      Both app containers run as an unprivileged user; the one-off `prisma
      migrate deploy` step (documented, not run automatically on every
      start) needs `--user root` since a non-root user can't write
      `node_modules` state files migrate occasionally touches — the
      long-running worker process itself never runs that way. Build-time
      `ENV`s in both Dockerfiles are fixed placeholder values, never real
      secrets — actual config is only ever supplied at container start via
      `environment:`/`--env-file`, same as the CI job's approach for the
      same values.
- [x] **29 — Health checks and observability**
      `GET /api/health` (`apps/web/src/app/api/health/route.ts`) checks DB
      connectivity only (`SELECT 1` through Prisma) and is added to
      `proxy.ts`'s `PUBLIC_API_PATHS` — an uptime monitor or orchestrator
      has no session cookie to send. The worker had no HTTP surface
      whatsoever before this step; `apps/worker/src/health-server.ts` is a
      plain `node:http` listener (no framework, matching this package's
      zero-dependency style) on `GET /health`/`/healthz`
      (`WORKER_HEALTH_PORT`, default 8081), reusing the `WorkerSettings`
      infrastructure roadmap step 7 already built
      (`deriveWorkerStatus`/`getOrCreateWorkerSettings` from `@sla/db`,
      also what backs the existing Monitoring settings page) rather than
      inventing a second health model — it adds `lastSuccessfulCycleAt`
      (the more recent of the two cycle kinds' last run, but only counting
      one with zero recorded failures) and an aggregate
      `integrations.mostRecentSyncAt`/`withErrors` across every connected
      integration, per this step's explicit "surface an aggregate last
      successful cycle timestamp too" scope. Responds `503` only for
      `stopped` (no heartbeat at all — the process looks wedged), since
      that's the one case a container restart can fix; `degraded` (alive,
      but a recent cycle recorded per-org failures) still returns `200`.
      Both Dockerfiles gained a `HEALTHCHECK` hitting their respective
      endpoint over `wget` (present via alpine's busybox, confirmed rather
      than assumed); the worker's port is `EXPOSE`d for documentation but
      deliberately not published to the host in `docker-compose.prod.yml`
      (`expose:`, not `ports:`) since only the container's own healthcheck
      needs it — an operator wanting external polling adds their own
      `ports:` mapping.
      Error tracking: `@sentry/nextjs` in `apps/web` (`sentry.server.config.ts`/
      `sentry.edge.config.ts`, loaded once from a new `src/instrumentation.ts`
      — Next's own App Router hook, split in two because `proxy.ts` runs on
      the Edge runtime while route handlers run on Node) and `@sentry/node`
      in `apps/worker` (`src/sentry.ts`, a small wrapper — `initSentry`/
      `captureException`/`captureMessage`/`flushSentry` — since the worker
      has no framework init hook of its own). Both stay fully inert without
      `SENTRY_DSN` (`enabled: false` in web; an `initialized` guard in the
      worker's wrapper) — the "missing credentials mean skip" convention
      already used for SMTP/per-org Slack, not a crash. Deliberately no
      `withSentryConfig` wrapping of `next.config.mjs`: that plugin's real
      value is build-time source-map upload, which needs a `SENTRY_AUTH_TOKEN`/
      org/project this deployment doesn't have and would add CI/build
      fragility for a step whose actual ask is runtime error capture, not
      source-mapped stack traces. Captured: unhandled exceptions in both
      apps (`instrumentation.ts`'s `onRequestError` in web; `uncaughtException`/
      `unhandledRejection` process handlers plus the worker's own cycle-level
      catch in web's sibling `apps/worker/src/index.ts`), and every
      `Integration.lastSyncError` write in `cycle.ts`'s per-integration
      catch — except when `reauthRequired` is true, since that's an
      expected, already-surfaced state (the settings page's `ReauthBanner`)
      rather than a bug worth paging on. The three other per-organization
      catch blocks in the same cycle (commitments/evaluation/notifications
      stages) got the same capture for consistency, since they represent
      the same class of real, unexpected failure.
      Stalled-cycle alerting is new, deployment-owner-level config with no
      precedent in this codebase to reuse: `OPS_ALERT_SLACK_WEBHOOK_URL`
      (a plain Slack incoming-webhook URL, not the per-org `SlackIntegration`
      OAuth app — that needs a resolved bot token and channel from a
      completed per-org install, and reusing it would mean paging every
      customer's own Slack channel when this deployment's worker stalls)
      and/or `OPS_ALERT_EMAIL` + its own `OPS_ALERT_SMTP_*` credentials
      (independent of any organization's saved `OrganizationEmailSettings`,
      since this alert must still reach the operator even if a customer's
      own SMTP config is broken) — both optional, either, neither, or both.
      New `apps/worker/src/watchdog.ts` checks every two minutes whether
      either cycle kind's last *successful* (zero-failure) run is older
      than 3x its configured interval — the same multiplier
      `deriveWorkerStatus` already uses for its own "stopped" heartbeat
      check — and sends (and, on recovery, un-sends) an alert through
      `apps/worker/src/ops-alert.ts`'s `sendOpsAlert`, tracking "already
      alerted" in memory since a process restart is already a distinct
      incident either way. Explicitly stated as a limitation in that file's
      own doc comment: this only catches a worker that's alive but not
      completing cycles — a fully crashed process stops this check along
      with everything else, which is exactly what the container
      `HEALTHCHECK`/restart-policy pairing above is for instead. Verified
      end-to-end against the real local dev stack (not just type-checked):
      both `/api/health` and the worker's `/health` were hit live and
      returned the expected `200` bodies, including through `proxy.ts`'s
      new unauthenticated allowlist entry.
      Explicit non-goals, matching this step's own scope: full APM/tracing
      (`tracesSampleRate: 0` in both Sentry configs), metrics dashboards,
      and log aggregation infrastructure.
- [x] **30 — Inbound abuse protection and webhook replay protection**
      New `apps/web/src/lib/rate-limit.ts`: a dependency-free, in-memory
      fixed-window counter — `docker-compose.prod.yml` runs exactly one
      `web` container, so no shared store (Redis, etc.) is needed for
      "basic" protection, matching this step's own "not a general-purpose
      rate-limiting gateway" non-goal. Wired into `apps/web/src/proxy.ts`
      (which already gated `PUBLIC_API_PATHS` by path) ahead of every other
      check, keyed by client IP (`X-Forwarded-For`, falling back to
      `X-Real-IP`, then a shared "unknown" bucket for local dev with no
      reverse proxy in front — see `docs/deployment.md`'s security notes)
      combined with a route bucket: 60/min on `/api/webhooks/**` (external
      providers call these at low legitimate volume; the cap mostly slows
      down secret-guessing), 5/15min on `/api/sign-up`, and 10/5min on
      `/api/auth/callback/credentials` — NextAuth's Credentials provider has
      no throttling of its own, and this is scoped to that one callback path
      rather than all of `/api/auth` so routine session/csrf/providers
      lookups on every page load stay unthrottled. Exceeding a limit returns
      `429` with a `Retry-After` header.
      Timestamp-based replay mitigation, alongside the existing constant-time
      secret checks, not replacing them: `packages/jira/src/webhook.ts`'s new
      `isJiraWebhookTimestampFresh` reads the top-level `timestamp` (epoch
      milliseconds) Atlassian's classic webhook payloads carry on every
      callback — needs no customer-side change. Zendesk has no equivalent
      built-in field for the Bearer-token flow this integration uses (its
      `X-Zendesk-Webhook-Signature-Timestamp` header is tied to the
      "Signing Secret" auth method this app can't use — see `webhook.ts`'s
      existing top comment on why), so `packages/zendesk/src/webhook.ts`'s
      new `extractZendeskWebhookTimestamp`/`isZendeskWebhookTimestampFresh`
      instead read a `timestamp` field added to the documented custom
      trigger body (`WebhookInfo.tsx`, now
      `{"ticket_id": "{{ticket.id}}", "timestamp": "{{ticket.updated_at}}"}`),
      falling back leniently to `ticket.updated_at`/`detail.updated_at` for
      the native "Ticket Events" envelope shape, the same lenient-extraction
      style `extractZendeskWebhookTicketId` already uses. Both freshness
      checks default to a 5-minute window and fail closed — a missing or
      unparseable timestamp is treated as stale, not skipped — wired into
      both webhook routes right after the JSON body parses, returning `401`
      alongside the existing secret-mismatch response. Noted directly in
      `extractZendeskWebhookTimestamp`'s doc comment: the exact rendering of
      `{{ticket.updated_at}}` inside a webhook body isn't independently
      confirmed against live Zendesk behavior, so extraction is deliberately
      permissive about the string format it accepts.
- [x] **31 — Fix the notification double-delivery race** (claim the
      `Notification` row via `create()` before sending Slack/email, not
      after — closes the window where a webhook-triggered pipeline and a
      concurrent poll cycle can both send the same alert).
      `packages/notifications/src/dispatch.ts` now claims before sending:
      each candidate's row is `create`d first with a placeholder
      `channel: "pending"`, and only the claim holder sends. A `P2002` on
      the claim means another pipeline already has it — counted as skipped
      with no network call, same as before. Once the sends finish, the row's
      `channel` is `update`d to what actually delivered (`"slack"`, `"email"`,
      `"slack,email"`). When every channel fails, the claim is `delete`d so a
      later cycle retries, which keeps the old "total failure isn't recorded"
      retry behavior. The dedup key (`@@unique([commitmentId, threshold])`)
      and the supported channels didn't change, per this step's non-goals.
      Nothing outside `dispatch.ts` reads `Notification.channel`, so the
      placeholder value never shows up anywhere. Deliberate trade-off, noted
      in the function's doc comment: a process that dies between the claim
      and the end of its sends leaves a `"pending"` row, so that alert is
      never retried. That makes delivery at-most-once, chosen over paging a
      customer twice for one breach. Covered by new tests in
      `packages/notifications/test/dispatch.test.ts`: claim ordering (the
      claim is created before the first send), two concurrent pipelines
      sharing a real uniqueness store with only one send between them, a
      lost claim sending nothing, and all-channels-failed releasing the
      claim. The ordering, concurrency, and lost-claim tests were confirmed
      to fail against the previous implementation.
- [x] **32 — Detect silent permission loss (403)** across all five
      `tokenLifecycle.ts` files — today a connecting user losing
      Browse/Read access degrades ingestion silently, with no
      `reauthRequired` signal and no operator-visible symptom.
      Detection happens in each provider's `client.ts`, not
      `tokenLifecycle.ts`: a 403 isn't a credentials problem (the token is
      still valid, so there's nothing for token lifecycle to do), and the
      clients are where the HTTP status is visible. Each client now throws
      a `{Provider}PermissionDeniedError` on 403. It subclasses the existing
      `{Provider}ApiError` with `status: 403`, so existing `status` checks
      (the webhooks' and Zendesk backfill's 404 handling) behave the same.
      A 403 never goes through `onUnauthorized`. GitHub has two special
      cases. First, a 403 that is really rate limiting stays a plain
      `GithubApiError`, exactly as before. That covers primary-limit
      exhaustion (`x-ratelimit-remaining: 0`) and secondary limits that
      GitHub identifies only in the message body ("rate limit"), with no
      `Retry-After` and a non-zero remaining count. The existing
      `Retry-After` wait-and-retry is unchanged. GitHub also
      reports lost access as GraphQL errors with `type: "FORBIDDEN"` (e.g.
      SAML SSO enforcement) or `"INSUFFICIENT_SCOPES"` inside an HTTP 200,
      and both are treated as permission loss too. Linear is HTTP-403 only;
      its GraphQL error shape for forbidden access isn't confirmed here, so
      it isn't pattern-matched.
      State lives in a new `IntegrationStatus.permission_denied`
      (migration `20260914230000_add_integration_permission_denied`, a
      single `ALTER TYPE ... ADD VALUE`), not in the credentials JSON like
      `reauthRequired`, since the credentials are fine. The migration was
      verified by applying all migrations to a throwaway Postgres 16 and
      running `prisma migrate diff` from that database to `schema.prisma`:
      no difference. Transitions into and out of `permission_denied` are
      compare-and-set on the current status (`updateMany` guarded by
      `status`), in the worker and both webhook receivers. So a
      disconnect or reconnect that lands mid-cycle is never overwritten:
      only `connected` becomes `permission_denied`, and only
      `permission_denied` clears to `connected`. The reauth write path is
      unchanged. `apps/worker/src/cycle.ts` sets it on a permission error with
      a `lastSyncError` of "{Provider} denied access — the connecting
      user's {Provider} permissions may have changed". It clears back to
      `connected` on the first clean sync, unlike reauth, which only the
      OAuth callback clears. Restoring the user's access provider-side
      needs no action in this app. The worker already processes every
      non-`disconnected` row, so a `permission_denied` integration keeps
      getting retried and can recover. Sentry capture happens once, on
      the transition into the status, not on every cycle, so the operator
      hears about it without being paged every 5 minutes. The Zendesk and
      Jira webhook receivers do the same: set the status on a permission
      error (accepted, not retried) and clear it on success.
      UI: new `PermissionDeniedBanner` (`components/shared/`), deliberately
      different advice from `ReauthBanner`: ask a provider admin to restore
      the user's permissions, no reconnect needed. Shown on the integration
      cards (status indicator "Access restricted", via a new
      `ConnectedStatus` helper replacing five copies of the reauth ternary)
      and on `/settings/integrations/[provider]` (badge plus banner).
      Scope limit, per this step's non-goal: only an actual 403 is caught.
      A permission change that makes the provider silently return
      *narrower* results (e.g. Jira JQL dropping a project the user can no
      longer browse) is still undetectable without per-resource probing or
      volume heuristics.
      Tests: new `packages/{jira,intercom}/test/client.test.ts` plus 403
      cases in the Zendesk/Linear/GitHub client tests. These cover
      no-refresh-on-403 for all five providers, both GitHub rate-limit
      exclusions, `RATE_LIMITED` staying generic, and the GraphQL
      `FORBIDDEN`/`INSUFFICIENT_SCOPES` cases. The root vitest config now
      also includes `apps/worker/test`. The new `apps/worker/test/cycle.test.ts`
      drives `runCycle` through Linear's real backfill, client and token
      lifecycle, with a stubbed `fetch` and a fake Prisma that honors
      compare-and-set. It covers: 403 → `permission_denied`; 401 → the
      existing reauth path; 500 → the existing generic path; recovery on a
      clean sync; a transient error leaving the status alone; Sentry firing
      once across repeated 403s (and again for a fresh loss after
      recovery); a mid-cycle disconnect never being overwritten; and
      `permission_denied` rows still being selected for sync.
- [x] **33 — Security headers and CSRF hardening** (CSP/HSTS/X-Frame-Options/
      X-Content-Type-Options; an Origin-header check on state-changing
      `/api/settings/**` and disconnect routes as defense in depth beyond
      SameSite cookies).
      Headers: new `apps/web/security-headers.mjs` (plain `.mjs` so
      `next.config.mjs` imports it directly), applied to every path through
      `headers()`: CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options:
      nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a
      restrictive `Permissions-Policy`, and HSTS (two years,
      `includeSubDomains`) in production only. `poweredByHeader` is off.
      CSP: `default-src 'self'`, `frame-ancestors 'none'`,
      `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and
      `connect-src 'self'`. There is no third-party origin anywhere: next/font
      self-hosts the fonts and Sentry runs server-side only. Deliberate
      trade-off, documented in the file: `script-src` keeps
      `'unsafe-inline'`, because the App Router's inline RSC payload scripts
      and next-themes' no-flash script would otherwise need a per-request
      nonce, and a nonce forces every page, static docs included, into dynamic
      rendering. Dev only adds `'unsafe-eval'` and `ws:`/`wss:` for React
      dev tooling and HMR, and never sends HSTS, so LAN-IP/ngrok hosts don't
      get pinned to https in a developer's browser.
      CSRF: new `apps/web/src/lib/csrf.ts`, enforced in `proxy.ts` after rate
      limiting and before the auth check. It covers every non-GET/HEAD/OPTIONS
      `/api/**` request, which is wider than the settings/disconnect routes
      named above: integration config/backfill, Slack channel selection, and
      sign-up are session- or login-driven writes too. Only `/api/webhooks`
      (server-to-server, secret-authenticated, no `Origin`) and `/api/auth`
      (NextAuth's own double-submit CSRF token) are exempt. The request
      passes when `Origin` (or `Referer`'s origin when `Origin` is absent)
      equals `NEXTAUTH_URL`'s origin or the addressed host
      (`X-Forwarded-Host`, else `Host`). That second case keeps
      `allowedDevOrigins` dev access working. It fails closed: no usable
      origin, including a literal `Origin: null`, returns `403`.
      Verified against the running dev server: headers present on `/`, the
      sign-in page renders with no CSP violations in the console, a
      same-origin browser `fetch` POST reaches the auth gate (`401`), and
      `curl` POSTs with a foreign `Origin` or no `Origin` get `403`.
      Tests: `apps/web/test/csrf.test.ts` (origin matching, sibling-subdomain
      and scheme/port mismatches, Referer fallback, forwarded host, proxy
      wiring and exemptions) and `apps/web/test/security-headers.test.ts`.
- [x] **34 — DST/timezone correctness for the business-hours engine** — fix
      or bound `calendar.ts`'s self-documented DST approximation, and add the
      non-UTC/DST-transition test coverage that currently doesn't exist for
      the one case the code warns about itself.
      The new tests exposed real bugs, not just imprecision. (1) Days were
      stepped by adding 24h to local midnight. On a 25-hour fall-back day
      that lands on 23:00 the same day, so the loop never advanced:
      `computeDeadline` threw "exceeded search horizon" for any
      America/New_York calendar spanning the first Sunday of November, and
      `workingMinutesBetween` silently stopped counting at that Sunday.
      (2) Window boundaries were `midnight + openMinute`, so on either
      transition day every window after 02:00 was off by an hour.
      (3) `zonedDateToUtc`'s two-pass guess had no defined answer for a
      skipped or repeated wall-clock time.
      Fix (`packages/core/src/calendar.ts`): days are stepped by calendar
      date, every window boundary is converted from local wall-clock time
      on its own, and `zonedDateToUtc` is exact. It compares the zone's offset a
      day either side. A repeated time resolves to its first occurrence, and
      a skipped time resolves to the transition instant, found by binary
      search, so skipped minutes accrue no working time and the mapping stays
      monotonic. This also covers zones whose transition skips midnight
      (America/Santiago). The `Intl.DateTimeFormat` is now cached per zone,
      so the engine is about 6x faster than before despite doing more
      conversions.
      Tests: `packages/core/test/calendar.test.ts` gains America/New_York
      cases across spring-forward and fall-back (weekend carry-over, windows
      on the transition day, windows spanning the skipped and repeated hour,
      a window closing at local midnight, 40h weeks, 23h/25h days), a
      local-date holiday, a Santiago midnight gap, and a
      `computeDeadline`/`workingMinutesBetween` round-trip across a
      transition. 8 of the 14 new cases failed before the fix.
      `docs/customer-guide.md` now explains the DST behavior.
- [x] **35 — Close the remaining UI/trust gaps** (a visible link to the
      existing full CSV export route, `error.tsx`/`not-found.tsx` boundaries,
      `loading.tsx` on the routes still missing one).
      Export: an "Export full report" button beside the dashboard's
      *SLA Analytics* heading (`ProjectAnalyticsSection.tsx`). It is a plain
      `<a download>` to `/api/reports/commitments`, not `next/link`, because
      the route answers with a CSV attachment. The export is still built in
      memory, not streamed; this is recorded as a known limitation in
      `docs/customer-guide.md` §17, to revisit only if a real export gets
      slow. The unused `Download`/`Button` imports left in the dashboard's SSR
      component were removed.
      Boundaries: a shared `RouteStatus` component
      (`src/components/shared/route-status.tsx`) backs four boundaries.
      `app/error.tsx` and `app/not-found.tsx` render full-screen with the
      brand mark, since they sit outside any shell. `app/(main)/error.tsx`
      and `app/(main)/not-found.tsx` render inside the sidebar layout, so a
      failing page or a `notFound()` from `Actions.Cases.getDetail` /
      integration detail keeps navigation on screen. Error pages show Next's
      error digest as a reference for matching against server logs and
      Sentry. They don't claim the error "was logged", because client-side
      render errors aren't reported (Sentry is server-only).
      Loading: `loading.tsx` skeletons for `cases`, `cases/[caseId]`,
      `settings` (shared by every settings page), and `onboarding` (which
      also covers findings, so it uses a placeholder title rather than
      "Getting started").
      Verified in the dev server: an unknown public URL returns `404` with the
      branded page, and a temporary throwing page (since removed) rendered the
      root error boundary with its digest. The signed-in pages (dashboard
      button, in-app boundaries, skeletons) were type-checked but not viewed,
      because that needs a signed-in session.
- [x] **36 — Reconcile documentation with shipped integrations** (five
      `docs/*.md` files still only mention Zendesk/Jira/Slack and predate
      Linear/GitHub/Intercom; `README.md` is a one-line stub).
      Decision: retire, don't update. The seven files (`index`,
      `integrations`, `getting-started`, `how-it-works`, `sla-timing`,
      `dashboard-and-cases`, `troubleshooting`) were written from the product
      definition before the build. `index.md` said so itself. Everything in
      them is covered, accurately, by `docs/customer-guide.md` and the in-app
      `/docs` pages, so updating them would only have created a third doc set
      to keep in sync. They are deleted and remain in git history.
      User-facing docs are now exactly two sets: `docs/customer-guide.md`
      (plus `docs/deployment.md` for self-hosting) and the in-app `/docs`
      pages.
      Links fixed: `docs/deployment.md`'s "Getting Started" link now points to
      `customer-guide.md#4-getting-started`. The guide's overview linked the
      GitHub scope exception to a nonexistent `#7-github-integration` (§7 is
      Jira), so it now points to §22 Security and Access, where that
      explanation lives.
      `README.md` goes from an empty stub to: what the product does and what
      it connects to, the repo layout, local setup (Node 22/pnpm 10, `.env`
      at the repo root with the three generated secrets, `docker compose up
      -d postgres`, Prisma generate + `migrate:dev`, `web:dev` +
      `worker:dev`, first sign-up and the bring-your-own-OAuth-app step),
      tests, a pointer to `docs/deployment.md`, and where each doc set lives,
      with a note to keep the guide and in-app docs updated together.
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

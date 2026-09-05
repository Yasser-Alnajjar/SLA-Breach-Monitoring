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

- [ ] **10 — Case detail page**
      Header (customer, ticket, commitment, remaining/breached-by, current
      leg), the rendered timeline with working/paused shading and leg
      boundaries, time-by-stage bar, links out to both systems, and the "how
      this was calculated" disclosure (policy version, calendar, pause rules).

- [ ] **11 — CSV export + onboarding polish**
      CSV export (the reporting floor). Streaming backfill progress view with
      live counts, zero-input findings screen, time-to-value target under 15
      minutes unattended (Phase 11).

## Explicitly deferred past v1

Per Phase 10's DO NOT BUILD list: financial/service-credit calculation, any AI
feature, team mapping/org-chart config, an OLA policy builder, a
configurable rules engine, customer-facing portals, write-back/escalation
actions, a generic connector framework, and additional integrations beyond
Zendesk + Jira. Revisit only after 10+ paying customers ask.

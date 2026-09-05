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

- [ ] **5 — Jira normalizer + deterministic correlator**
      `RawEvent` → `NormalizedEvent` for Jira. Correlator creates `CaseLink`
      rows using only the deterministic tier (Phase 15): the official
      Zendesk↔Jira link, Jira remote links, or an explicit external-id field.
      No fuzzy matching. Report link coverage honestly.

- [ ] **6 — SLA policy import + commitment pipeline**
      Import Zendesk SLA policies into `SLAPolicy`/`SLAPolicyVersion`. Wire
      `packages/core`'s `matchPolicyVersion`/`createCommitment` into real
      `Case` data so every case gets its first-response and resolution
      commitments on ingestion.

- [ ] **7 — Worker: two-speed polling + evaluation**
      `apps/worker` becomes real: 5-minute active-set poll, 60-minute
      reconciliation sweep (Phase 16). Each cycle calls `evaluateCommitment`
      from `packages/core` and persists `Evaluation` rows. Idempotency via
      `(integrationId, providerEventId)`.

- [ ] **8 — Notifications: Slack**
      Slack OAuth + channel selection. Fires on Evaluation *transitions* only,
      deduplicated via `(commitmentId, threshold)` (Phase 13.7). The only
      notification channel in v1 (Phase 10).

- [ ] **9 — Dashboard UI**
      The one screen (Phase 17): at-risk now (sorted by remaining time),
      breached this period, escalations aging in engineering, compliance %.
      Usable without scrolling, comprehensible in under five seconds.

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

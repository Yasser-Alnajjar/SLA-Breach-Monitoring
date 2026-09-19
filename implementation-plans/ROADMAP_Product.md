# SLA Watchtower — Product Roadmap

> **The single, living implementation plan for SLA Watchtower.** It says what we build next, what is in progress, and what is done. It is updated in place as the product evolves. Never start a second roadmap file.
>
> **Revision:** 3 · **Last updated:** 2026-09-19 · **Capacity:** 10–15 h/week
> **History:** the steps already delivered (0–44) are in [`roadmap-completed.md`](roadmap-completed.md). Parked ideas are in [`ignored.md`](ignored.md).

---

## Status Board

_Update this section every time a task or phase changes state._

|                          |                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Now**                  | Phase 1 — Correct SLA Commitments · 5 of 13 tasks done (1.1, 1.2, 1.9, 1.11, 1.12) · the rest blocked on decisions D3–D7 |
| **Up next**              | Phase 2 — Reliable Zendesk + Jira Connections                                                                  |
| **Blocked on decisions** | D3, D4, D5, D6, D7 (Phase 1) · D12 (Phase 4) · D8 (Phase 5) · D11 (scheduling)                        |
| **Recently completed**   | Phase 0 — Safe Foundation, ✅ complete (2026-09-19) — see [Phase 0](#phase-0--safe-foundation)                 |
| **Target**               | Production-ready MVP for **Zendesk + Jira** customers. Intercom, Linear and GitHub as Beta.                    |
| **Estimate**             | 24 weeks plus 3 buffer (about 6–7 months)                                                                      |

### Phase overview

| Phase                                                  | Product outcome                                                                       | Est. | Status                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| [0](#phase-0--safe-foundation)                         | Safe foundation: no cross-tenant control, deterministic SLA state                     | 2 wk | ✅ Complete (2026-09-19)                          |
| [1](#phase-1--correct-sla-commitments)                 | Correct SLA commitments: final, tested First Response / Next Reply / Resolution rules | 3 wk | 🔄 In progress (5/13 tasks, 2026-09-19)           |
| [2](#phase-2--reliable-zendesk--jira-connections)      | Reliable Zendesk + Jira connections, verified live                                    | 3 wk | ⬜ Not started                                    |
| [3](#phase-3--explainable-cases)                       | Explainable cases: timeline, commitment transparency, assignee, rich alerts           | 3 wk | ⬜ Not started                                    |
| [4](#phase-4--sla-policy--calendar-management)         | SLA policy and calendar management inside Watchtower                                  | 4 wk | ⬜ Not started                                    |
| [5](#phase-5--team--account-management)                | Team and account management                                                           | 2 wk | ⬜ Not started                                    |
| [6](#phase-6--sla-health-dashboard--guided-onboarding) | SLA health dashboard and guided onboarding                                            | 2 wk | ⬜ Not started                                    |
| [7](#phase-7--production-launch)                       | Production launch                                                                     | 5 wk | ⬜ Not started                                    |
| [Next](#next-product-work)                             | Post-launch product work                                                              | —    | Backlog                                           |

---

## How This Roadmap Works

### Workflow

1. **Define.** Upcoming product work is written here as a task inside a phase, or in [Next Product Work](#next-product-work) if it isn't scheduled yet.
2. **Implement.** Take the next unchecked task in the current phase, in order unless the task says otherwise. Mark it 🔄 while it's being worked on.
3. **Complete.** Tick the checkbox only when the task is **implemented and verified**: its "Done when" is met, tests pass, and CI is green. Add the date, e.g. `(done 2026-09-24)`.
4. **Close the phase.** When every task in a phase is ticked, change the phase status to ✅ with the date, in both the phase heading and the [Phase overview](#phase-overview), and update the [Status Board](#status-board).
5. **Continue.** When the current roadmap is finished:
   - Move finished phases into [Completed Phases](#completed-phases).
   - Promote items from [Next Product Work](#next-product-work) into new numbered phases.
   - Bump the revision and add a line to the [Changelog](#changelog).
   - Don't create a new file.

### Git Branch Strategy

Each Phase has its own dedicated Git branch.

#### Branch naming

Use:

`phase/<phase-number>-<short-name>`

Examples:

- `phase/0-safe-foundation`
- `phase/1-correct-sla-commitments`
- `phase/2-reliable-zendesk-jira-connections`

#### Branch rules

- All tasks belonging to a Phase must be implemented on that Phase's branch.
- Never implement Phase work directly on `main`.
- Create the Phase branch from the current `main` only after the previous Phase has been completed and merged.
- Do not start the next Phase branch while the current Phase is still open.
- Keep the Phase branch focused on that Phase's tasks. Do not mix unrelated work into it.
- Push the Phase branch to the remote as work progresses. Individual tasks do not require separate PRs.
- When all tasks in the Phase are implemented and verified, open a PR from the Phase branch into `main`.
- The Phase PR must pass remote CI and all required checks before it can be merged.
- Merge the completed Phase PR into `main` before creating the next Phase branch.
- After the merge, update the roadmap with the Phase completion date and final merge commit.
- Never delete or recreate the roadmap to reflect Git progress; update this file in place.

#### Phase lifecycle

```text
main
  ↓
phase/0-safe-foundation
  ↓
implement Phase 0 tasks
  ↓
commit + push as work progresses
  ↓
all Phase 0 tasks complete and verified
  ↓
open PR → main
  ↓
remote CI + required checks
  ↓
merge PR → main
  ↓
Phase 0 = ✅
  ↓
phase/1-correct-sla-commitments
  ↓
implement Phase 1 tasks
  ↓
commit + push as work progresses
  ↓
all Phase 1 tasks complete and verified
  ↓
open PR → main
  ↓
remote CI + required checks
  ↓
merge PR → main
  ↓
Phase 1 = ✅
  ↓
phase/2-reliable-zendesk-jira-connections
  ↓
implement Phase 2 tasks
  ↓
commit + push as work progresses
  ↓
all Phase 2 tasks complete and verified
  ↓
open PR → main
  ↓
remote CI + required checks
  ↓
merge PR → main
  ↓
Phase 2 = ✅
```

#### Task completion verification

A task must not be marked `[x]` based on local implementation alone.

Before marking a task as done, verify all of the following:

- The task's `Done when` criteria are satisfied.
- The implementation is committed on the correct Phase branch.
- Required local tests and type-check pass.
- If the task or Phase requires remote verification, the Phase branch has been pushed to the remote.
- Remote CI is green when CI verification is required.
- If any required verification is still pending, keep the task unchecked and record the current state in its Status line.

Only mark `[x]` when the task is fully implemented and all required verification is complete.

### Legend

| Mark          | Meaning                                             |
| ------------- | --------------------------------------------------- |
| `- [ ]`       | Not started                                         |
| `- [ ] 🔄`    | In progress (only one or two at a time)             |
| `- [ ] ⛔ D#` | Blocked by an open [decision](#product-decisions)   |
| `- [x]`       | Done: implemented **and** verified                  |
| `- [x] ~~…~~` | Dropped; the reason is written inline               |
| ⬜ / 🔄 / ✅  | Phase status: not started / in progress / completed |

**Task tags:** `P0` blocking · `P1` MVP · `P2` post-launch · `P3` nice to have. Kind is one of: Feature, UX, Bug, Security, Reliability, Testing, Infra, Docs. Layer: **A** exists but broken · **B** exists but incomplete · **C** not built yet.
**Refs** such as `E-4` or `I-1` point to [Appendix A — Audit Findings](#appendix-a--audit-findings).

### Rules

- **Fix before build.** Don't start a phase while an earlier phase still has an open `P0`.
- **Phase order is a dependency chain.** Phase 0 → 1 → 2 → 3, then 4 (needs Phase 1 semantics final) → 5 → 6 (needs the Phase 1 import data and the Phase 4 editors) → 7. Tasks inside a phase can be reordered when they don't depend on each other.
- **Engine semantics freeze after Phase 1.** A later phase that finds an engine problem goes back through a decision, then a test, then code. No quiet fixes inside UI work.
- **No real customer account is connected before task 2.1** (token encryption).
- **Product constraints:**
  - No AI.
  - Zendesk is the Case source of truth.
  - Engineering systems are the engineering leg only.
  - Store events, never computed time.
  - No blame language.
  - Customer ≠ Requester.
  - Conversation ≠ Activity Timeline.
  - Multi-tenant everywhere.
  - Deterministic behavior.
  - No unnecessary architecture.

---

## Product Decisions

Decisions that change product behavior. Tick one when it is decided and write the outcome.

- [x] **D1** — Does a new version of the _same_ policy (override, Zendesk re-import, or an edit in the policy UI) change **active** commitments? **Decided: no.** Only a switch to a _different_ policy re-resolves. → 1.1, blocks 4.4
- [x] **D1b** — Does a calendar change on its own (a customer calendar reassigned, or a calendar edited) move active commitments? **Decided: no.** It applies to new commitments only. → 1.1, blocks 4.6
- [x] **D2** — Is a breach final? **Decided: yes.** A target increase never un-breaches a commitment. → 1.2
- [ ] **D3** — After a reopen, does the time spent solved count toward Resolution? Today: yes. _Recommended:_ match Zendesk's behavior (check it first). → blocks 1.4
- [ ] **D4** — Does closing a case end an open Next Reply cycle? Today: no. _Recommended:_ cancel the cycle on close. → blocks 1.5
- [ ] **D5** — First Response when a case is closed with no reply, and on agent-created tickets. Today: counted as met, and the agent's 2nd comment completes it. _Recommended:_ a reply-less close is not "met"; on an agent-created ticket the clock starts at the first customer message. → blocks 1.6
- [ ] **D6** — Match imported Zendesk policies by Zendesk's own `position` order instead of specificity? _Recommended:_ yes. → blocks 1.10
- [ ] **D7** — Does on-hold pause Resolution? Today: no. _Recommended:_ no for MVP, and document it. → blocks 1.7
- [ ] **D8** — Deployment-level transactional email (`TRANSACTIONAL_SMTP_*`) for invites, password resets and verification? _Recommended:_ yes. → blocks 5.1
- [x] **D9** — Intercom in the MVP? **Decided: Beta.** Native policies (Phase 4) give Intercom orgs commitments.
- [x] **D10** — Show the assignee? **Decided: yes, display only.** Store the display name only, never used for analytics or scoring. _Confirm you accept storing agent names._ → 3.6
- [ ] **D11** — Keep the validation-first gate from `plans/05` (outreach recorded as 0 of 40) before scheduling launch? → scheduling only
- [ ] **D12** — How do native and Zendesk-imported policies coexist? _Recommended:_ imported policies are read-only (target overrides only) and match first, by Zendesk position; native policies follow, by specificity. → blocks 4.1

---

## Phase 0 — Safe Foundation

**Status:** ✅ Complete (2026-09-19) · **Estimate:** 2 weeks
**Goal:** The existing product can run for real tenants: no cross-tenant control, no public tunnel, no nondeterministic SLA state.
**Phase is done when:** every task below is ticked, and CI is green with the real-database suites isolated.

- [x] **0.1** Merge `feature/case-conversation-view` into `main` (conversation view, auto-scroll, sidebar, settings overview). `P1 · Infra · —` (done 2026-09-19)
  - Done when: merged, and CI is green on `main`.
  - Status (2026-09-19): merged and pushed — `main` fast-forwarded to `feature/case-conversation-view` @ `8d60c1f` (no conflicts). Remote CI (`gh run list --branch main`) is green for this commit and every commit since.
- [x] **0.2** Only platform operators can change worker settings. `P0 · Security · A` · S-1 (done 2026-09-19)
  - Writes are allowed only when the session email is in `PLATFORM_ADMIN_EMAILS`, checked server-side. Tenants get a read-only view. No new role value is added to `UserRole`.
  - Done when: a route test shows a non-operator owner gets `403`.
  - Status (2026-09-19): implemented — `apps/web/src/lib/authz.ts` now has `isPlatformOperator`/`requirePlatformOperator` (case-insensitive match against `PLATFORM_ADMIN_EMAILS`), replacing the old owner-role check; `POST /api/settings/worker` and both `canEdit` read paths (`worker-settings-data.ts`, the `WorkerSettingsActions` server action) use it. `PLATFORM_ADMIN_EMAILS` documented in `.env.example`, `.env.prod.example`, `docs/deployment.md`. `apps/web/test/worker-settings-route.test.ts` covers a non-operator owner (`403`), signed-out (`401`), and a matched operator (`200`, case-insensitive). Pushed to `main` @ `b7748f4`; remote CI is green.
- [x] **0.3** Remove ngrok from the production compose file (move it to a dev-only profile or override). `P0 · Infra · A` · R-1 (done 2026-09-19)
  - Done when: `docker compose -f docker-compose.prod.yml config` works without `NGROK_AUTHTOKEN`.
  - Status (2026-09-19): the `ngrok` service moved out of `docker-compose.prod.yml` entirely into a new override file, `docker-compose.tunnel.yml` (dev/staging only). `docker compose -f docker-compose.prod.yml config` no longer references `NGROK_AUTHTOKEN` at all — verified directly with `docker compose config` (a Compose `profiles:` gate was tried first but rejected: `docker compose config` validates every service's env interpolation regardless of active profile, so it doesn't satisfy the Done-when check). Opt in with `-f docker-compose.prod.yml -f docker-compose.tunnel.yml`.
- [x] **0.4** Confirm every value ever committed in `.env.prod` has been rotated, and record it in `docs/deployment.md`. `P0 · Security · A` · S-8 _(owner task)_ (done 2026-09-19)
  - Status (2026-09-19): owner ran `scripts/rotate-secrets.sh --apply-to-db .env.prod` against production, rotating `POSTGRES_PASSWORD`, `NEXTAUTH_SECRET`, `INTEGRATION_CONFIG_ENCRYPTION_KEY`, and `SMTP_ENCRYPTION_KEY` — every value that was ever exposed in the `.env.prod` commits tracked in git from `1ec4936` (2026-09-14) to `23c06cb` (2026-09-17). Recorded in `docs/deployment.md`'s new Rotating secrets log.
- [x] **0.5** Stop the 4 test suites that wipe the real database from running in parallel with the others (`vitest.config.ts` `realDatabaseSuites`). `P1 · Testing · A` · T-1 (done 2026-09-19)
  - Status (2026-09-19): the isolation mechanism (a separate `real-database` vitest project with `fileParallelism: false`) was already correct, but 4 real-Postgres suites added since (`next-reply-commitment-persistence.test.ts`, `next-reply-cycle-pipeline.test.ts`, `next-reply-policy-import-e2e.test.ts`, `sla-policy-override-route.test.ts`) had never been added to `realDatabaseSuites`, so they ran in the parallel `unit` project and raced with the isolated suites — reproduced locally (8 failing tests) before the fix, all passing after. `realDatabaseSuites` now lists all 11 suites that truncate tables.
- [x] **0.6** Pick the anchor commitment deterministically (replace `commitments[0]` in `pipeline.ts` and `cycle-pipeline.ts`). `P0 · Bug · A` · E-1 (done 2026-09-19)
  - Done when: a regression test passes where First Response finished on an old policy and Resolution was re-resolved.
  - Status (2026-09-19): added `pickAnchorCommitment` (`packages/commitments/src/pipeline.ts`) — deterministically prefers the `resolution` commitment as anchor/sibling (it outlives `first_response` and keeps re-resolving while open, so it's the fresher source of truth), used by both `pipeline.ts` and `cycle-pipeline.ts` in place of `commitments[0]`. New regression test `apps/web/test/next-reply-cycle-pipeline.test.ts` ("anchors on resolution, not first_response, when a case has both (E-1 regression)") fails without the fix and passes with it.
- [x] **0.7** Serialize SLA processing per organization, in both the worker and the webhook routes (Postgres advisory lock around normalization plus the pipeline tail). `P0 · Reliability · A` · E-3 (done 2026-09-19)
  - Done when: two parallel runs for the same org produce exactly one set of events and commitments.
  - Status (2026-09-19): added `withOrganizationSlaLock` (`packages/db/src/organization-lock.ts`, a per-organization `pg_advisory_xact_lock`), generalized from the existing onboarding-backfill lock in `source-sync.ts` (now itself using the shared helper, so all call sites share one lock namespace). Wraps normalization + the commitment/cycle/evaluation/notification tail in both webhook routes (`apps/web/src/app/api/webhooks/{zendesk,jira}/[integrationId]/route.ts`) and the worker cycle (`apps/worker/src/cycle.ts`, split into an unlocked ingest phase and a locked normalize+tail phase so a slow provider fetch never blocks a webhook). Deliberately excludes ingestion/backfill — network-bound and idempotent, so it never needs to wait. New regression test `apps/web/test/organization-lock.test.ts` proves two concurrent callers for the same org serialize (no interleaving) while two different orgs don't block each other.
- [x] **0.8** Make commitment status writes conditional: never overwrite `cancelled`, and only write when the policy version still matches. `P0 · Bug · A` · E-2 (done 2026-09-19)
  - Status (2026-09-19): `runEvaluationPipeline`'s commitment write (`packages/commitments/src/evaluate-pipeline.ts`) switched from an unconditional `update` to `updateMany` guarded by `{ id, policyVersionId, status: { not: "cancelled" } }`. New regression test `apps/web/test/evaluate-pipeline-conditional-write.test.ts` spies on the read to inject a concurrent cancellation / re-resolution between the read and the write — both fail without the fix (the stale status/policy overwrites the concurrent change) and pass with it.
- [x] **0.9** One retry policy for all provider clients: parse `Retry-After`, cap the number of attempts and the total wait, back off on 5xx and network errors. `P1 · Reliability · A` · I-3 (done 2026-09-19)
  - Status (2026-09-19): new shared package `packages/http-retry` (`fetchWithRetry`) replaces the duplicated, uncapped 429-retry loop in the Zendesk, Jira, Linear, Intercom, and GitHub clients. Fixes the `NaN`-from-a-non-numeric-`Retry-After` immediate-retry-loop bug (I-3), adds a capped number of attempts and a capped total wait, and adds 5xx and thrown-network-error backoff that none of the clients had before. Each provider's own retryable-status predicate is preserved (429 for four of them, GitHub's 403-with-`Retry-After`); on budget exhaustion the function returns the last response rather than throwing, so every client's existing status-code handling (permission-denied, reauth-required, generic ApiError) is unchanged. 9 new unit tests in `packages/http-retry/test/retry.test.ts`; existing provider-client tests that exercised an uncapped 500 updated to use fake timers.
- [x] **0.10** Update `docs/customer-guide.md` §13 and `/docs/sla` to describe _current_ behavior ([Appendix E](#appendix-e--documentation-discrepancies)). `P1 · Docs · A` (done 2026-09-19)
  - Status (2026-09-19): both `docs/customer-guide.md` §13 and `apps/web/src/app/docs/sla/page.tsx` updated — "Priority changes" and "Policy changes" now describe Active-Commitment Re-Resolution (a priority/customer/tier change, or any new version of the currently-matched policy, re-resolves every still-open commitment on the case; only a completed commitment is immutable), and "Reopened tickets" now states explicitly that the solved interval counts as running time after a reopen. Verified rendered in the browser at `/docs/sla`.

---

## Phase 1 — Correct SLA Commitments

**Status:** 🔄 In progress (5/13 tasks done, 2026-09-19: 1.1, 1.2, 1.9, 1.11, 1.12) · **Estimate:** 3 weeks · **Needs:** D3–D7
**Goal:** Every commitment type follows written, tested rules that agree with Zendesk.
**Phase is done when:** all tasks are ticked, the golden scenarios run in CI, and the docs describe the final behavior. **Engine semantics are frozen after this phase.**

**Re-resolution**

- [x] **1.1** Re-resolve active commitments only on the triggers D1 and D1b allow, and record a distinct reason code for each trigger. `P0 · Bug · A` · E-4 (done 2026-09-19)
  - Status (2026-09-19): D1/D1b both decided "no" — only a switch to a genuinely *different* policy re-resolves an active commitment; a new version of the same policy (override/re-import/UI edit) or a calendar change alone never does. `resolveCommitmentPolicyChange` (`packages/core/src/commitments.ts`) now compares the matched version's `policyId` against the commitment's *current* policy's id (not `policyVersionId`), so same-policy version bumps report `changed: false`. `runCommitmentReResolutionPipeline` (`packages/commitments/src/re-resolution-pipeline.ts`) builds a `policyVersionId → policyId` lookup (covering commitments frozen on an archived policy's version too) and passes the commitment's current `policyId` into the comparison. A calendar change alone never touches `matchPolicyVersion`'s result, so it already fell outside `changed` — codified with a new regression test. The single remaining trigger's audit reason was renamed from the vague `policy_driving_attribute_changed` to `policy_switched` (`POLICY_SWITCH_REASON`) to name what it now precisely means. New tests: `packages/core/test/commitments.test.ts` ("D1: reports no change for a new version of the SAME policy") and `apps/web/test/commitment-re-resolution.test.ts` ("D1/D1b: only a switch to a different policy re-resolves"). Full suite: 108 files / 1155 tests passing against real Postgres.
- [x] **1.2** A breach is final (D2): re-resolution skips commitments that are already breached. `P0 · Bug · A` · E-5 (done 2026-09-19)
  - Status (2026-09-19): added `RE_RESOLUTION_ELIGIBLE_WHERE` (`packages/commitments/src/active-commitment.ts`) — same as `ACTIVE_COMMITMENT_WHERE` (still used by evaluation, which must keep evaluating an open breach so `breachedByMinutes` keeps growing) but additionally excludes `status: "breached"`. `runCommitmentReResolutionPipeline` now selects candidate cases/commitments and guards its conditional update with this narrower filter, so a still-open breached commitment is never re-resolved (a target increase can no longer "un-breach" it). New regression test in `apps/web/test/commitment-re-resolution.test.ts` ("never touches a still-open (uncompleted) breached commitment"). Verified locally against a real Postgres (`TEST_DATABASE_URL`): full suite 106 files / 1146 tests passing.
- [ ] **1.3** End-to-end test matrix, starting from Zendesk audit events and running through normalization, re-resolution, evaluation and notification. `P0 · Testing · A` · T-2
  - normal → high (Resolution 2h → 8h) · high → normal (8h → 2h) · normal → urgent
  - customer/organization change · the new policy has no target for this kind
  - finished commitments (met, closed-breached, cancelled) never change
  - breached, then the target increases: stays breached
  - calendar change (per D1b) · an open Next Reply cycle and a future cycle

**Lifecycle rules**

- [ ] ⛔ D3 **1.4** Resolution after a reopen: count or exclude the time spent solved. `P1 · Feature · B` · E-10
- [ ] ⛔ D4 **1.5** Next Reply when a case closes: cancel the open cycle; a reopen followed by a customer reply starts a new one. `P1 · Bug · B` · E-11
- [ ] ⛔ D5 **1.6** First Response for reply-less closes and agent-created tickets. `P1 · Bug · B` · E-12
- [ ] ⛔ D7 **1.7** On-hold behavior pinned by a test and documented. `P1 · Feature · B` · E-13
- [ ] **1.8** Golden SLA scenarios: realistic Zendesk ticket histories with hand-computed results, running in CI. `P1 · Testing · C`
  - They cover pending_customer, several unanswered customer messages, consecutive agent replies, private notes, reopen, solved → closed, a holiday, and DST.

**Policy matching**

- [x] **1.9** A policy whose organization condition references an org we haven't seen yet must match **no** cases. Today it can end up matching every case. `P0 · Bug · A` · E-7 (done 2026-09-19)
  - Status (2026-09-19): `extractMatchFromFilter` (`packages/zendesk/src/policies.ts`) now sets `match.customerIds = []` (an explicit "matches nothing", per `matchPolicyVersion`/`matches` in `packages/core/src/commitments.ts`) whenever the filter names at least one `organization_id` condition but none of them resolve to a known Customer — previously it left `match.customerIds` unset, which `matches()` reads as "no org restriction" (match-all). Updated `packages/zendesk/test/policies.test.ts`'s test that had asserted the old (buggy) behavior, and added a case mixing one resolved and one unresolved org id in the same OR-set. Verified locally against a real Postgres: full suite 106 files / 1147 tests passing.
- [ ] ⛔ D6 **1.10** Match imported policies by Zendesk `position`. `P1 · Bug · B` · E-6
- [x] **1.11** Archive policies that were deleted in Zendesk (new `SLAPolicy.archivedAt`), and exclude them from matching. `P1 · Bug · B` · E-9 (done 2026-09-19)
  - Status (2026-09-19): added `SLAPolicy.archivedAt DateTime?` (migration `20260919005801_add_sla_policy_archived_at`). `backfillSlaPolicies` (`packages/zendesk/src/backfill.ts`) now also writes a `sla_policy_manifest:<hash>` RawEvent (`mapSlaPolicyManifestToRawEvent`) listing every policy id seen in that run's full listing — the only way to tell "deleted in Zendesk" apart from "not fetched yet", since deletion has no event of its own. `runZendeskSlaPolicyImport` reads the latest manifest and archives any previously-imported `SLAPolicy` whose id is missing from it (new `policiesArchived` field on `SlaPolicyImportResult`); absent a manifest (integration hasn't run the new backfill yet) nothing is archived, matching prior behavior. Archived policies are excluded from matching in all three places `SLAPolicyVersion` is queried for matching (`packages/commitments`'s `pipeline.ts`, `cycle-pipeline.ts`, `re-resolution-pipeline.ts`, all now filtering `policy: { archivedAt: null }`); `evaluate-pipeline.ts`'s by-id lookup for already-frozen commitments is untouched, so existing commitments on an archived policy still evaluate normally. New suite `apps/web/test/zendesk-sla-policy-archive.test.ts` (added to `realDatabaseSuites`). Verified locally against a real Postgres: full suite 107 files / 1150 tests passing; `apps/web`'s `tsc --noEmit` clean.
- [x] **1.12** Store the import results per organization (unsupported conditions and metrics, unresolved schedules, cases with no matching policy) so the UI can show them. `P1 · Feature · B` · E-8, E-16 (done 2026-09-19)
  - Status (2026-09-19): new `SlaImportSummary` model (migration `20260919010334_add_sla_import_summary`) — one row per organization, overwritten on every sync (a snapshot of the latest run, not a history). `recordSlaImportSummary` (`packages/db/src/sla-import-summary.ts`) upserts it from a plain `{unsupportedConditions, unsupportedMetrics, policiesWithNoUsableTargets, policiesWithUnresolvedSchedule, policiesArchived, casesWithNoMatchingPolicy}` input, explicitly listing fields rather than spreading a pipeline result (the raw `SlaPolicyImportResult`/commitment-pipeline results carry extra fields Prisma would reject). Wired into both places a Zendesk sync completes: `apps/web/src/lib/source-sync.ts`'s `projectAndEvaluateSourceSyncs` (onboarding backfill + webhook DB-tail) and `apps/worker/src/cycle.ts`'s per-organization cycle (which previously discarded `runZendeskSlaPolicyImport`'s result entirely). `casesWithNoMatchingPolicy` comes from the same sync's `runCommitmentPipeline` call, so the numbers describe one consistent pass. No UI yet — reading this table for the review screen is Phase 6.7. New suites `apps/web/test/sla-import-summary.test.ts` and the archival coverage in `apps/web/test/zendesk-sla-policy-archive.test.ts` (both in `realDatabaseSuites`). Verified locally against a real Postgres: full suite 108 files / 1152 tests passing; `apps/web` and `apps/worker`'s `tsc --noEmit` both clean.

**Docs**

- [ ] **1.13** Update customer guide §13 and `/docs/sla` to the final rules. `P1 · Docs · B`

---

## Phase 2 — Reliable Zendesk + Jira Connections

**Status:** ⬜ Not started · **Estimate:** 3 weeks
**Goal:** Connecting Zendesk and Jira is secure, robust, and proven against the real services.
**Phase is done when:** all tasks are ticked, including every live check in 2.9.

- [ ] **2.1** Encrypt Zendesk, Jira, Intercom, Linear, GitHub and Slack tokens at rest using the existing AES-GCM helper, and migrate existing rows with an idempotent script. `P0 · Security · A` · I-1
  - Done when: no plaintext token is left in the database, and a refresh race test passes for every provider.
- [ ] **2.2** Sign the OAuth `state` and bind it to both the user and the organization. `P1 · Security · B` · I-2
- [ ] **2.3** Let users disconnect Slack. `P1 · Feature · B` · I-9
- [ ] **2.4** A Zendesk webhook re-processes only the affected ticket, not the whole integration. `P1 · Reliability · B` · I-4
- [ ] **2.5** Rate-limit webhooks per integration, not per IP address. `P1 · Reliability · B` · I-5
- [ ] **2.6** Jira: handle deleted issues, and unlink a case when its remote link is removed. `P1 · Feature · B` · I-6
- [ ] **2.7** Reconnecting to a _different_ Zendesk subdomain or Jira site either resets the sync position or is refused with a clear message. `P1 · Bug · B` · I-7
- [ ] **2.8** Route tests for the webhook receivers, OAuth callbacks and disconnect. `P1 · Testing · B` · T-3
- [ ] **2.9** Live verification against real accounts, with each result and date recorded here. `P0 · Testing · B` · I-14
  - [ ] A real Zendesk trigger delivery (`{{ticket.updated_at_with_timestamp}}`)
  - [ ] A signed Jira Cloud webhook delivery
  - [ ] GitHub App connect, an 8-hour token refresh, and whether `Contents: read` can be dropped
  - [ ] Permission-loss and reconnect drill
  - [ ] Real Zendesk backfill, including policy and calendar import
- [ ] **2.10** Label Intercom, Linear and GitHub as **Beta** in the UI and docs, with their known gaps. `P1 · UX · B` · D9

---

## Phase 3 — Explainable Cases

**Status:** ⬜ Not started · **Estimate:** 3 weeks
**Goal:** Opening a case explains its SLA completely: what the target is, which policy applies and why, what changed, when it breached, who owns it.
**Phase is done when:** all tasks are ticked, and a component test shows Conversation and Activity Timeline stay separate.

**Activity Timeline**

- [ ] **3.1** Record priority changes as a display-only `priority_changed` event from Zendesk audits (Intercom too, if available). The SLA engine and matching ignore it. `P1 · Feature · B` · E-14
- [ ] **3.2** Show a "policy / target changed" timeline item for each recorded re-resolution. `P1 · UX · B` · C-2
- [ ] **3.3** Show SLA lifecycle markers: commitment started, at-risk threshold crossed, breached at, met, cancelled. They are derived from existing data; nothing new is stored. `P1 · UX · B` · C-2

**Commitment card and case header**

- [ ] **3.4** Commitment card shows:
  - the target
  - the policy name and version
  - plain-language matched conditions
  - started, due and breached-at times
  - target-change history, with the reason (priority change, or "policy re-matched")
  - `P1 · UX · B` · C-3
- [ ] **3.5** Show the current ticket status in the case header. `P1 · UX · B` · C-4
- [ ] **3.6** Show the assignee in the case header (D10). `P1 · Feature · C` · C-4
  - Add `Case.assigneeName`, taken from the Zendesk assignee and the Intercom `admin_assignee_id`. Display only.
  - Add a privacy note to the customer guide.

**Conversation**

- [ ] **3.7** Deduplicate messages by source comment or part id. Show clearer sender labels (customer / agent / requester). Show the opening message on tickets created by the system. `P1 · UX · B` · C-5
- [ ] **3.8** Component tests: ordering, and that the Conversation never contains SLA or timeline items. `P1 · Testing · B`

**Alerts**

- [ ] **3.9** Slack and email alerts include a link to the case, plus customer, policy, target, start and breach times. `P1 · Feature · B` · E-19, I-8
- [ ] **3.10** Send each alert email to one recipient at a time instead of listing everyone in `To`. `P1 · Security · B` · S-10

---

## Phase 4 — SLA Policy & Calendar Management

**Status:** ⬜ Not started · **Estimate:** 4 weeks · **Needs:** D1, D1b, D12
**Goal:** Organizations can see, create and edit SLA policies and business calendars inside Watchtower, with every change versioned.
**Phase is done when:**

- An organization with no Zendesk SLA policies (including an Intercom organization) gets commitments from policies it created itself.
- Edits to a calendar that came from Zendesk survive the next Zendesk sync.

**Policies**

- [ ] ⛔ D12 **4.1** Policy source model (`imported` / `native`) and a single, deterministic precedence rule between them. `P1 · Feature · C`
- [ ] **4.2** Policies page: active/inactive, current version, conditions, targets, source, created and updated dates. `P1 · Feature · C`
- [ ] **4.3** Create a policy. `P1 · Feature · C`
  - Fields: name; conditions (priority, customers, tier — tier shows as "no data source yet"); targets for First Response, Next Reply and Resolution; calendar; warning thresholds.
  - No rules engine.
- [ ] ⛔ D1 **4.4** Edit a policy (every edit creates a new version), and deactivate or reactivate it. `P1 · Feature · C`

**Calendars**

- [ ] **4.5** Record where each calendar version came from, and make the Zendesk import compare only against the latest _imported_ version, so local edits are never overwritten. Must be done before 4.6. `P0 · Bug · A` · E-18
- [ ] ⛔ D1b **4.6** Calendar editor: timezone, working days and hours, and holidays with names. Recurring holidays are expanded into dates when saved, so the SLA engine doesn't change. `P1 · Feature · C`
- [ ] **4.7** Calendar assignment: an organization default calendar, a calendar picker on native policies, and the existing customer override. The commitment card explains which calendar applies and why. `P1 · Feature · C`
- [ ] **4.8** Tests: precedence between mixed policy types, an import after a local edit, and tenant isolation for the new models. `P1 · Testing · C`

---

## Phase 5 — Team & Account Management

**Status:** ⬜ Not started · **Estimate:** 2 weeks · **Needs:** D8
**Goal:** A support team can share one organization safely, and handle accounts without developer help.
**Phase is done when:** all tasks are ticked, and a member gets `403` on every owner-only action.

- [ ] ⛔ D8 **5.1** Transactional email configured at the deployment level. `P1 · Infra · C`
- [ ] **5.2** Invitations: invite by email, then accept via a single-use link that expires. `P1 · Feature · C` · S-2
- [ ] **5.3** Members page: list members, change roles, remove members. `P1 · Feature · C` · S-2
- [ ] **5.4** Authorization audit of every mutation.
  - **Owner:** configuration, integrations, SMTP, policies, calendars, members.
  - **Member:** view and work cases.
  - The platform operator stays configured only through the environment, never as an organization role.
  - `P1 · Security · C` · S-3
- [ ] **5.5** Change password, and reset a forgotten password. `P1 · Security · C` · S-4
- [ ] **5.6** Email verification, and changing email with re-verification. `P1 · Security · C` · S-4
- [ ] **5.7** Sign users out when their password changes or they are removed (`User.sessionVersion`), and shorten session lifetime. `P1 · Security · C` · S-5
- [ ] **5.8** Organization settings: name, and a display timezone used to group days on the dashboard. It is never used in SLA calculations. `P2 · Feature · C` · S-6
- [ ] **5.9** Profile page. `P2 · Feature · C` · S-6

---

## Phase 6 — SLA Health Dashboard & Guided Onboarding

**Status:** ⬜ Not started · **Estimate:** 2 weeks
**Goal:**

- The dashboard shows SLA health by commitment type and everything that is silently _not_ being monitored.
- A new organization reaches a monitored state by itself.

**Phase is done when:** a fresh organization completes onboarding against a real Zendesk sandbox, and no configuration warning exists only in logs.

**Dashboard**

- [ ] **6.1** On track / at risk / breached for each of First Response, Next Reply and Resolution. `P1 · Feature · B` · D-2
- [ ] **6.2** Panel listing open cases that have no matching SLA policy, with links to them. `P1 · Feature · B` · D-3
- [ ] **6.3** Integration health: re-auth needed, permission denied, last sync error. `P1 · Feature · B` · D-3
- [ ] **6.4** Failed alert deliveries. `P1 · Feature · B` · D-3
- [ ] **6.5** Group dashboard days by the organization timezone (needs 5.8). `P2 · UX · B`

**Onboarding**

- [ ] **6.6** Guided flow: create account → connect Zendesk → initial sync → import policies → review policies → configure calendars → configure alerts → optional Jira → ready. `P1 · UX · B`
- [ ] **6.7** Import review screen: Imported / Matched / No match / Warnings, from the data stored in 1.12. `P1 · UX · B`
- [ ] **6.8** Walk through onboarding with a fresh organization against a real Zendesk sandbox, and record the result. `P1 · Testing · B`

---

## Phase 7 — Production Launch

**Status:** ⬜ Not started · **Estimate:** 5 weeks
**Goal:** The first real customer runs on a verified, observable, recoverable deployment.
**Phase is done when:** every item in the [Launch Gate](#launch-gate) is ticked, or explicitly accepted as an exception.

**Deployment and recovery**

- [ ] **7.1** A one-shot migration service. Startup order: `postgres (healthy)` → `migrate (completed)` → `web` and `worker`, which start independently. `P1 · Infra · B` · R-2
- [ ] **7.2** A real server behind a TLS reverse proxy, with secure cookies, HSTS, the CSRF origin check, and `X-Forwarded-For` all verified. `P0 · Infra · B` · R-3
- [ ] **7.3** Scheduled backups with a retention policy and an off-site copy, plus a real restore drill with its timing recorded. `P0 · Infra · B` · R-4

**Observability**

- [ ] **7.4** Structured JSON logs that carry the organization, integration, cycle and stage. `P1 · Reliability · B` · R-5
- [ ] **7.5** Operator monitoring view: failed webhooks and failed syncs across all organizations. `P1 · Feature · B`
- [ ] **7.6** Sentry source maps. `P2 · Reliability · B` · R-6

**Performance**

- [ ] **7.7** Performance baseline with 5,000 cases and 200,000+ events (case list, dashboard, case detail, evaluation, worker, database queries). Fix the slowest part based on the measurements. `P1 · Reliability · C` · D-5
- [ ] **7.8** Use a wider hash for evaluation ids. `P2 · Reliability · A` · E-17

**Release verification**

- [ ] **7.9** Smoke end-to-end test with a stubbed provider: signup → connect → import → case → SLA → customer reply → agent reply → breach → alert. `P0 · Testing · C`
- [ ] **7.10** The 7 golden scenarios are required in CI, and a lint step is added. `P0 · Testing · C`
  1. normal → high
  2. high → normal
  3. breached, then target increases
  4. Next Reply cycles
  5. Resolution pause and resume
  6. reopen
  7. calendar change
- [ ] **7.11** Final docs, answers on data retention and deletion, and an on-call note. `P1 · Docs · B`
- [ ] **7.12** Pass the [Launch Gate](#launch-gate). `P0 · — · —`

---

## Launch Gate

Tick each item at the end of Phase 7. Every item must be ticked, or recorded as an accepted exception, before the first real customer.

**Product**

- [ ] A Zendesk + Jira organization goes from sign-up to monitoring without help.
- [ ] Policies and calendars can be created, edited and deactivated, with versioning. Edits survive a Zendesk sync.
- [ ] Members, invites, and owner/member roles work. Account self-service works.
- [ ] The dashboard shows health by commitment type and has no blind spots.
- [ ] Intercom, Linear and GitHub are labelled Beta.

**SLA correctness**

- [ ] D1–D7 are decided, implemented and documented. The golden scenarios pass.
- [ ] Imported policy selection matches Zendesk. No policy can match every case by accident. Native/imported precedence is deterministic.
- [ ] Engine numbers spot-checked against Zendesk on real tickets.

**Security**

- [ ] Worker settings are operator-only. Tokens are encrypted. The OAuth state is signed.
- [ ] Every leaked secret has been rotated. No development services in production.
- [ ] Authorization audit complete. Session revocation works. Tenant isolation covers the new models.

**Reliability and operations**

- [ ] Automatic migrations and health-gated startup. Backups tested by a real restore.
- [ ] Structured logs, Sentry and a worker-stall alert. Failed syncs, webhooks and alerts are visible.
- [ ] Capacity limits measured and documented.

**Experience**

- [ ] Commitment cards explain the target, the policy, why it matched, the calendar, and change history.
- [ ] The timeline shows the SLA lifecycle. The Conversation shows only messages. Alerts link to the case.
- [ ] No blame-oriented language anywhere.

---

## Next Product Work

The backlog. When the current roadmap is finished, promote items from here into new numbered phases.

**Candidate Phase 8 — Intercom out of Beta**

- [ ] Intercom webhooks (replace polling) · I-11
- [ ] Handle deleted Intercom conversations · I-11
- [ ] Engineering links (Jira/Linear) for Intercom cases · I-10
- [ ] Keep Customer and Requester separate for Intercom contacts with no company · C-7

**Candidate Phase 9 — Engineering-leg depth**

- [ ] Linear and GitHub webhooks · I-11
- [ ] Linear refresh-token model, and handling for GraphQL rate limits · I-11
- [ ] GitHub links found by pattern matching → `probable` confidence · I-12
- [ ] Jira: detect issue keys in ticket fields (deterministic rule only) · I-6

**Candidate Phase 10 — Account data**

- [ ] Tier data source (e.g. a Zendesk organization field → `Customer.tier`) · E-15

**Platform (schedule alongside a product phase when needed)**

- [ ] Rate limiting shared across instances, and multiple web instances · R-7
- [ ] Encryption-key rotation that keeps the old key readable during the switch · S-7
- [ ] Fold the duplicated row→domain mappers into shared code

### Out of scope (for now)

- AI features: predictions, summaries, recommendations.
- Service credits and financial calculations.
- Automatic escalation or write-back into source systems.
- Per-agent or team SLA scoring, blame scoring, or assignee analytics.
- A generic connector framework.
- SSO/SAML and a public API (parked in [`ignored.md`](ignored.md)).
- Horizontal scaling across multiple workers.
- Complex role management beyond owner and member.
- Configurable pause states, or a rules engine.
- An SLA policy engine specific to Intercom or Linear.
- GitHub as an SLA source.

---

## Completed Phases

_Finished phases move here, with their completion date, when a roadmap cycle ends. Keep their task lists as the record._

_None yet in this roadmap. Earlier work (steps 0–44) is recorded in [`roadmap-completed.md`](roadmap-completed.md) and summarized in [Product Baseline](#product-baseline)._

---

## Product Baseline

What already exists as of 2026-09-19. This is the starting point for Phase 0. The full audit is in [Appendix A](#appendix-a--audit-findings) and [Appendix B](#appendix-b--baseline-snapshot-2026-09-19).

| Capability                                                                                       | State                                                       | Finished in          |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | -------------------- |
| SLA engine: First Response, Next Reply cycles, Resolution, calendars, DST, holidays, pause rules | 🟡 Built and unit-tested; some rules still to decide        | Phase 1              |
| Active commitment re-resolution with audit trail                                                 | 🟡 Built; trigger rules and end-to-end tests still missing  | Phase 1              |
| Policy matching and policy versions (Zendesk import, target overrides)                           | 🟡 Built; doesn't fully match Zendesk                       | Phases 1, 4          |
| Zendesk and Jira integrations (OAuth, backfill, webhooks)                                        | 🟡 Built; needs hardening and live checks                   | Phase 2              |
| Intercom, Linear and GitHub integrations                                                         | 🟡 Built, polling only                                      | Phase 2 (Beta), Next |
| Slack and email alerts with deduplication                                                        | 🟡 Built; no case link in Slack, no Slack disconnect        | Phases 2, 3          |
| Dashboard, analytics, anomaly detection, CSV export                                              | 🟡 Built; no per-type breakdown, blind spots                | Phase 6              |
| Case list; case detail with Conversation and Activity Timeline                                   | 🟡 Built; timeline and cards incomplete                     | Phase 3              |
| Settings: SLA (overrides, customer calendars), notifications, monitoring, integrations           | 🟡 Built; no policy or calendar editor                      | Phase 4              |
| Members, account, organization settings                                                          | 🔴 Missing                                                  | Phase 5              |
| Onboarding and findings                                                                          | 🟡 Built; no policy review step                             | Phase 6              |
| Authentication and tenant isolation                                                              | 🟡 Data isolation done; roles, reset and revocation missing | Phases 0, 5          |
| Worker, Docker, Sentry, backups, CI                                                              | 🟡 Built; production gaps remain                            | Phases 0, 7          |

---

## Changelog

- **Rev 3 (2026-09-19):** Restructured into the living product roadmap: status board, working rules, phases with checkbox tasks, backlog. Moved the audit into appendices.
- **Rev 2 (2026-09-19):** Merged `RENEW_ROADMAP.md` (product-completion scope: policy and calendar UI, members and account, assignee) and made 27 corrections to it ([Appendix C](#appendix-c--review-of-renew_roadmapmd)).
- **Rev 1 (2026-09-19):** Full repository audit and hardening roadmap.

---

# Appendices (reference)

> Reference material from the 2026-09-19 audit. Tasks above cite these IDs. Week references (`W1`–`W24`) come from the Rev 2 weekly plan: W1–2 → Phase 0 · W3–5 → Phase 1 · W6–8 → Phase 2 · W9–11 → Phase 3 · W12–15 → Phase 4 · W16–17 → Phase 5 · W18–19 → Phase 6 · W20–24 → Phase 7.

---

## Appendix A — Audit Findings

Each finding has an ID that the weekly plan refers to.

#### Engine (E)

| ID   | Finding                                                                                                                                                                                                                                                                                                                                                                | Tag                                                           | Evidence                                                                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E-1  | The anchor/sibling commitment is picked in no defined order. New kinds and next-reply cycles copy the policy of `caseRow.commitments[0]`, and the query has no `orderBy`. After a partial re-resolution (e.g. first response met on its old policy, resolution moved), future cycles can inherit the wrong policy.                                                     | Verified                                                      | `packages/commitments/src/pipeline.ts:213`, `packages/commitments/src/cycle-pipeline.ts:134`                                                              |
| E-2  | The evaluation pipeline writes `status` / `closedAt` without any condition. It can overwrite a concurrent `cancelled`, or write a status computed under an older target.                                                                                                                                                                                               | Verified                                                      | `packages/commitments/src/evaluate-pipeline.ts:442-449`                                                                                                   |
| E-3  | The webhook tail (normalize, commitments, re-resolution, cycles, evaluation, notifications) runs in the web process, outside the worker's advisory lock. Normalization is delete-then-create per case, and `NormalizedEvent` has no unique key, so concurrent runs can duplicate events.                                                                               | Verified (race); duplicates _Needs validation_                | `apps/web/src/lib/webhook-pipeline.ts`, `apps/web/src/app/api/webhooks/zendesk/[integrationId]/route.ts:104-105`, `packages/zendesk/src/normalize.ts:438` |
| E-4  | Re-resolution compares the _latest version id_ of each policy. So **any new version of the same policy** moves every active commitment onto it: a manual override, a Zendesk target change, or a Zendesk calendar change. The audit reason logged is still `policy_driving_attribute_changed`. This contradicts the docs, which say edits only affect new commitments. | Verified                                                      | `packages/commitments/src/re-resolution-pipeline.ts`, `packages/core/src/commitments.ts:resolveCommitmentPolicyChange`                                    |
| E-5  | An open commitment that has already breached is re-resolved. A larger target turns it back to on_track or at_risk ("un-breach"). No test covers this.                                                                                                                                                                                                                  | Verified                                                      | `re-resolution-pipeline.ts` (`ACTIVE_COMMITMENT_WHERE` includes open breached)                                                                            |
| E-6  | Matching is by specificity (priority, customer, tier count equally), then version, then id. Zendesk's own policy `position` ordering (first match wins) is ignored, so the matched policy can differ from Zendesk's.                                                                                                                                                   | Verified                                                      | `packages/core/src/commitments.ts:12-70`, `packages/zendesk/src/policies.ts`                                                                              |
| E-7  | A Zendesk org condition that points at an org with no `Customer` row yet is dropped silently. If that leaves `match` empty, the policy becomes **match-all**.                                                                                                                                                                                                          | Verified                                                      | `packages/zendesk/src/policies.ts` (`extractMatchFromFilter`)                                                                                             |
| E-8  | Unsupported conditions (group, tags, form, type) are dropped. They are counted but never shown, so the policy matches more broadly than it does in Zendesk.                                                                                                                                                                                                            | Verified                                                      | `policies.ts` `SUPPORTED_CONDITION_FIELDS`                                                                                                                |
| E-9  | Policies deleted or deactivated in Zendesk are never archived. Their last version stays a matching candidate forever.                                                                                                                                                                                                                                                  | Verified (no archive field); live behavior _Needs validation_ | `schema.prisma` `SLAPolicy`, `latestVersionPerPolicy`                                                                                                     |
| E-10 | After a reopen, the solved interval counts as running resolution time. A test pins this as current behavior.                                                                                                                                                                                                                                                           | Verified                                                      | `packages/core/test/clock-window.test.ts:280-302`                                                                                                         |
| E-11 | An unanswered next-reply cycle is not completed by a case close. A customer "thanks!" after the solve keeps a cycle open until it breaches.                                                                                                                                                                                                                            | Verified                                                      | `packages/core/src/reply-cycles.ts:40-52`                                                                                                                 |
| E-12 | First Response completes on the first public agent reply **or** the first close. A reply-less solve counts as met. On an agent-created ticket, the agent's _second_ public comment completes first response.                                                                                                                                                           | Verified                                                      | `packages/core/src/evaluate.ts:151-163`, `packages/zendesk/src/normalize.ts:225`                                                                          |
| E-13 | Zendesk `hold` maps to `pending_internal` and does not pause resolution. Only `pending_customer` pauses.                                                                                                                                                                                                                                                               | Verified                                                      | `packages/zendesk/src/normalize.ts:10`, `policies.ts` `PAUSE_ON_STATES`                                                                                   |
| E-14 | Priority, organization, and assignee changes are not NormalizedEvents. `Case.priority` is a mutable projection with no event history, and re-resolution records `changedAt` as the time the worker ran, not when the change happened.                                                                                                                                  | Verified                                                      | `packages/core/src/types.ts:26-38`                                                                                                                        |
| E-15 | Tier is never populated by any source, so tier matching is dead code (documented).                                                                                                                                                                                                                                                                                     | Verified                                                      | `docs/customer-guide.md` §21                                                                                                                              |
| E-16 | Import coverage (unsupported conditions / metrics, unresolved schedules) and "no matching policy" counts are only returned or logged. They never reach the UI or the DB.                                                                                                                                                                                               | Verified                                                      | No references under `apps/web/src`, `apps/web/modules`                                                                                                    |
| E-17 | Evaluation ids are a 32-bit FNV hash, written with `skipDuplicates`, so a collision silently drops a snapshot.                                                                                                                                                                                                                                                         | Verified (low probability)                                    | `packages/core/src/util.ts`                                                                                                                               |
| E-18 | The Zendesk calendar import compares against the latest calendar version from **any** source, and appends a new imported version whenever they differ. A calendar edited locally (the planned calendar UI) would be overwritten on the next sync. Policies avoid this with `PolicyVersionSource`; calendars have no equivalent.                                        | Verified                                                      | `packages/zendesk/src/calendars.ts:87-110`                                                                                                                |
| E-19 | Slack alerts contain no case link and no policy or target context. Only email can carry `caseUrl`.                                                                                                                                                                                                                                                                     | Verified                                                      | `packages/notifications/src/format.ts` (`formatSlackMessage`)                                                                                             |

#### Integrations (I)

| ID   | Finding                                                                                                                                                                                                                                                                     | Tag                                           | Evidence                                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| I-1  | Provider OAuth access and refresh tokens (`Integration.credentials`) and the Slack bot token are stored in **plaintext**. Only OAuth client secrets and SMTP passwords are encrypted.                                                                                       | Verified                                      | `schema.prisma` `Integration.credentials`, `SlackIntegration.accessToken`; no `encrypt` in any callback route |
| I-2  | OAuth `state` is an unsigned base64 JSON double-submit cookie (600 s). It is bound to the organization but not to the user, and there is no server-side nonce.                                                                                                              | Verified                                      | `apps/web/src/lib/oauth-state.ts`                                                                             |
| I-3  | The 429 handler retries recursively with no cap. A non-numeric `Retry-After` gives `NaN`, which becomes an immediate retry loop. There is no 5xx or network backoff (recovery waits for the next cycle). The same pattern appears in the Jira, Intercom and Linear clients. | Verified (Zendesk); others _Needs validation_ | `packages/zendesk/src/client.ts:66-70`                                                                        |
| I-4  | The Zendesk webhook re-normalizes the **whole integration**, then runs the full org pipeline synchronously inside `maxDuration=60`.                                                                                                                                         | Verified                                      | `apps/web/src/app/api/webhooks/zendesk/[integrationId]/route.ts:16,104-105`                                   |
| I-5  | The webhook rate limit is 60/min per IP, in memory. A busy Zendesk account could be throttled.                                                                                                                                                                              | Needs validation                              | `apps/web/src/proxy.ts`                                                                                       |
| I-6  | Jira `issue_deleted` is ignored. Removing a remote link never produces `issue_unlinked`. Correlation is only via remote links to the connected Zendesk subdomain; issue keys in ticket fields are not scanned.                                                              | Verified                                      | `packages/jira/src/webhook.ts`, `packages/jira/src/correlate.ts`                                              |
| I-7  | Reconnecting to a _different_ Zendesk subdomain or Jira site reuses the old cursor and integration row, which mixes data.                                                                                                                                                   | Needs validation                              | reconnect callbacks upsert credentials without touching `cursor`                                              |
| I-8  | Alerts triggered from webhooks have no case link (no `appUrl` passed).                                                                                                                                                                                                      | Verified                                      | `apps/web/src/lib/webhook-pipeline.ts` (`runNotificationPipeline` call)                                       |
| I-9  | There is no Slack disconnect route or UI.                                                                                                                                                                                                                                   | Verified                                      | `apps/web/src/app/api/integrations/slack/*`                                                                   |
| I-10 | SLA policies and calendars come **only** from the Zendesk import. An Intercom-only org gets no commitments (documented). Jira and Linear link only to Zendesk.                                                                                                              | Verified                                      | `apps/web/src/app/docs/integrations/intercom/page.tsx:290-306`                                                |
| I-11 | Intercom, Linear and GitHub are polling-only. Deleted Intercom conversations are not handled. The Linear refresh-token model and GraphQL `RATELIMITED` handling need validation. GitHub search caps at about 1,000 results and doesn't handle a plain 429.                  | Verified / Needs validation                   | package sources                                                                                               |
| I-12 | A GitHub PR linked by regex pattern is recorded as `confidence: certain`.                                                                                                                                                                                                   | Verified; debatable                           | `packages/github/src/correlate.ts`                                                                            |
| I-13 | Disconnect never revokes provider tokens (documented reasons). Credentials are nulled; raw history is kept.                                                                                                                                                                 | Verified; acceptable                          | disconnect routes                                                                                             |
| I-14 | Nothing has been verified live yet: a real Zendesk trigger delivery, a signed Jira delivery, a GitHub App connect with an 8 h refresh.                                                                                                                                      | Verified (open in step 41)                    | `implementation-plans/roadmap-completed.md` steps 38, 41, 43                                                  |

#### Case experience (C)

| ID  | Finding                                                                                                                                                                                                                                                 | Tag                        | Evidence                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------- |
| C-1 | Conversation and Activity Timeline are separate data paths and components (`buildConversationMessages` vs `timeline`). This matches the product decision.                                                                                               | Verified ✅                | `apps/web/src/lib/case-detail-data.ts:197,401`                             |
| C-2 | The Activity Timeline shows only NormalizedEvents. **Missing:** priority changes (E-14), `CommitmentPolicyChange` rows (never read by the UI), and the SLA lifecycle (started, at-risk crossed, breached at, met, cancelled).                           | Verified                   | `case-detail-data.ts:401-409`; no `policyChange` reference in `apps/web`   |
| C-3 | Commitment cards show the countdown, deadline, and "how this was calculated" (policy version, match, pause states, calendar). **Missing:** the explicit target value, the policy _name_, a plain-language "why this policy", and target-change history. | Verified                   | `case-detail-data.ts:232-262`                                              |
| C-4 | The case header shows no assignee (not ingested anywhere) and no current ticket status.                                                                                                                                                                 | Verified                   | `schema.prisma` `Case`; header props                                       |
| C-5 | Conversation text is paired with events by index within each Zendesk audit. There is no explicit dedupe; it relies on normalization producing unique events (see E-3).                                                                                  | Verified / Needs hardening | `case-detail-data.ts:560-587`                                              |
| C-6 | Agent names are never stored (privacy minimization). Only the requester is named.                                                                                                                                                                       | Verified; deliberate       | `case-detail-data.ts:502-506`                                              |
| C-7 | Requester and Customer are kept separate (`requesterName` vs `Customer`). For Intercom, a per-contact Customer is created when there is no company, which blurs that separation.                                                                        | Verified                   | `schema.prisma` `Case.requesterName`, `packages/intercom/src/normalize.ts` |

#### Dashboard & analytics (D)

| ID  | Finding                                                                                                                                                                   | Tag                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| D-1 | Present: breaches in period, compliance (current vs previous), breaches over time, breaches by leg, at-risk list, aging in engineering, cycle-time anomalies, CSV export. | Verified                                 |
| D-2 | No breakdown of compliance by commitment kind (First Response / Next Reply / Resolution).                                                                                 | Verified                                 |
| D-3 | No visibility into cases with no matching policy, integration health, or failed alert deliveries.                                                                         | Verified                                 |
| D-4 | Per-agent and per-team metrics don't exist and are _deliberately_ out of scope (no blame language; team mapping is on the DO NOT BUILD list).                             | Verified; keep out                       |
| D-5 | Every render evaluates every open commitment live and loads all of their events. Auto-refresh ticks at `activePollIntervalMs − 2 s`. This is a scale risk.                | Verified; size limits _Needs validation_ |

#### Settings, auth & tenancy (S)

| ID   | Finding                                                                                                                                                                                                                                          | Tag                      | Evidence                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------- |
| S-1  | **`WorkerSettings` is a single row for the whole deployment, and any org owner can edit it.** Every self-signup is an owner, so any stranger can change polling for all tenants.                                                                 | Verified, P0             | `apps/web/src/app/api/settings/worker/route.ts:20`, `apps/web/src/lib/authz.ts` |
| S-2  | No invites or members: one user per org. The `member` role is never assigned.                                                                                                                                                                    | Verified                 | `apps/web/src/app/api/sign-up/route.ts`                                         |
| S-3  | Every other mutation (integrations connect/disconnect/config/backfill, SMTP, overrides, calendars, engineering target, concierge export) is open to any signed-in user.                                                                          | Verified                 | `authz.ts` comment                                                              |
| S-4  | No password reset, no password change, no email verification.                                                                                                                                                                                    | Verified                 | grep                                                                            |
| S-5  | JWT sessions use the 30-day default. Role and org are baked into the token and never re-checked, so there is no revocation.                                                                                                                      | Verified                 | `apps/web/src/lib/auth.ts:46,120-135`                                           |
| S-6  | No org, account, or profile settings. The user menu only has sign-out.                                                                                                                                                                           | Verified                 |                                                                                 |
| S-7  | Encryption keys have no two-key rotation. Rotating one makes stored ciphertext unreadable.                                                                                                                                                       | Verified (documented)    | `scripts/rotate-secrets.sh`                                                     |
| S-8  | `.env.prod` was pushed to `origin/main` history in the past (removed in `23c06cb`). A rotation happened on 2026-09-16. Whether _every_ value that was ever committed was rotated (ops SMTP app password, Sentry DSN, etc.) still needs checking. | Needs validation (owner) | git history                                                                     |
| S-9  | "Internal" concierge pages are open to any signed-in user, scoped to their own org.                                                                                                                                                              | Verified; low risk       | `apps/web/src/lib/concierge-access.ts`                                          |
| S-10 | Alert email puts every org user in `to`.                                                                                                                                                                                                         | Verified                 | `packages/notifications/src/dispatch.ts`                                        |

#### Reliability & operations (R)

| ID  | Finding                                                                                                                                                   | Tag                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| R-1 | `docker-compose.prod.yml` always runs `ngrok`, requires `NGROK_AUTHTOKEN` (missing from `.env.prod.example`), and publishes the app around the TLS proxy. | Verified, P0                 |
| R-2 | No migrate step in compose. `depends_on` has no health condition.                                                                                         | Verified                     |
| R-3 | Production compose has never been deployed to a real VPS behind TLS (secure cookies, HSTS, CSRF origin, `X-Forwarded-For`).                               | Verified (open in step 41)   |
| R-4 | Backups are scripted only. There is no schedule and no restore drill on a real host.                                                                      | Verified                     |
| R-5 | Logging is plain `console`, with only about half the calls as JSON lines. No org / integration / cycle context.                                           | Verified                     |
| R-6 | No Sentry source maps.                                                                                                                                    | Verified                     |
| R-7 | Rate limiting and throttling are in-memory, so they only work with one web container.                                                                     | Verified (documented)        |
| R-8 | No retry or dead-letter for failed pipeline stages. The next cycle is the retry. Alerts are at-most-once.                                                 | Verified; acceptable for MVP |

#### Testing (T)

| ID  | Finding                                                                                                                                                                                                                                                                                            | Tag         | Evidence                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------ |
| T-1 | Four suites that truncate the real DB (`next-reply-commitment-persistence`, `next-reply-cycle-pipeline`, `next-reply-policy-import-e2e`, `sla-policy-override-route`) are missing from `realDatabaseSuites`. In CI they can run in parallel with the serialized suites and wipe each other's data. | Verified    | `vitest.config.ts:7-15`                          |
| T-2 | Re-resolution tests change `Case.priority` directly. Nothing tests the path Zendesk audit → normalization → priority → re-resolution → evaluation → notification. There is no active **2h → 8h resolution** test and no breached-then-target-raised test.                                          | Verified    | `apps/web/test/commitment-re-resolution.test.ts` |
| T-3 | No tests for OAuth callbacks, the disconnect route, or the webhook receivers end to end.                                                                                                                                                                                                           | Verified    |
| T-4 | No backfill pagination or cursor tests for Intercom, Linear or GitHub. Jira's backfill test covers only date formatting.                                                                                                                                                                           | Verified    |
| T-5 | No concurrency tests (webhook vs worker, normalization duplicates, evaluation overwriting `cancelled`).                                                                                                                                                                                            | Verified    |
| T-6 | No e2e or browser tests. No lint step in CI.                                                                                                                                                                                                                                                       | Verified    |
| T-7 | Engine unit coverage is strong: ordering, DST, pauses, reply cycles, `computeBreachedAt`, and shuffled-input determinism.                                                                                                                                                                          | Verified ✅ |

#### UX (U)

**Onboarding.** Can a new organization do sign up → connect Zendesk → import cases → configure policies and calendar → start monitoring with no developer help?

- **Mostly yes for Zendesk.** The customer must first create their own OAuth app and paste its client ID and secret (a _bring-your-own-OAuth_ design).
- They **cannot configure** policies or calendars; they can only accept what was imported and override targets.
- They never see what the import dropped (E-16).
- An Intercom-only org cannot get commitments at all (I-10).

**Daily workflow.** Dashboard → case → conversation → timeline → "why on track / at risk / breached" works, with these gaps:

- The timeline does not explain target changes or breach moments (C-2).
- Cards don't say which policy applied or why (C-3).
- Nothing warns when a case has _no_ SLA (D-3).

**Configuration.** A user can see the match criteria of the policy version, but not _why_ this policy won over others. They also cannot see policies Zendesk has but this product misrepresents (E-6 to E-8).

### Technical debt that matters

Only debt that matters in practice:

| Debt                                                                                                                                                            | Type                      | Why it matters                                                                     | Where addressed |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------- | --------------- |
| Anchor/sibling selection with no defined order (E-1)                                                                                                            | Dangerous assumption      | Can produce wrong targets in ways that are hard to reproduce                       | W2              |
| Unserialized webhook tail vs worker (E-3)                                                                                                                       | Architectural             | Races on commitments, events, and status                                           | W2              |
| Policy matching model ≠ Zendesk model (E-6 to E-8)                                                                                                              | Dangerous assumption      | Numbers that disagree with Zendesk undermine trust                                 | W5              |
| `Case.priority` / org as a mutable projection with no event (E-14)                                                                                              | Weak abstraction          | Timeline can't explain changes; re-resolution time is imprecise                    | W9              |
| Plaintext provider tokens (I-1)                                                                                                                                 | Security                  | A DB leak exposes every connected account                                          | W6              |
| Whole-integration renormalization per webhook (I-4)                                                                                                             | Performance               | Webhook latency grows with account size                                            | W7              |
| Dashboard live evaluation of all open commitments (D-5)                                                                                                         | Performance / scalability | Slow for large orgs                                                                | W22             |
| Global `WorkerSettings` singleton in a multi-tenant app (S-1)                                                                                                   | Architectural / security  | Cross-tenant control                                                               | W1              |
| Copied mapping code (the `SLAPolicyVersion` / calendar row→domain mappers appear in `case-detail-data.ts`, `dashboard-data.ts`, `re-resolution-pipeline.ts`, …) | Duplicated logic          | Drift risk. Fold into shared mappers when touching those files (no dedicated week) | opportunistic   |
| Mixed JSON / free-text logging, warnings only on the console (R-5, E-16)                                                                                        | Observability gap         | Silent misconfiguration                                                            | W5, W18, W21    |
| Calendar versions have no `source`, so the import overwrites local edits (E-18)                                                                                 | Incomplete abstraction    | Blocks the calendar UI                                                             | W14             |
| 32-bit evaluation id (E-17)                                                                                                                                     | Weak abstraction          | Silent loss of a snapshot                                                          | W22             |
| In-memory rate limiting (R-7)                                                                                                                                   | Scalability               | Blocks horizontal scaling of web                                                   | Post-launch     |

---

## Appendix B — Baseline Snapshot (2026-09-19)

### Current product state

Legend:

- ✅ **Complete**: implemented, tested, and no known production blockers.
- 🟡 **Partially complete**.
- 🔴 **Missing**.
- ⚠️ **Implemented but needs hardening**.

In the table, **Impl** means implemented, **Tested** means covered by automated tests, and **Prod-ready** means safe for a real customer as-is.

#### SLA engine

| Area                                 | State | Impl | Tested | Prod-ready | Notes                                                                                                                                        |
| ------------------------------------ | ----- | ---- | ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| First Response                       | ⚠️    | ✅   | ✅     | ❌         | First public agent reply, or first close. Never pauses. Proactive/agent-created tickets and reply-less closes need decisions (D5).           |
| Next Reply cycles                    | ⚠️    | ✅   | ✅     | ❌         | Cycle derivation is sound. An open cycle survives case close (D4). The anchor is picked in no defined order (P0).                            |
| Resolution                           | ⚠️    | ✅   | ✅     | ❌         | Pauses on `pending_customer` only. A reopen counts the solved gap (D3). On-hold does not pause (D7).                                         |
| Pause rules per kind                 | ✅    | ✅   | ✅     | ✅         | `packages/core/src/clock-rules.ts`                                                                                                           |
| Deterministic event ordering         | ✅    | ✅   | ✅     | ✅         | `ordering.ts`, `sourceSequence`                                                                                                              |
| Policy matching                      | ⚠️    | ✅   | ✅     | ❌         | Deterministic, but differs from Zendesk: `position` is ignored, and dropped conditions broaden a match (see E-6 to E-9).                     |
| Policy versions / overrides          | 🟡    | ✅   | ✅     | ❌         | Versions are appended only. Deleted Zendesk policies are never archived.                                                                     |
| Active re-resolution                 | ⚠️    | ✅   | 🟡     | ❌         | Transactional, audited, idempotent. Its trigger is too broad (D1), it can un-breach (D2), and it has no end-to-end test from a source event. |
| Calendars (hours, holidays, TZ, DST) | ✅    | ✅   | ✅     | ✅         | Good DST coverage. Import only; there is no editor.                                                                                          |
| Customer calendar override           | ✅    | ✅   | ✅     | ✅         |                                                                                                                                              |
| Evaluation snapshots                 | ⚠️    | ✅   | ✅     | ❌         | Append-only. The status write is unconditional (race). The id is a 32-bit hash.                                                              |
| Engineering-leg (OLA) target         | ✅    | ✅   | ✅     | 🟡         | Single org-wide value, by design.                                                                                                            |
| Anomaly detection                    | ✅    | ✅   | ✅     | 🟡         | Statistical cycle-time anomalies. No AI.                                                                                                     |

#### Integrations

| Integration                             | State | Impl | Tested    | Prod-ready | Notes                                                                                                            |
| --------------------------------------- | ----- | ---- | --------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| Zendesk                                 | ⚠️    | ✅   | ✅ (unit) | ❌         | Tokens in plaintext. Uncapped 429 loop. Webhook re-normalizes the whole integration. Not verified live.          |
| Jira                                    | ⚠️    | ✅   | ✅ (unit) | ❌         | HMAC webhook. `issue_deleted` ignored. Removed links never unlinked. Not verified live.                          |
| Intercom                                | 🟡    | ✅   | ✅ (unit) | ❌         | Polling only. **No SLA policy source**, so an Intercom-only org gets no commitments. Cannot link to engineering. |
| Linear                                  | 🟡    | ✅   | ✅ (unit) | ❌         | Polling only. Refresh-token model needs validation.                                                              |
| GitHub (App)                            | 🟡    | ✅   | ✅ (unit) | ❌         | Polling only. About 1,000-result search cap. Live App run not done.                                              |
| Slack alerts                            | 🟡    | ✅   | 🟡        | ❌         | Plaintext token. **No disconnect.** `postMessage` untested.                                                      |
| Email alerts (SMTP)                     | ⚠️    | ✅   | ✅        | ❌         | One message with every user in `to`.                                                                             |
| Notification dedupe (claim-before-send) | ✅    | ✅   | ✅        | ✅         | At-most-once, by design.                                                                                         |

#### Product surfaces

| Area                              | State | Notes                                                                                                                                                                                                      |
| --------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                         | 🟡    | Breaches over time, compliance split, breaches by leg, at-risk list, aging in engineering, anomalies, CSV. **Missing:** compliance per commitment kind, cases with no matching policy, integration health. |
| Case list                         | ✅    | Filters, search, CSV.                                                                                                                                                                                      |
| Case detail: Conversation         | ⚠️    | Zendesk description shown first, chronological order, requester name. Duplicate protection relies on normalization, with no unique key. Agents unnamed by design.                                          |
| Case detail: Activity Timeline    | 🟡    | NormalizedEvents only. **Missing:** priority changes, policy/target changes, SLA lifecycle (at-risk / breached / met / cancelled).                                                                         |
| Case detail: info and commitments | 🟡    | **Missing:** assignee, current ticket status, explicit target, policy name, why the policy matched.                                                                                                        |
| Settings: SLA                     | 🟡    | Policy list, target overrides, customer calendars, engineering target. **Missing:** creating or editing policies, calendars, hours, holidays.                                                              |
| Settings: Notifications / SMTP    | ✅    | Test connection and test send work.                                                                                                                                                                        |
| Settings: Monitoring (worker)     | ⚠️    | Functional, but **cross-tenant** (P0).                                                                                                                                                                     |
| Settings: Integrations            | ⚠️    | Functional, but open to any user.                                                                                                                                                                          |
| Settings: Members / org / account | 🔴    | Not present.                                                                                                                                                                                               |
| Onboarding                        | 🟡    | Zendesk → backfill → optional Jira → findings. No policy-import review and no alert setup step.                                                                                                            |
| Marketing and in-app docs         | ⚠️    | Present. Some SLA semantics are out of date (see [Documentation Discrepancies](#appendix-e--documentation-discrepancies)).                                                                                 |

#### Platform

| Area                       | State | Notes                                                                                                                                 |
| -------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication             | 🟡    | Credentials plus JWT (30-day default, no revocation). No reset, verification or change password.                                      |
| Tenant isolation (data)    | ✅    | Every action and route scopes by the session's `organizationId`. A real-DB isolation suite exists.                                    |
| Authorization (roles)      | 🔴    | Only `requireOwner` on worker settings. Every other mutation is open to any user.                                                     |
| CSRF, rate limits, headers | ⚠️    | Origin check, in-memory limits, right-most `X-Forwarded-For`, CSP/HSTS. Works for a single instance only.                             |
| Worker                     | ⚠️    | Advisory-lock leader, watchdog, per-org error isolation. **Not serialized with webhooks.**                                            |
| Webhooks                   | ⚠️    | Zendesk (Bearer token and freshness window), Jira (HMAC). Heavy synchronous work inside the request.                                  |
| Docker / compose           | ⚠️    | Non-root images with health checks. The prod file contains ngrok. No migrate step.                                                    |
| Backups / restore          | 🟡    | Scripts exist. No cron, no documented restore drill on a real host.                                                                   |
| Observability              | 🟡    | Sentry (scrubbed), `/api/health`, worker `/health`, ops alerts. Logging is half structured. Pipeline warnings only go to the console. |
| CI                         | ✅    | Type-check, migrate, test, build. No lint and no e2e.                                                                                 |
| Tests                      | ⚠️    | Strong unit and engine coverage. No route tests, no e2e. 4 DB suites are not serialized.                                              |

### Delivered before this roadmap

Verified in the code (steps 0–44 in `implementation-plans/roadmap-completed.md`, plus later commits):

- **Foundation:**
  - Prisma schema with an append-only `RawEvent`, regenerable `NormalizedEvent`, versioned policies and calendars, and immutable `Evaluation` and `CommitmentPolicyChange` records.
  - 27 migrations.
- **Engine (`packages/core`):**
  - Calendar, elapsed time, leg spans, evaluation, deterministic ordering.
  - Clock rules per kind, reply-cycle derivation, `computeBreachedAt`, anomaly detection.
- **Pipelines (`packages/commitments`):**
  - Commitment creation, next-reply cycle persistence (create / cancel / restore), evaluation persistence.
  - Overrides, customer calendars, re-resolution with an audit trail.
- **Integrations:**
  - OAuth, backfill, and normalization for Zendesk, Intercom, Jira, Linear, and GitHub (App).
  - Zendesk and Jira webhooks with replay protection. Jira uses HMAC.
  - Token lifecycle with single-flight refresh and a DB compare-and-set.
  - `permission_denied` and `reauth_required` states.
  - Soft disconnect that preserves raw history.
- **Notifications:** Slack and SMTP email, claim-before-send dedupe, thresholds at 50/80/95/100.
- **Web:**
  - Dashboard and analytics, case list, case detail (commitment cards with "how this was calculated", journey, conversation, activity timeline, linked records).
  - Settings (SLA, notifications, monitoring, integrations, overview), onboarding and findings, marketing pages, 17 in-app docs pages.
- **Security:**
  - Tenant scoping.
  - CSRF origin check, sign-in throttling, rate limiting, security headers.
  - Sentry scrubbing, encrypted OAuth client secrets and SMTP passwords.
  - `.env.prod` removed from tracking and a rotation script added.
- **Ops:**
  - Dockerfiles, production compose, advisory-lock single worker, watchdog, ops alerts.
  - Backup and restore scripts, deployment docs, CI.
- **Concierge:** offline CSV analysis CLI (`apps/concierge`) for sales validation.

---

## Appendix C — Review of `RENEW_ROADMAP.md`

The product-completion direction is right and has been adopted. Checked against the repository, these points in it were **wrong, risky, or needed a decision**, and the plan below corrects them:

| #    | What `RENEW_ROADMAP.md` says                                                                                         | Problem (evidence)                                                                                                                                                                                                                                                  | Resolution in this roadmap                                                                                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RV1  | The execution table puts **Phase 8 (worker settings, P0)** and **Phase 13 (remove ngrok, P0)** after five P1 phases. | These are the only cross-tenant and public-exposure holes (S-1, R-1). Each is about 2–4 hours of work. Leaving them for months contradicts "fix before build".                                                                                                      | Moved to **Week 1**.                                                                                                                                                                                   |
| RV2  | Phase 0 "create an inventory".                                                                                       | Already done: see [Current Product State](#appendix-b--baseline-snapshot-2026-09-19) and [Audit Findings](#appendix-a--audit-findings).                                                                                                                             | Phase 0 becomes a scope lock plus the P0 safety fixes. It does not repeat the inventory.                                                                                                               |
| RV3  | Phase 1 decides "breached must not be un-breached", but is silent on **policy edits** changing active commitments.   | Today _any_ new version of the matched policy (override or Zendesk re-import) moves active commitments (E-4). Phases 5–6 add a policy and calendar editor, so every edit would silently rewrite in-flight SLAs.                                                     | **D1 must be decided before Week 3**, and before any editor is built. D2 is recorded as decided (breach is final).                                                                                     |
| RV4  | Phase 1 lists "calendar changes" as a re-resolution case.                                                            | Reassigning a customer's calendar alone does **not** trigger re-resolution today; only a policy version change does (`re-resolution-pipeline.ts` compares policy ids). What should happen is undefined.                                                             | Part of D1 (new sub-question D1b).                                                                                                                                                                     |
| RV5  | Phase 1 lists "customer/tier changes".                                                                               | No source ever populates tier (E-15). A tier change can only happen through direct DB edits, which is already covered by `commitment-re-resolution.test.ts:322`.                                                                                                    | Keep the existing test. No new tier work. The tier source stays in Future.                                                                                                                             |
| RV6  | Phase 1 "Evaluation: prevent an old evaluation from overwriting newer evaluations".                                  | `Evaluation` rows are append-only and never overwritten. The real bug is the unconditional `Commitment.status`/`closedAt` write (E-2).                                                                                                                              | Worded as "conditional commitment status writes" (Week 2).                                                                                                                                             |
| RV7  | Phase 1 "Policy matching" (no detail).                                                                               | Leaves out the concrete defects: a condition on an organization we haven't seen yet turns the policy into a **match-all** (E-7, P0), Zendesk `position` ignored (E-6), deleted policies never archived (E-9).                                                       | Listed explicitly in Week 5.                                                                                                                                                                           |
| RV8  | Phase 3 adds **assignee** to the header, as if it were display-only work.                                            | The assignee is not stored anywhere. Zendesk users are deliberately reduced to `{id, role}` (privacy minimization, C-6). Showing it needs an ingestion and schema change that stores agent names, which is personal data.                                           | D10 is recorded as "display only". Scheduled as its own task (Week 11) with a schema change and a privacy note. It is never used in analytics (consistent with the out-of-scope per-agent scoring).    |
| RV9  | Phase 3 timeline adds "status changed" and "re-resolution" as new events.                                            | `state_changed` is already on the timeline. "Re-resolution" and "target change" are the same `CommitmentPolicyChange` row.                                                                                                                                          | Status change: already done. Policy/target change: one event type.                                                                                                                                     |
| RV10 | Phase 4 card example: `Reason: priority changed`.                                                                    | Re-resolution deliberately records the generic reason `policy_driving_attribute_changed` with no field-specific path (`re-resolution-pipeline.ts:22`). A per-field reason can only be derived for display by lining it up with a `priority_changed` event (Week 9). | Show the derived reason when a matching attribute-change event exists. Otherwise "policy re-matched".                                                                                                  |
| RV11 | Phase 4 presents the card fields as missing.                                                                         | Policy version, match criteria, calendar, pause states and warning thresholds are already shown in "How this was calculated" (`case-detail-data.ts:247-261`). `computeBreachedAt` already exists.                                                                   | Phase 4 shrinks to target, policy name, why it matched, started/due/breached-at, and change history (Week 10).                                                                                         |
| RV12 | Phase 5 example condition `Customer = Enterprise`.                                                                   | "Enterprise" is a _tier_. `customerIds` are specific accounts, and tier is never populated (E-15), so this condition would never match.                                                                                                                             | The policy editor offers priority, customers, and tier (the tier field is marked "no data source yet").                                                                                                |
| RV13 | Phase 5 builds native policies but doesn't say how they coexist with Zendesk-imported ones.                          | Imported policies are re-imported every cycle, and a Zendesk change replaces overrides. Mixing native (specificity-ordered) and imported (Zendesk `position`-ordered, D6) policies needs one precedence rule.                                                       | New decision **D12**. Recommended: imported policies are read-only (overrides only); native policies are for orgs or cases with no imported policy; imported match first.                              |
| RV14 | Phase 6 lets users edit calendars.                                                                                   | **The Zendesk calendar import compares against the latest version of _any_ source and would overwrite a local edit on the next sync** (`packages/zendesk/src/calendars.ts:87-110`; finding E-18). Policies already solve this with `PolicyVersionSource`.           | Add a `source` to calendar versions (or allow editing native calendars only) before the editor ships (Week 14).                                                                                        |
| RV15 | Phase 6 holidays: name, recurring/non-recurring.                                                                     | `BusinessCalendarVersion.holidays` is `String[]` of dates, and the engine matches exact local dates. Recurring holidays inside the engine would change the deterministic clock.                                                                                     | Expand recurring holidays into concrete dates when a version is saved (the same pattern `expandHolidayDates` uses for Zendesk). Store names alongside. No engine change.                               |
| RV16 | Phase 6 "calendar assignment: organization".                                                                         | There is no org-level calendar today. A calendar comes from the policy version, and customers can override it.                                                                                                                                                      | A native policy picks a calendar, and the org gets a default calendar that new native policies start with. No new engine concept.                                                                      |
| RV17 | Phase 7 lists roles as "Owner / Member / Operator".                                                                  | Operator is a deployment-level role (env allowlist, Phase 8 itself says `PLATFORM_ADMIN_EMAILS`), not a role inside an org. Putting it in the org role enum would let a tenant grant it.                                                                            | Two org roles (owner, member). Operator is resolved from env only.                                                                                                                                     |
| RV18 | Phase 7 adds an organization **timezone**.                                                                           | Valid, and there's a real use for it: dashboard day buckets are UTC today (`apps/web/src/lib/analytics-data.ts:26`). It must never feed SLA math (calendars own the SLA timezone).                                                                                  | Kept, and used only for display and grouping.                                                                                                                                                          |
| RV19 | Phase 7 has no session revocation.                                                                                   | JWTs last 30 days and can't be revoked (S-5). Removing a member or changing a password would leave old sessions working.                                                                                                                                            | Added to Week 17.                                                                                                                                                                                      |
| RV20 | Phase 12 "alert deduplication".                                                                                      | Already implemented and tested (claim-before-send, `@@unique([commitmentId, threshold])`).                                                                                                                                                                          | Marked done. Still needed: Slack alerts contain **no case link at all** (`packages/notifications/src/format.ts` `formatSlackMessage`, E-19), plus policy, target, started and breached in the message. |
| RV21 | Phase 12 "clear notification ownership".                                                                             | Undefined, and no finding supports it. Alert routing per person or team would get close to the out-of-scope team management.                                                                                                                                        | Dropped until a pilot asks for it (needs validation).                                                                                                                                                  |
| RV22 | Phase 13 health chain "Postgres → Worker → Web" and VPS "Web → Worker → Postgres".                                   | Web does not depend on the worker; both talk directly to Postgres. Gating web on the worker would take the UI down whenever the worker restarts.                                                                                                                    | `postgres (healthy)` → `migrate (completed)` → `web` and `worker` start independently.                                                                                                                 |
| RV23 | Out of scope: "multi-worker distributed locking".                                                                    | Correct for horizontal scaling. But the per-org advisory lock that stops the web-process webhook from racing the worker (E-3) is a correctness fix, not scaling (Phase 2 of the same file asks for it).                                                             | Kept in Week 2, labelled a correctness fix.                                                                                                                                                            |
| RV24 | Out of scope: "native Intercom SLA policy engine".                                                                   | Native policies (Phase 5) are provider-agnostic. Once they exist, Intercom-only orgs _do_ get commitments, with no Intercom-specific engine.                                                                                                                        | Intercom stays Beta because of ingestion gaps (polling only, no deletes, no engineering links), not because of policies.                                                                               |
| RV25 | Phase 17 E2E "Connect Zendesk".                                                                                      | A real OAuth round-trip can't run in CI.                                                                                                                                                                                                                            | The E2E uses a stubbed provider with fixture data. Live verification stays a manual gate (Week 8).                                                                                                     |
| RV26 | Missing entirely.                                                                                                    | Merging the current branch. Confirming leaked-secret rotation (S-8). Serializing the DB test suites (T-1). Route tests (T-3). Migrating existing tokens to encrypted form. Stale-docs correction.                                                                   | Added (Weeks 1, 6, 7).                                                                                                                                                                                 |
| RV27 | No weekly plan and no estimate.                                                                                      | The original brief requires weekly plans at 10–15 h/week.                                                                                                                                                                                                           | Weekly plan below: **24 weeks plus 3 buffer (about 6–7 months)**.                                                                                                                                      |

---

## Appendix D — Architecture & Risks

### Known risks

| Risk                                                                                                       | Impact                              | Mitigation                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Engine numbers disagree with Zendesk's own SLA view (E-6 to E-8, D3, D5)                                   | Loss of trust on day one            | W5 parity work. Golden fixtures. Spot-check against Zendesk before launch.                                                                |
| Decisions D1–D7 take longer than planned                                                                   | Phase 1 slips                       | Decide all of them up front (before W3). Use the buffer weeks.                                                                            |
| Live provider behavior differs from the docs (Zendesk placeholder, Jira signatures, GitHub App)            | Silent ingestion failure            | W8 live checks. Failure visibility (W18, W21).                                                                                            |
| Plaintext tokens before W6                                                                                 | Credential exposure                 | Do not connect any real customer account before W6.                                                                                       |
| Webhook vs worker races before W2                                                                          | Corrupted status / duplicate events | W2 is the first engineering week after W1.                                                                                                |
| Customer validation not started (`plans/05`)                                                               | Building for no buyer               | D11: run outreach in parallel with Phases 0–2.                                                                                            |
| One developer at 10–15 h/week                                                                              | The timeline stretches              | Weeks are independent within a phase. P2 items can be dropped without blocking launch.                                                    |
| Single web/worker instance                                                                                 | Limited scale and availability      | Documented limits (W22). Scaling is post-launch.                                                                                          |
| The policy and calendar UI (W12–W15) is new surface area on engine semantics that were only just finalized | Editor bugs change live SLAs        | D1, D1b and D12 are decided first. Every edit is versioned. The golden scenarios gate CI (W23).                                           |
| Storing assignee names (D10) weakens today's privacy minimization                                          | Personal data held                  | Display name only. Documented in the customer guide. Never used for analytics.                                                            |
| The scope grew from about 18 to about 24 weeks                                                             | Later first customer                | Weeks 1–10 (hardening) match the first revision. A pilot could start after W11 on imported-policy orgs if you accept the gaps in W12–W19. |

### Architectural decisions

#### Existing invariants (keep)

1. **Store events, never computed time.** `RawEvent` is append-only. `NormalizedEvent` can be regenerated. Elapsed time, deadlines, and status are always derived. `Evaluation` rows are immutable snapshots, and a breach _is_ an Evaluation.
2. **The engine is pure** (`packages/core`): no I/O, deterministic ordering (`compareNormalizedEvents`, `sourceSequence`).
3. **Versioned configuration:** editing a policy or calendar appends a version and never mutates one. Commitments reference versions.
4. **Re-resolution updates only active commitments, in place.** It is audited in `CommitmentPolicyChange` and idempotent. A breach is final (D2). The exact trigger is pending D1 and D1b.
5. **Per-kind clock rules:** First Response and Next Reply never pause. Resolution pauses on policy pause states.
6. **Zendesk is the Case source of truth.** Engineering systems (Jira, Linear, GitHub) are the engineering leg only, linked by `certain` links.
7. **Read-only integrations.** The only outbound writes are Slack and email alerts.
8. **Customer ≠ Requester.** Customer is the account (Zendesk org or Intercom company). The requester is a display field on the case.
9. **Conversation ≠ Activity Timeline.** Messages vs system and SLA activity. They stay separate data paths and components.
10. **Multi-tenant by `organizationId`**, taken from the session and never from the client.
11. **A single worker** behind a Postgres advisory lock.
12. **No AI, no blame language, no unnecessary architecture.**

#### New decisions this roadmap introduces

- **Per-org pipeline serialization** via a Postgres advisory lock (W2). No queue system.
- **Operator vs tenant settings:** anything global to the deployment is configured by the operator (env allowlist), never by a tenant (W1).
- **Encryption of provider credentials at rest**, reusing the existing AES-GCM helper (W6).
- **`priority_changed` as a display-only NormalizedEvent** (W9). The engine ignores it.
- **Deployment-level transactional email** for invites, resets and verification (D8, W16).
- **Native and imported policies coexist:** imported policies are read-only and matched first by Zendesk position; native policies come after, by specificity (D12, W12).
- **Calendar versions carry a `source`**, like policy versions, so imports never overwrite local edits (E-18, W14).
- **Recurring holidays are expanded into dates when a version is saved.** The clock engine is unchanged (W14).
- **Operator is not an org role.** Operators are resolved only from the `PLATFORM_ADMIN_EMAILS` env (W1, W16).
- **Organization timezone is display-only** (day grouping), never used in SLA math (W17).
- **Assignee is display-only** (D10, W11).
- **Zendesk `position` ordering for imported policies** (D6, W5).

---

## Appendix E — Documentation Discrepancies

These were **not changed** in this audit, per instructions. Fix them in W1 (current behavior) and finalize after W4 (decided behavior):

| Location                                                                  | Says                                                       | Code does                                                            |
| ------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| `docs/customer-guide.md` §13 "Priority changes"                           | Changing priority has no effect on existing commitments    | Re-resolution changes active commitments (8f31aad)                   |
| `docs/customer-guide.md` §13 "Policy changes"                             | Existing commitments keep their policy version permanently | Any new version of the matched policy moves active commitments (E-4) |
| `apps/web/src/app/docs/sla/page.tsx:145`, `:366`                          | Same two claims as above                                   | Same as above                                                        |
| `docs/customer-guide.md` §13 "Reopened tickets"                           | Resumes "from where it left off"                           | The solved interval counts after a reopen (E-10)                     |
| `apps/worker/src/index.ts:32`                                             | Refers to `@@unique([caseId, kind])`                       | The key is `@@unique([caseId, kind, cycleKey])`                      |
| `packages/commitments/src/cycle-pipeline.ts:45-47`                        | Evaluation skips `next_reply`                              | `evaluate-pipeline.ts` evaluates `next_reply`                        |
| `implementation-plans/roadmap-completed.md` "Explicitly deferred past v1" | Integrations beyond Zendesk + Jira are deferred            | Intercom, Linear and GitHub are built                                |

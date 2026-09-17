# Post-Roadmap Product Audit — What to Build Next (Steps 0–25 Complete)

## Context

Steps 0–25 of `implementation-plans/roadmap.md` are done. Per that file's own
"Explicitly deferred past v1" section, the MVP MUST HAVE, SHOULD HAVE, and
NICE TO HAVE lists from `plans/03-Product-and-MVP.md` are **all** now shipped:
two ticket sources (Zendesk, Intercom), three engineering-leg sources (Jira,
Linear, GitHub), webhooks, tenant-scoped OAuth config, custom calendars,
policy overrides, and statistical anomaly detection. This is materially past
the original 6–9-week MVP scope.

This document is the requested audit: a factual read of the actual repository
(three parallel deep-dive agents plus direct verification — full test suite,
typecheck, Prisma validation, and both production builds were actually run,
not assumed) against the product/architecture plans, followed by an explicit
build-vs-validate verdict and, since real engineering gaps were found, a
scoped Step 26+ roadmap that is **hardening, not new product surface** — the
DO NOT BUILD list stays in force.

**Two things surfaced during this audit need your attention directly, not as
roadmap items:**

1. **Rotate your local dev credentials.** While inspecting `.env` structurally,
   one of the audit subagents' redaction command malfunctioned and briefly
   printed short fragments of real values into its own tool output —
   including what looked like a live Gmail app-specific password and part of
   `NEXTAUTH_SECRET`. Those fragments were not repeated to you and are not in
   this document, but they did transit through a subagent's transcript.
   `.env` itself was never committed (confirmed via `git check-ignore` and
   `git ls-files` — it's correctly gitignored), so this is not a repo leak,
   but as a precaution you should rotate the Gmail app password and any other
   locally-configured dev secrets.
2. **The customer-validation motion described in `plans/00`/`plans/05` has not
   run.** `plans/call-scorecard.csv` is a header row with one blank data row —
   zero interviews logged. `plans/target-list.csv` has 40 target companies but
   no evidence any were contacted. Every commit in this repo's history is
   engineering work. This matters directly for Phase 8 below.

---

## Phase 1–2 — Repository Reality Audit & Test Reality

Classification key: **COMPLETE** / **PARTIALLY COMPLETE** / **BROKEN** /
**MISSING** / **TECHNICALLY COMPLETE BUT NOT PRODUCTION READY** / **UNKNOWN**.

### Core engine (`packages/core`, `packages/commitments`)

| Capability                                              | Status                                            | Evidence                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elapsed time as pure function of events/policy/calendar | **COMPLETE**                                      | `evaluateCommitment` (`packages/core/src/evaluate.ts:128-198`) is deterministic — its own doc comment states identical inputs produce an identical `Evaluation`, id included (a `stableHash` of inputs, not `randomUUID()`). `Commitment` stores no `elapsedMinutes` field; `Evaluation` rows are immutable snapshots, only ever `create`d, never `update`d (grep-verified, zero hits). |
| Business hours / holidays / calendars                   | **TECHNICALLY COMPLETE BUT NOT PRODUCTION READY** | Versioned, append-only `BusinessCalendarVersion`. But `calendar.ts`'s own comment (line 52-54) admits its local→UTC conversion "is not exact across a DST transition at minute resolution" — and every test fixture uses `timezone: "UTC"`, so this is untested in the one condition it warns about itself.                                                                             |
| Pause states                                            | **COMPLETE**                                      | Predicate over `NormalizedState` (provider-independent), never a raw Zendesk/Jira status string (`elapsed.ts:73`).                                                                                                                                                                                                                                                                      |
| Policy versioning                                       | **COMPLETE**                                      | Append-only; zero `.update()` calls against `SLAPolicyVersion` anywhere; `policyVersionContentEquals` prevents no-op versions.                                                                                                                                                                                                                                                          |
| Anomaly detection                                       | **COMPLETE**                                      | Statistical only (median/MAD modified z-score, Iglewicz & Hoaglin), explicit "not AI" comment, real minimum-sample-size gate (12 baseline / 5 recent).                                                                                                                                                                                                                                  |
| Idempotency / dedup                                     | **COMPLETE**                                      | DB-enforced `@@unique([integrationId, providerEventId])` on `RawEvent`, `@@unique([caseId, kind])` on `Commitment`, `@@unique([commitmentId, threshold])` on `Notification` — all actually relied on via `createMany({skipDuplicates: true})`, not just app-level checks.                                                                                                               |
| Out-of-order events                                     | **COMPLETE**                                      | Every consumer sorts by `occurredAt` (provider time), never `fetchedAt` (ingestion time).                                                                                                                                                                                                                                                                                               |
| Replayability                                           | **COMPLETE**                                      | Normalizers regenerate `NormalizedEvent` from `RawEvent` inside a transaction (`deleteMany`+`createMany`), safe to re-run; `RawEvent` itself is never mutated or deleted.                                                                                                                                                                                                               |
| `RawEvent` cascade-delete safety                        | **PARTIALLY COMPLETE**                            | Safety is _process discipline_ (no code path calls `integration.delete()`), not a DB-level `Restrict` — the schema comment itself flags this as an accepted risk.                                                                                                                                                                                                                       |
| Core/commitments test coverage                          | **PARTIALLY COMPLETE**                            | Strong on the primary paths (1,700+ lines across the two packages). Gaps: no DST/non-UTC test, no explicit out-of-order-events or empty-event test, no test file at all for `override.ts` or `customer-calendar.ts`, no integration-level test for `runCommitmentPipeline`/`runEvaluationPipeline` themselves (only their pure helpers).                                                |

### Data model (`packages/db`)

**COMPLETE.** All 19 models read in full. Append-only/immutability intent
matches actual code (verified by absence of `.update()` calls, not just doc
comments). 16 migrations, all incremental, zero `DROP COLUMN`/`DROP TABLE`.
No seed script, no raw-SQL bypass of Prisma.

### Integrations (Zendesk, Jira, Linear, Intercom, GitHub, Slack, Email)

The pre-existing `implementation-plans/integration-access-audit.md` document
is **stale** — written before roadmap steps 15/17/20–25 shipped. It claims
Linear has no correlator and no webhooks exist; both are now false. Current
verified state:

| Capability                                       | Status                                                               | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OAuth scopes                                     | **PARTIALLY COMPLETE**                                               | Zendesk (`read`), Jira (`read:jira-work offline_access`), Linear/Intercom (`read`) are genuinely read-only. **GitHub requests `repo`, which is not read-only** — it's a write-capable, user-token-wide grant (GitHub Classic OAuth Apps have no narrower read-only scope for private-repo PR history). The code comment acknowledges this as an unavoidable GitHub limitation, not an oversight — but it means the product's "read-only, no write access" pitch does not fully hold for one of its six integrations.                                                                                                                                                               |
| Token refresh / reauth on 401                    | **COMPLETE**                                                         | Proactive refresh with compare-and-swap persistence to survive concurrent serverless refreshes (Zendesk/Jira); correct `reauthRequired` marking for non-expiring tokens (Linear/Intercom/GitHub).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Permission loss without token invalidation (403) | **MISSING**                                                          | Zero handling across all 5 `tokenLifecycle.ts` files. A connecting user losing Browse-project/repo access produces a silently narrower API result, not an error — no `reauthRequired` flag, no operator-visible symptom. This was flagged in the stale audit doc too and was never closed by any shipped step.                                                                                                                                                                                                                                                                                                                                                                     |
| Tenant-scoped OAuth app config + encryption      | **COMPLETE**                                                         | `IntegrationConfig` model, real AES-256-GCM (`packages/db/src/crypto.ts` — random 12-byte IV, auth tag verified on decrypt, this is correctly implemented cryptography), decrypt failures wrapped in a safe generic error that never leaks ciphertext.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Disconnect / reconnect lifecycle                 | **COMPLETE** for the state machine; **BROKEN** for one specific case | Disconnect is a real soft-state change (never a row delete) across all 6 providers. OAuth `state` CSRF/cross-tenant check (`validateOAuthState`) is consistently wired into all 6 connect/callback pairs. **But**: `Integration.webhookSecret` is only ever generated on the `create` branch of the connect upsert — a reconnect always hits the `update` branch, which never sets it. The settings UI's own copy tells a user with no webhook secret to _"disconnect and reconnect to enable real-time updates"_ (`WebhookInfo.tsx:75-81`) — **this instruction does not work** and leaves webhooks permanently 404 for any integration connected before webhook support shipped. |
| Worker polling (two-speed)                       | **COMPLETE**                                                         | Per-integration failure isolation confirmed (try/catch around each integration and each org-level pipeline stage — one broken connection never stops the rest of the cycle). Cursor persisted after every page, crash-resumable.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Worker concurrency                               | **PARTIALLY COMPLETE, resolved by your answer**                      | Only an in-process boolean guard — safe _because_ you've confirmed the worker deploys as a single instance. A Postgres advisory lock (roadmap step 42) now keeps any extra instance in standby; this is still not horizontal scaling.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Rate limiting (outbound, respecting providers)   | **PARTIALLY COMPLETE**                                               | Reactive 429/403+Retry-After handling exists per provider; no proactive throttling/token-bucket anywhere.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Rate limiting (inbound, abuse protection)        | **MISSING**                                                          | No rate limiting on any route at all — most consequential on the two unauthenticated-by-session webhook routes and `/api/sign-up`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Webhooks (Zendesk, Jira)                         | **TECHNICALLY COMPLETE BUT NOT PRODUCTION READY**                    | Real, full-pipeline, constant-time-secret-verified receivers. Gaps: no replay protection (no nonce/timestamp — a captured request replays indefinitely), Jira's secret rides in the URL query string (leak-prone via logs/history) rather than a header, and a narrow race where a webhook-triggered pipeline and a concurrent poll cycle can both send the same Slack/email alert before either's dedup row lands (DB-level dedup holds, message-send-level dedup does not).                                                                                                                                                                                                      |
| Correlation (`CaseLink`)                         | **COMPLETE**                                                         | Jira/Linear/GitHub all produce only `certain`-confidence links from deterministic signals (remote links, attachments, pattern-matched issue keys gated on pre-existing certain evidence). No fuzzy matching found anywhere. GitHub correctly processes after Jira/Linear in the same cycle so its transitive correlation has evidence to find.                                                                                                                                                                                                                                                                                                                                     |
| Tenant isolation across integrations/correlators | **COMPLETE**                                                         | No correlator or route was found querying across an `organizationId` boundary. Webhook routes use a sound two-factor model (unguessable `cuid()` in the URL + constant-time secret), not "URL alone."                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Web app, auth, UI

| Capability                            | Status                                            | Evidence                                                                                                                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth strategy & session/org embedding | **COMPLETE**                                      | NextAuth credentials provider, JWT sessions with `organizationId` embedded, bcrypt cost-12 hashing.                                                                                                                                                                         |
| API/action org-scoping (IDOR)         | **COMPLETE**                                      | ~35 route files + the action layer sampled; every one scopes by `session.user.organizationId` before touching data. Write paths that accept a foreign-key-like id (customer calendar assignment, policy override) explicitly re-validate both sides belong to the same org. |
| Signup flow                           | **PARTIALLY COMPLETE**                            | Creates Org+User correctly in one transaction; no email verification, no rate limiting or CAPTCHA on signup/sign-in.                                                                                                                                                        |
| Onboarding                            | **COMPLETE**                                      | Live backfill counters (tickets/escalations/linked issues) polled every 2.5s, Jira deferrable without blocking the flow, matches the "no configuration before value" design goal.                                                                                           |
| Dashboard / case detail               | **COMPLETE**                                      | Both genuinely computed live from pure engine functions per request — no stale cached "elapsed" values anywhere. Timeline, time-by-stage, and "how this was calculated" disclosure are real, not stubs.                                                                     |
| Settings UI                           | **COMPLETE**, one stale artifact                  | A code comment (`IntegrationsView.tsx:292`) reads `{/* Linear — this is disabled for now */}` directly above a fully working Linear card — misleading, not an actual gate.                                                                                                  |
| Empty/loading/error states            | **PARTIALLY COMPLETE**                            | `EmptyState` and `ReauthBanner` used consistently. Only **one** `loading.tsx` in the entire app (dashboard); **zero** `error.tsx`/`not-found.tsx` anywhere — an unhandled server exception on any page falls through to Next's default error page.                          |
| CSV export                            | **TECHNICALLY COMPLETE BUT NOT PRODUCTION READY** | Correctly org-scoped, but built in-memory (not streamed) and **has no link anywhere in the UI** — works only if you know the URL. The product's own `docs/customer-guide.md` already self-reports this.                                                                     |

### Production readiness

| Capability                               | Status                                            | Evidence                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deployment path                          | **MISSING**                                       | No Dockerfile anywhere in the repo; `docker-compose.yml` runs Postgres only. `apps/web`/`apps/worker` only have dev-oriented `pnpm`/`tsx`/`next` scripts. No documented target host.                                                                                                                                                                                       |
| Health checks                            | **MISSING**                                       | No `/api/health` for the web app; the worker is a bare `setInterval` process with no HTTP surface to probe at all.                                                                                                                                                                                                                                                         |
| Logging / observability / error tracking | **MISSING**                                       | No Sentry/pino/winston/APM of any kind repo-wide. The worker emits reasonable structured JSON console logs, but nothing captures or alerts on exceptions.                                                                                                                                                                                                                  |
| Security headers                         | **MISSING**                                       | No CSP, HSTS, X-Frame-Options, or X-Content-Type-Options anywhere in `next.config.mjs` or the proxy/middleware.                                                                                                                                                                                                                                                            |
| CSRF                                     | **TECHNICALLY COMPLETE BUT NOT PRODUCTION READY** | Relies solely on NextAuth's default SameSite cookie behavior — no Origin-header check or double-submit token on state-changing routes.                                                                                                                                                                                                                                     |
| Secrets at rest                          | **COMPLETE**                                      | Correct AES-256-GCM for OAuth client secrets and SMTP passwords; `.env` never committed.                                                                                                                                                                                                                                                                                   |
| CI                                       | **MISSING**                                       | No `.github` directory exists. Nothing runs typecheck/lint/test/build automatically. This is exactly how a stale, failing test (below) went unnoticed.                                                                                                                                                                                                                     |
| Backups                                  | **MISSING**, as expected for this stage           | No documented or automated Postgres backup strategy anywhere.                                                                                                                                                                                                                                                                                                              |
| Documentation parity                     | **PARTIALLY COMPLETE**                            | `docs/customer-guide.md` (819 lines) is accurate and current against the shipped code. Five other files (`docs/integrations.md`, `getting-started.md`, `how-it-works.md`, `sla-timing.md`, `dashboard-and-cases.md`, `troubleshooting.md`) predate Linear/GitHub/Intercom and only mention Zendesk/Jira/Slack — a real docs/code mismatch. `README.md` is a one-line stub. |
| Tests                                    | **PARTIALLY COMPLETE**                            | 47 test files, 469 tests, strong coverage at the `packages/*` layer. `apps/web/test/` has only 2 files — **zero tests for any API route, the auth strategy, or the org-scoping pattern that the entire tenant-isolation guarantee rests on.**                                                                                                                              |

### Phase 2 — actually running things (not assumed)

- `pnpm test` (vitest, full workspace): **468 passed, 1 failed.**
  `packages/db/test/integration-config.test.ts` asserts
  `isConfigurableIntegrationProvider("linear")` should be `false`; the actual
  code (`packages/db/src/integration-config.ts:18-25`) correctly includes
  Linear in `CONFIGURABLE_PROVIDERS` (needed for its own tenant-scoped OAuth
  config). **The code is right; the test is stale** — nobody has been
  watching CI output, because there is no CI. Real, if trivial, finding.
- `npx tsc --noEmit` in `apps/web`: **clean, zero errors.**
- `npx prisma validate`: **schema valid.**
- `pnpm build` (root, compiles `packages/*` via `tsc`): **fails** —
  `packages/slack` and `packages/core` don't compile standalone (missing
  `URL`/`fetch` globals, missing `node:crypto` types in `tsconfig`). This is
  **not actually blocking**: every workspace package's `main`/`types` point
  at `./src/index.ts` directly, so `apps/web` and `apps/worker` import raw TS
  source, never the `dist/` this script produces. It's dead, broken tooling,
  not a runtime defect — but it's a bad signal for anyone who runs `pnpm build`
  expecting it to mean something, and worth a one-line fix.
- `pnpm build` in `apps/web` (the real production build, Next 16/Turbopack):
  **succeeds cleanly**, all 66 routes compiled, including every integration
  provider's connect/callback/config/backfill/disconnect route and both
  webhook receivers.

---

## Phase 3 — Product/Plan Gap Analysis

Every MUST HAVE in `plans/03-Product-and-MVP.md` Phase 10 is implemented and
verified in code, not just claimed: two ticket sources, deterministic
correlation, immutable event store, business-hours-aware SLA engine with
pause states, leg timing, at-risk/breach detection, the one-screen dashboard,
case timeline, Slack notifications, CSV export (present but undiscoverable —
see above), minimal auth, auto-derived customers. SHOULD HAVE and NICE TO
HAVE items are also all shipped.

Architectural principle check against `plans/04-Architecture-Sketch.md`:

> **"Store events. Never store computed time."** — Holds. Verified by reading
> every relevant model and grepping for `.update()` calls against
> `Evaluation`/`Commitment.elapsedMinutes`-shaped fields: none exist. No
> architectural drift was introduced by steps 17–25 — Intercom, GitHub, custom
> calendars, and anomaly detection all extend the same event-sourced,
> pure-function pattern rather than bolting on a shortcut. The one honest
> caveat is the DST approximation in `calendar.ts`, which is self-documented
> in the code rather than hidden.

No drift found. This is a well-executed architecture for what it claims to be.

---

## Phase 4 — Customer Value Audit (ICP: B2B SaaS, 80–400 employees, Zendesk + Jira)

| Question                                                      | Answer                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Sign up without our help?                                  | Yes — self-serve signup, no verification gate (a minor con, not a blocker).                                                                                                                                                                                                                        |
| 2. Connect Zendesk?                                           | Yes — one-click OAuth, tenant-scoped app config.                                                                                                                                                                                                                                                   |
| 3. Connect Jira?                                              | Yes — same pattern; deferrable without blocking onboarding.                                                                                                                                                                                                                                        |
| 4. Backfill 60–90 days?                                       | Yes — live counters, resumable via persisted cursor.                                                                                                                                                                                                                                               |
| 5. Understand first findings with zero config?                | Yes — onboarding/findings screen computes live from ingested data.                                                                                                                                                                                                                                 |
| 6. Understand why a commitment breached?                      | Yes — case detail timeline + "how this was calculated" disclosure.                                                                                                                                                                                                                                 |
| 7. See where time went?                                       | Yes — time-by-stage bar, leg attribution.                                                                                                                                                                                                                                                          |
| 8. See at-risk escalations?                                   | Yes — dashboard at-risk list, sorted by remaining time.                                                                                                                                                                                                                                            |
| 9. Receive alerts?                                            | Yes — Slack + email, deduplicated by `(commitmentId, threshold)` **except** for the narrow webhook/poll race that can double-send.                                                                                                                                                                 |
| 10. Trust the calculation?                                    | **Mostly** — the engine is genuinely pure and reproducible. The DST/timezone gap is the one place a customer with non-UTC hours could see a wrong number and have no way for you to prove otherwise from tests.                                                                                    |
| 11. Recover from integration failure?                         | **Partially** — reauth on outright token invalidation works well; a _narrowed_ permission (403) fails silently with no customer-visible signal.                                                                                                                                                    |
| 12. Disconnect/reconnect safely?                              | **Mostly** — disconnect/reconnect is correct for data safety, but reconnecting to fix a missing webhook secret is currently a dead end (see above).                                                                                                                                                |
| 13. Export the data?                                          | Yes, functionally — but not discoverable without knowing the URL.                                                                                                                                                                                                                                  |
| 14. Run a 30-day paid pilot with zero developer intervention? | **No, not yet.** There is no error tracking, no health check, no deployment path, and no rate limiting on the endpoints most likely to be probed. If something breaks at 2am on day 12 of a pilot, the current answer is "nobody finds out until the customer complains." That is the actual gate. |

---

## Phase 5 — Trust Audit

The engine itself earns trust: pure functions, immutable snapshots,
reproducible ids, honest link-coverage reporting, no silent invention of
relationships. Three concrete places a customer could reasonably say **"I
don't trust this number"**:

1. **DST/non-UTC timezone handling** — a self-documented approximation with
   zero test coverage in the one scenario it warns about.
2. **Silent 403 permission drift** — a case's engineering-leg time could quietly
   stop updating with no error anywhere, indistinguishable from "no activity."
3. **Duplicate Slack/email alerts** under the webhook/poll race — not a wrong
   number, but a "why did I get paged twice" trust dent at exactly the moment
   (a breach) you most need to look competent.

Everything else audited (pause behavior, policy versioning, event ordering,
correlation confidence tiers, deleted-ticket handling via `Case.deletedAt`,
reconnect data integrity) held up under direct code inspection.

---

## Phase 6 — Security Audit

| Finding                                                                                             | Severity                                                                                                                                 |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| No rate limiting anywhere — most acute on the two unauthenticated webhook routes and `/api/sign-up` | **HIGH**                                                                                                                                 |
| GitHub OAuth scope (`repo`) is write-capable, unlike every other integration                        | **HIGH** (trust/positioning risk for a "read-only" product; low practical exploit likelihood since the app never calls a write endpoint) |
| No 403-vs-401 handling in any `tokenLifecycle.ts` — silent, undetectable data-coverage drift        | **MEDIUM**                                                                                                                               |
| Webhook secret never generated on reconnect; UI tells users to do something that doesn't work       | **MEDIUM** (operational trust issue, not a data leak)                                                                                    |
| No webhook replay protection (no nonce/timestamp); Jira's secret rides in a URL query string        | **MEDIUM**                                                                                                                               |
| Narrow duplicate-notification race between webhook and poll paths                                   | **LOW–MEDIUM**                                                                                                                           |
| No security headers (CSP/HSTS/X-Frame-Options)                                                      | **MEDIUM**                                                                                                                               |
| CSRF relies solely on SameSite cookies, no Origin check                                             | **LOW–MEDIUM**                                                                                                                           |
| No CI — a real failing test currently ships silently                                                | **MEDIUM** (process risk, not a direct vulnerability)                                                                                    |
| Tenant isolation (IDOR) across ~35 sampled routes/actions                                           | **No issue found** — consistently org-scoped, including webhook routes' sound two-factor design                                          |
| Secrets at rest (OAuth client secrets, SMTP passwords)                                              | **No issue found** — correct AES-256-GCM                                                                                                 |
| Secrets in git history                                                                              | **No issue found** — `.env` never committed                                                                                              |

No CRITICAL findings. Nothing above was invented without direct code
evidence; each row cites the specific file the sub-audits verified.

---

## Phase 7 — Production Readiness

**P0 — blocks a real paid pilot:**

- No deployment path (no Dockerfile, no documented host)
- No health checks
- No error tracking / observability (a silent worker failure is invisible)
- No CI (regressions ship unnoticed — already happened once, harmlessly, with the stale test)
- No inbound rate limiting on webhook/signup endpoints
- Webhook-secret-on-reconnect bug + the UI instruction that doesn't fix it
- Narrow duplicate-alert race

**P1 — serious operational problems:**

- Silent 403 permission-drift blind spot
- No security headers, CSRF relies on SameSite alone
- No webhook replay protection
- DST/timezone gap with zero test coverage
- No backup/restore runbook
- Zero test coverage for the API/auth/org-scoping layer that tenant isolation depends on
- Docs/code drift across five stale doc files

**P2 — quality/polish:**

- CSV export not discoverable in the UI, not streamed
- No `error.tsx`/`not-found.tsx`, only one `loading.tsx`
- Stale "Linear disabled" UI comment
- Root `pnpm build` script broken (dead code, but bad signal)
- GitHub OAuth scope minimization (GitHub App vs OAuth App) — lower urgency since GitHub is a nice-to-have integration, not required for the core Zendesk+Jira pilot

---

## Phase 8 — Should We Build More Product?

### A. Should we build another product feature? **NO.**

**The product is feature-complete enough for the current scope.** Steps 0–25
already exceeded the original MVP — every MUST HAVE, SHOULD HAVE, and NICE TO
HAVE item from `plans/03-Product-and-MVP.md` is shipped and, per this audit,
actually works as designed. The DO NOT BUILD list (financial/service-credit
calculation, AI, team mapping, an OLA policy builder, a rules engine,
customer portals, write-back actions, a generic connector framework, more
integrations) remains fully in force — nothing in this audit found evidence
the product strategy has changed, and the roadmap below adds zero new
customer-facing capability.

**The next phase should be validation and production readiness, not
additional product surface** — with one addition specific to this codebase's
actual state: the validation motion itself (Phase 20/21 of `plans/05`) has
**not been run at all**. Forty target companies were listed; zero were
contacted per the tracked scorecard. That is the real strategic gap, not a
missing feature. The engineering work below exists only to make sure that
when outreach _does_ start converting to paid pilots, the product doesn't
embarrass itself with a silent worker failure, a double-sent breach alert, or
no way to find out something broke — not to add anything a customer would
notice as new capability.

**Recommendation, in order:**

1. Resume the actual validation motion from `plans/05` — outreach, interviews,
   concierge CSV analyses, the kill criteria. This is commercial work, not
   engineering, and it can start immediately in parallel with the roadmap below.
2. Work through the P0 items in Phase 9 before the first real paid pilot goes live —
   this is roughly 1–2 weeks of hardening, not a rebuild.
3. Do not schedule a "Step 39" of new features until 10+ paying customers ask
   for something specific, exactly as the existing roadmap's own deferred list says.

---

## Phase 9 — Roadmap From Step 26

Ordered by dependency and priority (P0 first). Each is one PR-sized,
independently testable unit. Deployment scope assumes: **single-instance
worker** (no distributed locking needed) and **Docker + self-host/VPS** as
the deployment target, per your answers above.

```md
- [x] 26 — Fix the two confirmed-broken behaviors this audit found

  Why:
  Two things are not "gaps" — they are actively broken today, and one of
  them contradicts what the product tells the user to do.

  Current problem:
  (a) `packages/db/test/integration-config.test.ts` asserts
  `isConfigurableIntegrationProvider("linear")` is `false`; the real
  implementation (`packages/db/src/integration-config.ts:18-25`) correctly
  returns `true`. The code is right, the test is stale.
  (b) `Integration.webhookSecret` is only set on the `create` branch of the
  OAuth callback upsert (`apps/web/src/app/api/integrations/{zendesk,jira}/callback/route.ts`).
  Disconnect never deletes the row, so reconnect always hits the `update`
  branch and never generates a secret. The settings UI
  (`apps/web/modules/settings/integrations/csr/WebhookInfo.tsx:75-81`) tells
  a user with no secret to "disconnect and reconnect" — this does not work.

  Scope:
  - Update the stale test assertion to match the correct current behavior.
  - Generate `webhookSecret` in the callback route's `update` branch when it
    is currently null, not only in `create`.
  - Update `WebhookInfo.tsx` copy to reflect what actually fixes it (or
    remove the incorrect instruction once the above makes reconnect work).
  - Remove the stale `{/* Linear — this is disabled for now */}` comment in
    `IntegrationsView.tsx:292`.

  Explicit non-goals:
  - Rotating webhook secrets for integrations that already have one (still
    an intentional v1 cut).

- [ ] 27 — CI pipeline (typecheck, lint, test, build)

  Why:
  There is no `.github` directory. Nothing runs automatically on push/PR.
  Step 26's stale test is proof this already cost real signal.

  Current problem:
  No CI configuration exists anywhere in the repo.

  Scope:
  - Add a GitHub Actions workflow running: `pnpm test` (root), `apps/web`
    `type-check` and `lint`, `apps/web` `build`, `prisma validate`.
  - Fix or remove the broken root `pnpm build` script (packages/core,
    packages/slack tsc failures — missing `node`/DOM lib types) so CI's
    green/red status is meaningful; since nothing consumes `dist/` for these
    workspace packages (main/types point at `./src/index.ts`), the simplest
    correct fix is deleting the unused `build` script and its `outDir`
    config rather than debugging a compile path nothing runs.
  - Require this workflow to pass before merge (branch protection), if you
    have admin access to configure it.

  Explicit non-goals:
  - Coverage thresholds or additional test types — just wiring up what
    already exists.

- [ ] 28 — Containerize and document deployment (Docker + self-host/VPS)

  Why:
  There is no way to run this in production today beyond a developer's
  laptop. This is the single largest gap between "the code works" and "a
  customer can rely on it for 30 days."

  Current problem:
  No Dockerfile anywhere; `docker-compose.yml` only runs Postgres; web/worker
  only have `pnpm dev`/`tsx` scripts.

  Scope:
  - Dockerfile for `apps/web` (multi-stage: install → `next build` → run
    `next start`).
  - Dockerfile for `apps/worker` (install → run `tsx src/index.ts` directly,
    matching how `start` already works — no need to fix the separately
    broken/unused `apps/worker` `tsc` build path unless it's simpler to just
    delete it too and run `tsx` in production the same as dev).
  - `docker-compose.prod.yml` (or an extended compose file) wiring web +
    worker + Postgres together with the real env vars from `.env.example`.
  - A `docs/deployment.md` documenting how to run it on a generic VPS.

  Explicit non-goals:
  - Any specific managed-hosting integration (Fly/Railway/Render-specific
    config) — keep it portable Docker.
  - Kubernetes, autoscaling, or multi-instance worker support.

- [ ] 29 — Health checks and observability

  Why:
  Right now, if the worker silently stops processing an org's integration,
  or the web app throws in production, nobody finds out until a customer
  complains. That is not survivable for an unattended 30-day pilot.

  Current problem:
  No `/api/health` route. The worker is a bare `setInterval` process with no
  HTTP surface at all. No error-tracking SDK anywhere in the repo.

  Scope:
  - Add `GET /api/health` to `apps/web` (checks DB connectivity at minimum).
  - Give `apps/worker` a minimal HTTP listener exposing a liveness endpoint
    (it already tracks `lastSyncAt`/`lastSyncError` per integration — surface
    an aggregate "last successful cycle" timestamp too).
  - Wire in an error-tracking SDK (e.g. Sentry) for both `apps/web` and
    `apps/worker`, capturing at minimum: unhandled exceptions, and each
    `Integration.lastSyncError` write.
  - Alert (email/Slack to you, not the customer) when a worker cycle hasn't
    completed successfully within N× its expected interval.

  Explicit non-goals:
  - Full APM/tracing, metrics dashboards, or log aggregation infrastructure.

- [ ] 30 — Inbound abuse protection and webhook replay protection

  Why:
  No route in the app has any rate limiting. The two webhook routes are
  unauthenticated by session by design (external providers call them) and
  currently have nothing slowing down high-volume secret-guessing; `/api/sign-up`
  has no throttle either. Separately, both webhook receivers verify only a
  static secret with no replay protection.

  Current problem:
  `apps/web/src/proxy.ts` only does auth-cookie gating, no rate limiting
  anywhere in the app. `packages/{zendesk,jira}/src/webhook.ts` verify a
  constant-time secret compare but nothing else — a captured request replays
  indefinitely.

  Scope:
  - Add basic rate limiting (IP- or integration-id-keyed) to
    `/api/webhooks/{zendesk,jira}/[integrationId]` and `/api/sign-up` (and
    `/api/auth` sign-in if not already covered by NextAuth).
  - Add a timestamp check to both webhook payloads' verification (reject
    requests older than a few minutes) as cheap replay mitigation, alongside
    the existing secret check — not a replacement for it.

  Explicit non-goals:
  - A general-purpose rate-limiting library/gateway for every route — scope
    to the routes reachable without a session.

- [ ] 31 — Fix the notification double-delivery race

  Why:
  `Notification`'s unique constraint prevents a second database row, but the
  actual Slack/email send happens before that row is written, so a
  webhook-triggered pipeline and a concurrently running poll cycle can both
  send the same alert before either's dedup check sees the other's row. A
  customer getting paged twice for one breach is a small but real trust dent
  at exactly the wrong moment.

  Current problem:
  `packages/notifications/src/dispatch.ts:97-156` — dedup check is a
  pre-send read, not a claim; the send happens before the row exists.

  Scope:
  - Reorder to claim-before-send: attempt the `Notification` row `create()`
    first (relying on the existing `@@unique([commitmentId, threshold])` to
    fail fast on a race), and only send Slack/email after the claim
    succeeds; roll back or mark the row on send failure so it can retry.

  Explicit non-goals:
  - Any change to the deduplication key itself or the channels supported.

- [ ] 32 — Detect silent permission loss (403) across all integrations

  Why:
  A connecting user losing Browse/Read access on the provider side produces
  a narrower (or empty) API result, not an error. Today this degrades
  ingestion invisibly — no `reauthRequired`, no operator-visible symptom, no
  way for the customer or you to know why a case's engineering-leg data went
  quiet. This is the least fixable-after-the-fact trust issue in the audit,
  since by the time someone notices, the historical gap has already formed.

  Current problem:
  Zero handling of HTTP 403 in any of the 5 `tokenLifecycle.ts` files
  (zendesk, jira, linear, intercom, github) — confirmed by direct grep.

  Scope:
  - Add 403 detection to each provider's client/tokenLifecycle, distinct
    from the existing 401/`reauthRequired` path — e.g. a new
    `IntegrationStatus` value or a flag surfaced on the `Integration` row.
  - Surface this distinctly in the settings UI (different message from
    "reconnect required" — this needs the _connecting user's_ provider-side
    permissions restored, not a new OAuth grant).

  Explicit non-goals:
  - Automatically detecting _which_ specific project/repo/team became
    inaccessible — flagging that something narrowed is enough for v1.

- [ ] 33 — Security headers and CSRF hardening

  Why:
  No CSP/HSTS/X-Frame-Options/X-Content-Type-Options anywhere; CSRF
  protection today is entirely implicit (SameSite cookie behavior), with no
  explicit Origin check on state-changing routes.

  Current problem:
  `apps/web/next.config.mjs` has no `headers()` config; `apps/web/src/proxy.ts`
  only gates auth, sets no headers.

  Scope:
  - Add a `headers()` block (or middleware) setting CSP, HSTS,
    X-Frame-Options: DENY, X-Content-Type-Options: nosniff.
  - Add an Origin-header check to state-changing POST routes under
    `/api/settings/**` and `/api/integrations/**/disconnect` as defense in
    depth beyond SameSite cookies.

  Explicit non-goals:
  - A full CSP nonce/report-uri pipeline — start with a reasonably strict
    static policy and iterate.

- [x] 34 — DST/timezone correctness for the business-hours engine

  Why:
  This product sells correctness of a time calculation. `calendar.ts`'s own
  comment admits its local↔UTC conversion is imprecise across a DST
  transition, and every existing test uses `timezone: "UTC"` — the one case
  the code warns about itself is completely untested. A customer with
  non-UTC business hours (the norm, not the exception, for this ICP) could
  get a subtly wrong number with no test to have caught it.

  Current problem:
  `packages/core/src/calendar.ts:52-54` (documented approximation);
  `packages/core/test/calendar.test.ts` (zero non-UTC or DST-transition cases).

  Scope:
  - Add test cases for a non-UTC timezone (e.g. America/New_York) across a
    DST spring-forward and fall-back boundary.
  - Fix `zonedDateToUtc`'s imprecision if the new tests expose a real
    miscalculation, or document precisely which cases remain approximate
    if a full fix isn't warranted.

  Explicit non-goals:
  - Per-customer timezone UI beyond what already exists (calendar import
    and override) — this is a correctness fix to the existing calendar
    engine, not a new configuration surface.

- [x] 35 — Close the remaining UI/trust gaps

  Why:
  Several small, independently shippable gaps remain: the CSV export exists
  but has no UI entry point, most routes have no loading state, and there
  are no error boundaries anywhere in the app.

  Current problem:
  `apps/web/src/app/api/reports/commitments/route.ts` has no linked button
  anywhere in the app (confirmed via grep — only in-page client CSV exports
  exist elsewhere). Only one `loading.tsx` exists app-wide; zero `error.tsx`/
  `not-found.tsx`.

  Scope:
  - Add a visible "Export full report" link/button somewhere sensible
    (dashboard or settings) pointing at the existing route.
  - Add `error.tsx` at the app root (and `not-found.tsx`) so an unhandled
    exception shows a branded error page, not Next's default.
  - Add `loading.tsx` to the remaining top-level routes that don't have one
    (cases, settings, onboarding).

  Explicit non-goals:
  - Streaming the CSV export — note it as a known limitation for very large
    orgs, revisit only if a real customer's export becomes slow.

- [x] 36 — Reconcile documentation with shipped integrations

  Why:
  `docs/customer-guide.md` is accurate and current. Five other doc files
  (`integrations.md`, `getting-started.md`, `how-it-works.md`,
  `sla-timing.md`, `dashboard-and-cases.md`, `troubleshooting.md`) predate
  Linear/GitHub/Intercom and only mention Zendesk/Jira/Slack — a reader of
  those alone wouldn't know three shipped integrations exist.

  Current problem:
  Two independently-maintained doc sets (`docs/*.md` and the in-app
  `apps/web/src/app/docs/**` pages) have drifted apart; the in-app pages
  already cover all providers correctly.

  Scope:
  - Update the five stale `docs/*.md` files to match current integration
    scope, or retire them in favor of `docs/customer-guide.md` plus the
    already-correct in-app `/docs` pages — pick whichever this team actually
    intends to keep maintaining going forward.
  - Expand `README.md` past its one-line stub: what this is, how to run it
    locally (link to the new `docs/deployment.md` from step 28), where the
    docs live.

  Explicit non-goals:
  - Rewriting `docs/customer-guide.md`, which is already accurate.

- [x] 37 — Backup runbook and tenant-isolation regression tests

  Why:
  Two different kinds of safety net are both currently absent: a documented
  way to recover the database, and any automated test proving the
  org-scoping pattern that tenant isolation depends on actually holds. The
  IDOR audit in this document found the pattern is followed consistently
  today — but nothing would catch a future regression.

  Current problem:
  No backup strategy mentioned anywhere in `docs/`, `README.md`, or
  `docker-compose.yml`. `apps/web/test/` has only 2 files — zero tests for
  any API route, the auth strategy, or cross-tenant access attempts.

  Scope:
  - Document (and minimally automate, e.g. a scheduled `pg_dump`) a backup
    and restore procedure for the Postgres database.
  - Add a focused regression test suite hitting a representative sample of
    API routes/actions (dashboard, case detail, settings writes) with two
    organizations' sessions, asserting org B can never read or write org A's
    data — directly encoding the pattern this audit verified by hand.

  Explicit non-goals:
  - Full route-by-route test coverage — target the highest-risk, most
    reused data-access helpers (`case-detail-data.ts`, `dashboard-data.ts`,
    the settings write routes) rather than exhaustive coverage.

- [x] 38 — Minimize GitHub's OAuth scope

  Why:
  Every other integration in this product requests a genuinely read-only
  scope. GitHub's classic OAuth App `repo` scope is write-capable — the
  product never uses that capability, but a security-conscious customer's
  review of the requested permissions would find the one exception to an
  otherwise consistent "read-only" story. Lower urgency than the P0/P1 items
  above since GitHub is a nice-to-have integration, not required for the
  core Zendesk+Jira pilot.

  Current problem:
  `packages/github/src/oauth.ts:9-17` — `repo` scope, documented in-code as
  an accepted GitHub API limitation for a Classic OAuth App.

  Scope:
  - Evaluate migrating from a GitHub OAuth App to a GitHub App with
    read-only, repository-selected installation permissions (Pull requests:
    read, Contents: read) — this is the actual mechanism GitHub provides for
    a true least-privilege, read-only integration.
  - If migration is a larger lift than this step should carry, document the
    limitation prominently in the GitHub settings card and this product's
    security-facing materials instead, and split the migration into its own
    follow-up.

  Explicit non-goals:
  - Any change to what GitHub data is actually read or how correlation works.
```

---

## Verification

For each roadmap step: run `pnpm test` (once CI exists, it runs this
automatically), `apps/web`'s `type-check` and `build`, and manually exercise
the affected flow in the browser (webhook reconnect for step 26, the actual
Docker image for step 28, the health endpoint for step 29, etc.) — the same
per-step verification discipline the existing `implementation-plans/roadmap.md`
entries already describe having used.

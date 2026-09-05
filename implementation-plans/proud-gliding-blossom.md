# SLA Breach Monitoring — Foundation Build

## Context

The project has spent Phases 1–22 on research and validation planning (market, ICP, positioning, architecture sketch, pricing, GTM). The user has now decided to skip the validation gate (`07-Phase-Status.md` explicitly offered this option) and start real implementation, using `04-Architecture-Sketch.md` and `03-Product-and-MVP.md` as the spec. There is currently zero code in this directory — it is docs-only.

This pass builds the **foundation**: the pure domain engine that makes the product's core claim ("our SLA number is the true one, and it's reproducible") defensible, plus the database schema and repo scaffold it needs to live in. No UI, no live Zendesk/Jira wiring, no auth, no Slack — those are explicitly deferred to a later pass, per the user's own priority call.

Decisions already made (via user's answers):
- **Stack**: Next.js (App Router) + TypeScript + PostgreSQL + Prisma, pnpm workspaces monorepo.
- **Integrations**: mocked/fixture-driven for now — no real OAuth app credentials yet.
- **Priority**: foundation first — schema + pure SLA/OLA engine + types + tests, nothing else.

## Why this design (from the spec)

The single load-bearing architectural decision from `04-Architecture-Sketch.md` Phase 12: **store events, never store computed time.** Elapsed time, deadlines, and breach status are always a pure function of `(ordered normalized events, policy version, calendar version)`. This is what's being built first, because it's the part that's expensive to get wrong and cheap to change nothing else around.

## Repo layout

```
/
├── package.json                  # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── .env.example
├── packages/
│   ├── core/                     # pure domain: types + SLA/OLA engine, zero I/O
│   │   ├── src/
│   │   │   ├── types.ts          # Organization, Case, Commitment, Evaluation, etc.
│   │   │   ├── calendar.ts       # BusinessCalendarVersion walk (deadline calc)
│   │   │   ├── elapsed.ts        # pause-aware elapsed-time folding over events
│   │   │   ├── commitments.ts    # policy matching, commitment creation
│   │   │   ├── legs.ts           # OLA ownership model — LegSpan derivation
│   │   │   ├── evaluate.ts       # breach/at-risk evaluation (pure)
│   │   │   └── index.ts
│   │   ├── test/                 # Vitest unit tests, one file per module above
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── db/                       # Prisma schema + generated client, no business logic
│       ├── prisma/schema.prisma
│       ├── package.json
│       └── tsconfig.json
├── apps/
│   ├── web/                      # Next.js app — placeholder scaffold only this pass
│   └── worker/                   # polling worker — placeholder scaffold only this pass
└── vitest.config.ts
```

`packages/core` has **no dependency on `packages/db` or any provider SDK** — it takes and returns plain data. This is what makes it unit-testable without a database and reusable from both `apps/web` and `apps/worker` later.

## Database schema (`packages/db/prisma/schema.prisma`)

Model the entity list from Architecture Sketch Phase 12 directly:

| Model | Notes |
|---|---|
| `Organization` | tenant boundary |
| `User` | belongs to Organization |
| `Integration` | one connected system + cursor position (credentials field left as placeholder JSON for now — no real OAuth this pass) |
| `RawEvent` | append-only; `sourceHash` unique-ish per `(integrationId, providerEventId)` |
| `NormalizedEvent` | append-only; `{caseId, type, occurredAt, actor, fromState, toState, sourceRawEventId}` |
| `Customer` | derived from Zendesk orgs (field for now, no live sync) |
| `Case` | mutable projection, one per customer request |
| `CaseLink` | `method` enum (`official_link`\|`remote_link`\|`pattern`\|`manual`), `confidence` enum (`certain`\|`probable`) |
| `SLAPolicy` + `SLAPolicyVersion` | append-only versions, `effectiveFrom`, `pauseOnStates` (string array of normalized states), `targets` (JSON), `warnAtPercent` (int array) |
| `BusinessCalendar` + `BusinessCalendarVersion` | append-only versions, `weekly` (JSON), `holidays` (string array), `alwaysOpen` |
| `Commitment` | `policyVersionId` + `calendarVersionId` frozen at creation |
| `LegSpan` | derived/recomputable, `leg` enum (`support`\|`engineering`\|`waiting_customer`\|`unknown`), `confidence` enum (`certain`\|`inferred`\|`unknown`) |
| `Evaluation` | immutable snapshot, stores `inputs` (lastEventId/policyVersionId/calendarVersionId) as JSON |
| `Notification` | dedup key `(commitmentId, threshold)` unique |

Breach is **not** a separate table — it's an `Evaluation` row with `status = 'breached'`, matching the spec exactly.

## Core engine — what each module does

Straight from Architecture Sketch Phase 13/14, translated into pure TS functions:

- **`calendar.ts`** — `computeDeadline(startInstant, targetMinutes, calendar): Date`. Walks forward from start, accumulating only working minutes per the calendar's weekly hours + holidays; `alwaysOpen` is the 24/7 degenerate case (single code path, no branching by policy type).
- **`elapsed.ts`** — `computeElapsedWorkingMinutes(events, pauseOnStates, calendar): { elapsed, pausedIntervals }`. Folds the ordered normalized-event stream into running/paused intervals based on `pauseOnStates` (semantic states, never provider strings), intersects running intervals with working hours, sums.
- **`commitments.ts`** — `matchPolicyVersion(caseAttributes, activePolicyVersions): SLAPolicyVersion | null` (most-specific-first matching) and `createCommitment(...)` which freezes `policyVersionId`/`calendarVersionId` onto the result.
- **`legs.ts`** — `deriveLegSpans(events): LegSpan[]` implementing the ownership model table (support / engineering / waiting_customer / unknown) and the hard-cases table (ambiguous handoff → `unknown` span; missing handoff → bounded + `inferred`; multiple linked issues → attribute to `engineering`, note count; impossible spans → data-quality warning, never silently normalized).
- **`evaluate.ts`** — `evaluateCommitment(commitment, events, policyVersion, calendar): Evaluation`. Pure; same inputs always produce the same output (the reproducibility guarantee in Phase 13.8). Status transitions: `on_track → at_risk → met | breached`, using `warnAtPercent` thresholds.

## Testing

Vitest, one suite per module, covering the spec's own hard cases explicitly (these are correctness requirements, not nice-to-haves):
- Calendar walk across a holiday and a weekend boundary; `alwaysOpen` 24/7 case.
- Elapsed time with zero, one, and multiple pause intervals; pause caused by a non-customer state must **not** pause the customer-facing commitment (Phase 13.4's core rule).
- Leg derivation: clean handoff, ambiguous/missing handoff (`unknown`/`inferred`), multiple linked issues (attribute to engineering, don't split), impossible/overlapping spans (flagged, not silently fixed).
- Evaluation reproducibility: same `(events, policyVersion, calendarVersion)` in → identical `Evaluation` out, called twice.
- Breach/at-risk threshold transitions at the configured `warnAtPercent` steps.

## Explicitly not in this pass

Real Zendesk/Jira adapters and OAuth, the correlator's live linking logic, the polling scheduler's actual loop, the Next.js dashboard UI, auth, Slack notifications, CSV export. `apps/web` and `apps/worker` are created as directory scaffolds (package.json + a placeholder entrypoint) so the workspace resolves and the shape is right, but are not built out functionally this pass.

## Verification

1. `pnpm install` at root resolves the workspace.
2. `pnpm --filter core test` runs the Vitest suite; all tests pass, including the hard-case scenarios above.
3. `pnpm --filter db exec prisma validate` confirms the schema is syntactically valid (no live database needed for this).
4. Manually inspect that `packages/core` has zero imports from `packages/db` or any HTTP/provider library — grep for `import` statements to confirm the pure/impure boundary holds.

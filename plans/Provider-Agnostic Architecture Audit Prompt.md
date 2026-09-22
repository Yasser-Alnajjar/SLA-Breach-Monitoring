# Provider-Agnostic Architecture Audit — SLA Watchtower

## Objective

Analyze the **current SLA Watchtower codebase as it exists today** and determine whether we can evolve it from a Zendesk-centric architecture into a **provider-agnostic domain architecture** without rewriting the core product.

Do **not** implement anything.

Do **not** refactor anything.

Do **not** create files.

This task is strictly an **architecture/code audit**.

The question we need answered is:

> Can Watchtower become independent from Zendesk at the domain/application level, while keeping Zendesk, Intercom, Freshdesk, etc. as interchangeable data providers?

The intended architecture is:

```text
Provider
   ↓
Provider Adapter
   ↓
Raw Events
   ↓
Normalizer
   ↓
Normalized Events
   ↓
Domain Model
   ↓
SLA / Commitment Engine
   ↓
Dashboard / Notifications / Reports
```

The critical architectural principle is:

> **Providers are sources of facts. Watchtower is the owner of normalized domain state and computed service-commitment state.**

The provider should tell us what happened.

Watchtower should determine what that means.

---

# 1. Read the project architecture first

Before inspecting code, read these project documents:

- `00-Verdict.md`
- `02-Vertical-Wedge-ICP.md`
- `03-Product-and-MVP.md`
- `04-Architecture-Sketch.md`
- `05-Validation-and-Kill-Criteria.md`

Pay particular attention to:

### Architecture principles

- `Adapter → RawEvent → NormalizedEvent → Domain`
- Store events, never store computed time.
- The SLA engine must operate on normalized events.
- Commitments are bound to immutable policy/calendar versions.
- Provider-specific concepts should stop at the adapter/normalization boundary.
- Evidence is rendered from normalized events and evaluations.
- Cross-system correlation should be deterministic where possible.

The architecture document explicitly states that the adapter is the provider-aware boundary and everything after it should be provider-agnostic.

---

# 2. Inspect the actual codebase

Trace the real code from ingestion all the way to the UI.

Do not rely on filenames alone.

Follow actual imports and data flow.

Start from:

- Zendesk integration
- webhook handlers
- polling/backfill workers
- normalization
- event persistence
- case creation/update
- customer resolution
- SLA policy import
- calendar import
- commitment creation
- SLA calculation
- breach detection
- notifications
- dashboard queries
- case detail/timeline
- server actions
- API routes
- database models
- background jobs

Build an actual dependency map.

For every important flow, answer:

```text
Provider
  ↓
Where does provider-specific data enter?
  ↓
Where is it transformed?
  ↓
Where is it persisted?
  ↓
Where does it become domain data?
  ↓
Which layer consumes it?
```

---

# 3. Find every Zendesk assumption

Search the entire codebase for places where the domain implicitly assumes Zendesk.

Do not only search for:

```text
zendesk
Zendesk
```

Also look for semantic coupling such as:

```text
organization
ticket
ticket status
ticket priority
ticket audit
ticket event
Zendesk organization → Customer
Zendesk ticket → Case
Zendesk SLA policy → SLAPolicy
Zendesk calendar → BusinessCalendar
```

Identify places where a generic domain concept is actually represented by a Zendesk-specific type, field, ID, enum, database relation, or service.

Examples of what I want you to detect:

```ts
type Customer = ZendeskOrganization
```

or:

```ts
customerId = zendeskOrganizationId
```

or:

```ts
case.status = zendeskTicket.status
```

or:

```ts
getZendeskOrganization(...)
```

inside application/domain code.

Also detect indirect coupling such as:

```text
Server Action
  → Zendesk service
  → database
```

when it should be:

```text
Server Action
  → application/domain service
  → provider adapter
```

---

# 4. Analyze the Customer model

The current architecture originally derives customers from Zendesk organizations.

Determine whether the current implementation makes:

```text
Customer == Zendesk Organization
```

or whether it already supports:

```text
Customer
  ├── Zendesk reference
  ├── Intercom reference
  ├── Freshdesk reference
  └── other provider references
```

Inspect:

- Prisma schema
- TypeScript domain types
- customer creation/update logic
- customer queries
- customer UI
- case/customer relations
- policy matching

Answer:

### A. Current implementation

How is a Customer represented today?

### B. Coupling

Where does Zendesk leak into the Customer domain?

### C. Required change

What is the smallest architectural change needed to make Customer provider-independent?

Do NOT implement it.

---

# 5. Analyze the Case model

Determine whether:

```text
Case = Zendesk Ticket
```

or whether:

```text
Case
  ├── canonical Watchtower identity
  └── CaseLink[]
       ├── Zendesk ticket
       ├── Jira issue
       └── future provider records
```

is already possible.

Inspect:

- Case schema
- CaseLink schema
- external IDs
- correlation logic
- case creation
- case update
- case detail page
- timeline
- notifications
- dashboard

Pay special attention to whether the system can represent:

```text
one domain Case
+
multiple provider records
```

without making Zendesk the canonical identity.

---

# 6. Analyze SLA Policy ownership

This is extremely important.

Determine whether the current system treats:

```text
Zendesk SLA Policy
```

as:

```text
Watchtower SLA Policy
```

or merely as imported configuration.

We need to distinguish:

```text
Provider Policy
```

from:

```text
Domain SLAPolicyVersion
```

The desired conceptual flow is:

```text
Zendesk Policy
      ↓
Zendesk Adapter
      ↓
Provider Policy DTO
      ↓
Policy Mapper
      ↓
Watchtower SLAPolicyVersion
      ↓
Commitment
```

The SLA engine should never need to know that the policy originally came from Zendesk.

Inspect:

- Prisma schema
- policy import
- policy versioning
- policy matching
- commitment creation
- policy CRUD
- Phase 4 native policy/calendar work
- server actions
- UI
- background reconciliation

Determine whether Phase 4 has already moved the architecture toward Watchtower-owned policies.

Specifically answer:

> If Zendesk disappeared tomorrow, could an existing Watchtower policy still exist and continue evaluating commitments?

---

# 7. Analyze Business Calendars

Perform the same analysis for calendars.

Current intended architecture:

```text
Provider Calendar
       ↓
Import
       ↓
Watchtower BusinessCalendarVersion
       ↓
Commitment
```

Determine whether the current implementation instead assumes:

```text
Calendar = Zendesk Schedule
```

Inspect:

- calendar schema
- import logic
- versioning
- policy relationship
- commitment relationship
- SLA engine
- calendar UI
- Phase 4 native calendar management

Important question:

> Can Watchtower create and own a BusinessCalendar without Zendesk?

---

# 8. Analyze the Normalized Event boundary

This is one of the most important parts of the audit.

Find the actual implementation of:

```text
RawEvent
NormalizedEvent
```

Determine:

### Provider-specific side

What provider-specific fields exist?

### Domain side

Does `NormalizedEvent` actually contain provider-independent facts?

For example:

```ts
{
  caseId,
  type,
  occurredAt,
  actor,
  fromState,
  toState,
  sourceRawEventId
}
```

The SLA engine should consume normalized facts, not Zendesk objects.

Verify whether the current SLA engine can run with:

```text
NormalizedEvent[]
+
SLAPolicyVersion
+
BusinessCalendarVersion
```

without importing any Zendesk package/module/type.

---

# 9. Analyze the SLA engine

This is a hard boundary.

Inspect the entire dependency tree of the SLA engine.

I want an explicit answer to:

> Does the SLA engine know Zendesk exists?

Check for:

- Zendesk imports
- Zendesk status enums
- Zendesk priority types
- Zendesk ticket objects
- Zendesk-specific pause logic
- Zendesk-specific timestamps
- Zendesk-specific business-hour behavior

The desired architecture is:

```ts
evaluate(
  events,
  policyVersion,
  calendarVersion
)
```

not:

```ts
evaluateZendeskTicket(ticket)
```

or:

```ts
evaluate(ticket, zendeskPolicy, zendeskSchedule)
```

---

# 10. Analyze correlation

Inspect the current Zendesk ↔ Jira correlation implementation.

Determine whether correlation produces a provider-independent concept such as:

```ts
CaseLink {
  caseId
  provider
  externalId
  method
  confidence
}
```

or whether the domain directly stores things like:

```text
zendeskTicketId
jiraIssueId
```

throughout the application.

The desired architecture is:

```text
Case
 └── CaseLink[]
      ├── provider = zendesk
      └── provider = jira
```

with provider-specific logic isolated to correlation/adapters.

Also determine whether adding:

```text
Intercom
Freshdesk
Linear
```

would require changes to:

- SLA engine
- commitment logic
- dashboard
- case timeline
- notifications
- domain models

or only:

- adapter
- normalizer
- mapper
- provider-specific integration code.

---

# 11. Analyze Application/Actions layer

Inspect all:

- Server Actions
- route handlers
- application services
- loaders
- mutations
- dashboard actions
- case actions
- policy actions
- calendar actions
- integration actions

Find cases where the application layer directly calls Zendesk.

For example:

```text
DashboardAction
  → ZendeskClient
```

or:

```text
CaseAction
  → Zendesk API
```

instead of going through a provider-independent application/domain boundary.

Categorize every finding:

### Good

```text
Action
 → domain/application service
 → provider interface
 → Zendesk adapter
```

### Coupled

```text
Action
 → Zendesk service
```

### Critical

```text
Domain/SLA engine
 → Zendesk-specific code
```

---

# 12. Analyze the database schema

Inspect the Prisma schema and classify every provider-specific field/relation.

Create a table:

| Entity | Field | Provider-specific? | Why | Required change |
|---|---|---:|---|---|
| Customer | ... | yes/no | ... | ... |
| Case | ... | yes/no | ... | ... |
| CaseLink | ... | yes/no | ... | ... |
| Policy | ... | yes/no | ... | ... |
| Calendar | ... | yes/no | ... | ... |
| Event | ... | yes/no | ... | ... |
| Commitment | ... | yes/no | ... | ... |

Pay particular attention to foreign keys and IDs.

Example:

```text
zendeskOrganizationId
zendeskTicketId
zendeskPolicyId
zendeskScheduleId
```

Determine whether each is:

1. legitimately provider metadata/reference
2. incorrectly acting as canonical domain identity
3. preventing provider independence

---

# 13. Test the "Zendesk disappears tomorrow" scenario

Perform a conceptual architecture test.

Assume:

```text
Zendesk integration is disconnected permanently.
```

Then answer:

### What continues working?

### What stops working?

### What gets deleted?

### What becomes invalid?

### What domain objects remain valid?

### Can existing commitments still be evaluated?

### Can historical cases still be displayed?

### Can policies still exist?

### Can calendars still exist?

### Can a new provider be connected without changing domain models?

This is the most important practical test.

---

# 14. Test a hypothetical Intercom provider

Do NOT implement it.

Instead, mentally model:

```text
IntercomAdapter
```

providing:

```text
Conversation
Customer
Events
```

Ask:

> How many files outside the integration/adapter/normalizer layer would need to change?

Classify changes as:

```text
0–5 files     → strong abstraction
6–15 files    → moderate coupling
16–30 files   → significant coupling
30+ files     → architecture is still provider-centric
```

Do not use this as a formal metric; use it as an indicator.

---

# 15. Test a hypothetical Freshdesk provider

Repeat the same exercise with:

```text
FreshdeskAdapter
```

The goal is not feature parity.

The goal is:

```text
Provider
   ↓
Adapter
   ↓
Normalized facts
   ↓
Existing Watchtower domain
```

If adding a provider requires modifying the SLA engine, commitment model, dashboard domain logic, or evaluation engine, identify why.

---

# 16. Identify the minimum migration path

Do NOT propose a rewrite.

We want an incremental migration.

Organize the migration into stages such as:

```text
Stage 1
Remove Zendesk leakage from domain types

Stage 2
Introduce canonical provider references

Stage 3
Separate provider DTOs from domain models

Stage 4
Move Zendesk-specific mapping into adapters

Stage 5
Make policy/calendar ownership explicit

Stage 6
Make application services provider-independent

Stage 7
Prove the architecture with a second provider
```

But do not assume these stages are correct.

Derive the actual migration sequence from the codebase.

For every stage provide:

- exact files/modules
- current coupling
- proposed boundary
- risk
- whether database migration is required
- whether behavior changes
- whether existing Zendesk behavior can remain unchanged

---

# 17. Separate "must change" from "nice architecture"

This is critical.

Do NOT recommend abstractions just because they are architecturally elegant.

For every proposed change classify it as:

### MUST

Required for provider independence.

### SHOULD

Strongly recommended but not blocking.

### OPTIONAL

Useful future architecture but unnecessary now.

### DO NOT CHANGE

Already correctly designed.

We specifically do NOT want:

- generic connector frameworks
- plugin SDKs
- over-engineered provider registries
- unnecessary factories
- premature generic abstractions
- rewriting the SLA engine
- rewriting the event model if it is already provider-independent

The original architecture explicitly rejected a generic connector/plugin SDK for the MVP because it would be premature abstraction.

---

# 18. Produce a coupling map

Create a final map like:

```text
                    Zendesk
                       │
          ┌────────────┼─────────────┐
          │            │             │
       Adapter       Policy       Customer
          │            │             │
          ▼            ▼             ▼
      RawEvent      Domain?       Domain?
          │
          ▼
    NormalizedEvent
          │
          ▼
       Case
          │
          ▼
    SLA Engine
          │
          ▼
     Evaluation
```

Mark every connection as:

```text
GREEN  = correctly isolated
YELLOW = provider-aware but acceptable
RED    = provider leakage into domain
```

---

# 19. Final verdict

End the audit with exactly these sections:

## A. Overall verdict

Choose one:

```text
READY
READY WITH LIMITED REFACTORING
SIGNIFICANT REFACTORING REQUIRED
ARCHITECTURAL REWRITE REQUIRED
```

Explain why.

## B. Current architecture score

Score these independently from 0–10:

- Provider isolation
- Domain independence
- Event normalization
- Customer abstraction
- Case abstraction
- Policy abstraction
- Calendar abstraction
- SLA engine independence
- Correlation abstraction
- Application-layer independence
- Database independence

Do NOT give a single "overall architecture score" unless it is useful; prioritize the individual dimensions.

## C. Biggest 10 coupling points

Rank them by architectural impact, not by code size.

For each:

```text
Location:
Current behavior:
Why it couples Watchtower to Zendesk:
Impact:
Minimal fix:
```

## D. What is already correct

Explicitly identify existing code that should NOT be changed.

## E. Minimum migration plan

Give the smallest safe sequence of changes required to achieve:

```text
Zendesk
Intercom
Freshdesk
...
   ↓
Provider Adapter
   ↓
Normalized Domain
   ↓
Same Watchtower engine
```

## F. Second-provider proof

Identify the smallest realistic second-provider implementation that would prove the abstraction.

Do not implement it.

Explain what would need to be added and what should remain untouched.

## G. Critical architectural conclusion

Answer this directly:

> **If we removed Zendesk tomorrow, would Watchtower still own a coherent domain model, or would most of the application collapse with the integration?**

Then explain exactly why.

---

# Important constraints

1. **Do not modify code.**
2. **Do not create files.**
3. **Do not suggest a rewrite unless the code actually proves one is necessary.**
4. **Do not assume the architecture is correct just because the documentation says it is.**
5. **Inspect the real implementation.**
6. **Trace imports and data flow.**
7. **Use exact file paths and symbols in your findings.**
8. **Separate facts from recommendations.**
9. **Do not propose adding Intercom/Freshdesk yet unless necessary to prove the architecture.**
10. **The goal is provider independence, not generic abstraction for its own sake.**

The desired end state is:

```text
                ┌─────────────┐
                │   Zendesk   │
                └──────┬──────┘
                       │
                ┌──────▼──────┐
                │   Adapter   │
                └──────┬──────┘
                       │
                ┌──────▼──────┐
                │ Raw Events  │
                └──────┬──────┘
                       │
                ┌──────▼──────┐
                │ Normalizer  │
                └──────┬──────┘
                       │
                       │
                ┌──────▼──────────────────────┐
                │     WATCHTOWER DOMAIN       │
                │                              │
                │ Customer                     │
                │ Case                         │
                │ CaseLink                     │
                │ SLAPolicyVersion             │
                │ BusinessCalendarVersion      │
                │ Commitment                   │
                │ Evaluation                   │
                │ LegSpan                      │
                └──────┬───────────────────────┘
                       │
                ┌──────▼──────┐
                │ SLA Engine  │
                └──────┬──────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      Dashboard   Notifications   Reports
```

And eventually:

```text
Zendesk ───────┐
Intercom ──────┤
Freshdesk ─────┤
Linear ────────┤
Future ────────┘
       ↓
   Adapters
       ↓
   Normalized
   Watchtower
    Domain
```

The critical requirement is that **adding a provider should primarily add provider-specific ingestion/mapping code, not change the core SLA/commitment/evaluation model.**

Return the audit only. Do not make any changes.
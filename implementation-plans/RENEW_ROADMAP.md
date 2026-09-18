Yes, and in my opinion, this is the right approach. The new roadmap should be a **Product Completion Roadmap, not just a Hardening Roadmap**.

I will divide it into 4 clear layers:

- **A — Existing & Broken:** Exists, but needs to be fixed.
- **B — Existing but Incomplete:** Partially implemented, needs to be completed.
- **C — Not Built Yet:** Required feature that still needs to be built.
- **D — Out of Scope:** Not going to be built for now.

And I will order the implementation so that we do not build new features on top of unstable components.

# SLA Watchtower — Product Completion Roadmap

**Status baseline:** 2026-09-19
**Capacity:** 10–15 hours/week
**Goal:** Reach a genuinely production-ready MVP for Zendesk + Jira, with Intercom/Linear/GitHub as Beta integrations.

---

# Phase 0 — Baseline & Scope Lock

### Goal

Establish exactly what already exists and what is still required, and prevent Claude from inventing features or performing unnecessary refactors.

### Already implemented

- Next.js application
- Authentication
- Multi-tenancy
- Zendesk integration
- Intercom integration
- Jira integration
- Linear integration
- GitHub integration
- SLA engine
- First Response
- Next Reply
- Resolution
- Business hours
- Calendars
- Holidays
- Customer calendar overrides
- Policy matching
- Active commitment re-resolution
- Dashboard
- Cases
- Case detail
- Conversation
- Activity Timeline
- Alerts
- Anomaly detection
- Worker
- Docker deployment
- Sentry
- Backups
- CI

### Required in this phase

Create a clear inventory for every feature:

```text
DONE
DONE BUT BROKEN
PARTIALLY IMPLEMENTED
NOT IMPLEMENTED
OUT OF SCOPE
```

### Do not change the architecture here.

---

# Phase 1 — Fix Existing Core / P0

**Goal:** Make the existing functionality reliable before adding new features.

## 1. SLA Engine

### Exists but needs fixes

- Active commitment re-resolution
- Resolution
- Next Reply
- First Response
- Policy matching
- Evaluation persistence
- Commitment selection

### Required fixes

**Re-resolution**

- normal → high
- high → normal
- normal → urgent
- customer/tier changes
- calendar changes
- missing target
- finalized commitments must remain immutable
- breached commitments must not be un-breached

**Commitment selection**

Remove:

```text
commitments[0]
```

and use deterministic ordering.

**Evaluation**

Prevent an old evaluation from overwriting:

- cancelled commitments
- newer evaluations
- policy mismatches

**Next Reply**

- deterministic anchor
- correct cycle selection
- close/reopen semantics after the final decision

**Resolution**

Finalize behavior for:

- reopen after solved
- pending_customer
- on-hold

**First Response**

Finalize behavior for:

- reply-less close
- agent-created tickets

---

# Phase 2 — Integration Reliability & Security

### Existing

All core integrations are already implemented.

### Fix what already exists

**OAuth**

- encrypt provider access tokens
- encrypt refresh tokens
- secure OAuth state
- bind OAuth state to the user/session
- disconnect/revoke behavior

**Provider retries**

Standardize handling for:

- 429
- Retry-After
- 5xx
- network failures
- capped retries
- capped wait time

**Webhooks**

- advisory lock
- prevent duplicate processing
- affected-ticket normalization
- webhook limits
- avoid full-integration syncs

**Jira**

- issue_deleted
- unlink removed relationships

**Reconnect**

If the user changes:

- Zendesk subdomain
- Jira site

do not accidentally reuse old cursor/state.

---

# Phase 3 — Complete Case Experience

These features are partially implemented and do not require a new architecture.

## Case Header

Add:

- current ticket status
- assignee

while keeping:

```text
Customer
```

and Requester as separate entities.

---

## Conversation

Already implemented:

- Customer messages
- Agent replies
- chronological order
- initial email handling

Complete it with:

- deterministic deduplication
- clearer sender metadata
- robust initial-message handling

Do not mix Conversation with the Activity Timeline.

---

## Activity Timeline

Currently very incomplete.

Add display-only events for:

- priority changed
- status changed
- policy change
- target change
- commitment created
- commitment completed
- commitment breached
- commitment cancelled
- re-resolution

**Important:** These are presentation/audit events, not computed SLA time.

---

# Phase 4 — Commitment Transparency

This is a very important feature because users need to understand:

> “Why was this SLA determined this way?”

## Commitment Card

Add:

- SLA kind
- target
- current status
- policy name
- policy version
- matched conditions
- calendar
- started at
- due at
- breached at, if present in the existing model semantics
- target-change history

Example:

```text
Resolution

Target
8 hours

Policy
High Priority SLA v3

Matched because
Priority = High

Calendar
Business Hours

Started
Sep 18, 10:32 AM

Target changed
2h → 8h

Reason: priority changed
```

This is **not a new SLA engine feature**. It is exposing information that already exists.

---

# Phase 5 — SLA Configuration UI

This is one of the major areas that is **not actually complete yet**.

Currently, SLA policies/calendars rely heavily on imported/provider configuration.

We need to build:

## SLA Policies

### List

```text
Policies
```

├── Active
├── Inactive
├── Version
├── Priority
├── Created
└── Updated

### Create Policy

For example:

```text
Policy Name

Priority
Conditions
├── Priority = High
├── Customer = Enterprise

Targets
├── First Response: 1h
├── Next Reply: 2h
└── Resolution: 8h
```

### Edit Policy

With versioning.

---

# Phase 6 — Calendar Configuration

This feature is partially missing.

Build UI for:

## Business Hours

- timezone
- working days
- working hours

## Holidays

- date
- name
- recurring/non-recurring

## Calendar assignment

- organization
- policy
- customer override

while preserving the existing deterministic clock engine.

---

# Phase 7 — Settings & Administration

This is currently clearly missing.

## Members

Build:

- members list
- invite member
- owner
- member
- role restrictions
- remove member

---

## Account

- profile
- email
- password change
- password reset
- email verification

---

## Organization

- organization name
- timezone
- basic organization settings

---

## Authorization

The current issue is that some mutations are open to any authenticated user.

Review every:

```text
GET
POST
PUT
PATCH
DELETE
```

and define:

```text
Owner
Member
Operator
```

---

# Phase 8 — Worker / Platform Administration

### Worker Settings

Already exists:

- WorkerSettings

But there is currently a cross-tenant/operator access issue.

Convert it to:

```text
Platform Operator
        ↓
Global Worker Settings
```

and the regular tenant user should have:

```text
read-only / no access
```

using:

```text
PLATFORM_ADMIN_EMAILS=
```

---

# Phase 9 — Dashboard Completion

### Existing

A basic Dashboard already exists.

### Add

SLA breakdown:

```text
First Response
├── On Track
├── At Risk
└── Breached

Next Reply
├── On Track
├── At Risk
└── Breached

Resolution
├── On Track
├── At Risk
└── Breached
```

Visibility into:

- cases with no SLA policy
- integration health
- failed alerts
- failed synchronization

---

# Phase 10 — Onboarding

Onboarding currently exists but is incomplete.

Turn it into a clear flow:

```text
Create account
     ↓
Connect Zendesk
     ↓
Initial sync
     ↓
Import policies
     ↓
Review policies
     ↓
Configure calendars
     ↓
Configure alerts
     ↓
Optional Jira
     ↓
Ready
```

Show the user:

```text
Imported: 12 policies
Matched: 10
No match: 2
Warnings: 1
```

instead of leaving no-match cases as simple logs.

---

# Phase 11 — Integration Completion

## Zendesk

**MVP**

- live verification
- OAuth
- webhook
- backfill
- policy import
- calendars
- customer mapping

---

## Jira

**MVP**

- live verification
- issue linking
- unlink
- deleted issue handling
- webhook reliability

---

## Intercom

**Beta**

Currently:

- OAuth
- polling
- ticket/message ingestion

However, there is no native SLA policy source.

Therefore:

> An Intercom-only organization does not automatically receive SLA commitments in the MVP.

It either uses SLA configuration inside Watchtower after it is built, or remains Beta depending on the final decision.

---

## Linear

**Beta**

- polling
- OAuth refresh validation
- engineering correlation

---

## GitHub

**Beta**

- GitHub App
- PR correlation
- polling
- permissions

It is not considered an SLA source.

---

# Phase 12 — Alerts & Notifications

### Existing

- Slack
- Email
- Sentry/ops alerts

### Complete it with

- encrypted Slack token
- Slack disconnect
- case URL inside alerts
- app URL
- per-recipient email
- alert deduplication
- clear notification ownership

For example:

```text
Case #1234 breached Resolution SLA

Customer: Acme
Policy: Enterprise SLA
Target: 8h
Started: ...
Breached: ...

Open Case
```

---

# Phase 13 — Production Deployment

### Existing

Docker + health checks + deployment docs.

### Required

**Docker**

Remove ngrok from the production compose file.

ngrok should be:

```text
dev / temporary testing
```

not:

```text
production dependency
```

**Migration**

Add a clearly documented migration step.

**Health**

```text
Postgres
   ↓
Worker
   ↓
Web
```

with health-gated startup.

**VPS**

Actual deployment:

```text
Internet
   ↓
TLS / Reverse Proxy
   ↓
Web
   ↓
Worker
   ↓
Postgres
```

---

# Phase 14 — Backup & Recovery

Already exists:

- backup scripts

Missing:

- scheduled backups
- retention
- restore procedure
- actual restore drill

The backup system should not be considered complete without an actual restore test.

---

# Phase 15 — Observability

### Existing

- Sentry
- health endpoint
- ops alerts

### Complete it with

- structured JSON logs
- integration health
- worker health
- failed webhook visibility
- failed sync visibility
- Sentry source maps
- operational dashboard

---

# Phase 16 — Performance & Scale Baseline

Before the production pilot, test:

```text
5,000 cases
200,000+ raw events
```

Measure:

- case list
- dashboard
- case detail
- SLA evaluation
- worker throughput
- DB queries

Especially investigate the current issue:

> Every render may trigger evaluation for every open commitment and load a large number of events.

Optimize only based on actual measurements.

---

# Phase 17 — E2E / Release Verification

Add smoke E2E tests for the critical paths:

```text
Signup
↓
Connect Zendesk
↓
Import
↓
Case appears
↓
SLA created
↓
Customer reply
↓
Agent reply
↓
SLA evaluation
↓
Breach
↓
Alert
```

And create golden scenarios:

### Scenario 1

Normal → High

```text
Resolution
2h → 8h
```

### Scenario 2

High → Normal

```text
8h → 2h
```

### Scenario 3

Breached → policy target increases

The commitment must not become un-breached.

### Scenario 4

Next Reply cycles.

### Scenario 5

Resolution pause/resume.

### Scenario 6

Reopen.

### Scenario 7

Calendar change.

---

# Phase 18 — Launch Gate

Before considering the product production-ready as an MVP:

### Security

- provider tokens encrypted
- Slack tokens encrypted
- OAuth state secure
- authorization audited
- cross-tenant isolation verified

### SLA

- First Response finalized
- Next Reply finalized
- Resolution finalized
- re-resolution finalized
- policy matching finalized
- calendar behavior finalized

### Product

- Policies UI
- Calendars UI
- Members
- Account settings
- Onboarding
- Dashboard
- Case transparency

### Operations

- real VPS
- TLS
- migrations
- backups
- restore tested
- monitoring

### Testing

- unit
- integration
- real DB
- E2E
- golden SLA scenarios
- performance baseline

---

# Things We Will Not Build for Now

This is very important so Claude does not start expanding the project unnecessarily.

### Explicitly Out of Scope

- ❌ AI features
- ❌ AI SLA predictions
- ❌ AI summaries
- ❌ AI recommendations
- ❌ service credits
- ❌ financial compensation calculations
- ❌ automatic customer escalation/write-back
- ❌ per-agent SLA scoring
- ❌ blame/performance scoring
- ❌ generic connector framework
- ❌ SSO/SAML
- ❌ horizontal worker scaling
- ❌ multi-worker distributed locking
- ❌ public API
- ❌ advanced team management
- ❌ complex RBAC
- ❌ configurable arbitrary pause states
- ❌ native Intercom SLA policy engine in the MVP
- ❌ native Linear SLA policy engine
- ❌ GitHub as an SLA source
- ❌ assignee/team SLA analytics

---

# Final Product Structure

After this roadmap, the product should look like:

```text
                    SLA WATCHTOWER
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
     Zendesk           Intercom       Engineering
      Source             Beta            Systems
        │                              Jira/Linear/GitHub
        │                 │                 │
        └────────────┬────┴─────────────────┘
                     │
               Case / Customer
                     │
              ┌──────┴──────┐
              │             │
        SLA Policies     Calendars
              │             │
              └──────┬──────┘
                     │
                SLA Engine
                     │
       ┌─────────────┼────────────────┐
       │             │                │
First Response   Next Reply      Resolution
       │             │                │
       └─────────────┼────────────────┘
                     │
                 Evaluation
                     │
          ┌──────────┼──────────┐
          │          │          │
      Dashboard    Cases      Alerts
                     │
            ┌────────┴────────┐
            │                 │
       Conversation    Activity Timeline
```

## Most importantly: Execution Order

I am **not** going to make Claude work through all 18 phases sequentially as if each phase were a separate week.

The practical order is:

| Phase    | Type                    | Priority |
| -------- | ----------------------- | -------- |
| Phase 0  | Scope/Inventory         | P0       |
| Phase 1  | Fix SLA Core            | P0       |
| Phase 2  | Security + Integrations | P0       |
| Phase 3  | Case Experience         | P1       |
| Phase 4  | Commitment Transparency | P1       |
| Phase 5  | SLA Policy UI           | P1       |
| Phase 6  | Calendar UI             | P1       |
| Phase 7  | Admin/Auth              | P1       |
| Phase 8  | Worker Administration   | P0       |
| Phase 9  | Dashboard               | P1       |
| Phase 10 | Onboarding              | P1       |
| Phase 11 | Integrations            | P1       |
| Phase 12 | Alerts                  | P1       |
| Phase 13 | Production              | P0       |
| Phase 14 | Backup/Recovery         | P0       |
| Phase 15 | Observability           | P1       |
| Phase 16 | Performance             | P1       |
| Phase 17 | E2E                     | P0       |
| Phase 18 | Launch Gate             | P0       |

**Summary:** The old roadmap was excellent as an **audit + hardening plan**, but this new roadmap is what we need as the **actual product plan**: it clearly defines _what we already have and need to fix, what we have and need to complete, what still needs to be built, and what we are explicitly not going to build_.

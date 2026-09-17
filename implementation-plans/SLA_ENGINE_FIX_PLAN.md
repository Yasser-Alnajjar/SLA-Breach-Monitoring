# SLA Engine Fix Plan

## Goal

Fix the SLA engine incrementally, one problem at a time, without introducing a large uncontrolled refactor.

The current investigation found several architectural issues. They are related, so implementation must follow dependency order.

### Core principles

- Inspect the current implementation before changing it.
- Make one focused change per step.
- Preserve existing First Response and Resolution behavior unless the current behavior is explicitly identified as incorrect.
- Do not implement future SLA metrics unless required by the current step.
- Add regression tests for every behavioral fix.
- Do not redesign the entire SLA engine in one pass.
- After each step, run the relevant tests and typecheck.
- Keep database migrations and UI changes isolated from core engine changes where possible.

---

# Implementation Order

## Step 1 — Make event ordering deterministic

### Problem

The evaluator currently sorts events primarily by `occurredAt`, while database loading does not guarantee ordering for events with the same timestamp.

This can make SLA evaluation nondeterministic when multiple events happen at the same timestamp.

### Required change

Introduce a stable ordering field for normalized events, for example:

sourceSequence

Then define deterministic ordering:

occurredAt ASC
sourceSequence ASC

The exact field name can follow the existing project conventions if a better equivalent already exists.

Scope
Normalized event type
Event persistence if necessary
Zendesk normalizer
Intercom normalizer
Event loading queries
Core event sorting
Tests
Acceptance criteria
Same-timestamp events always evaluate in the same order.
Shuffling the input array does not change evaluation results.
Existing events without the new field remain safely supported during migration/backfill if necessary.
No SLA semantic behavior is changed intentionally in this step.

### Step 2 — Fix the event model: preserve customer replies

Problem

Customer comments are currently dropped by the normalizers.

The engine therefore cannot calculate any SLA that depends on:

customer comment → agent public reply
Required change

Add a normalized event representing a public customer reply/comment.

Suggested event:

customer_replied

Keep the existing:

agent_replied

Private/internal notes must NOT become customer-reply events.

Scope
Normalized event type
Zendesk normalizer
Intercom normalizer
Timeline/event persistence
Relevant tests
Important

Do not implement Next Reply yet.

This step only makes the required source information available to the engine.

Acceptance criteria

Given:

customer comment
agent public reply

the normalized event stream contains both events.

Given:

customer comment
internal note
agent public reply

the internal note does not create a customer_replied event.

### Step 3 — Separate commitment clock semantics from global pause behavior

Problem

The current evaluator applies:

pending_customer

as a generic pause state.

That is incorrect because different SLA metrics have different clock rules.

For example:

First Response should not pause on Pending.
Next Reply should not pause on Pending.
Resolution has its own semantics.
Future Pausable Update may pause on Pending.
Future Agent Work has different pause semantics.
Required change

Move pause behavior from a global assumption into commitment-specific rules.

Conceptually:

CYCLE_RULES / COMMITMENT_RULES

or an equivalent small abstraction already consistent with the codebase.

Each commitment kind should define its pause behavior independently.

Acceptance criteria
First Response no longer pauses because of Pending.
Resolution behavior remains explicitly defined and covered by tests.
No commitment accidentally inherits another commitment's pause rules.
The evaluator can determine whether a specific commitment pauses on a specific state.
Important

Do not implement all future metrics here.

Only create enough structure to make current metrics explicit and safe.

### Step 4 — Fix evaluation window / commitment start time

Problem

The clock currently starts from the first event in the case:

sorted[0].occurredAt

instead of respecting the actual commitment start.

This becomes especially important once a case contains multiple commitment cycles.

Required change

Make the elapsed-time calculation operate on an explicit window:

windowStart
windowEnd

The evaluator must calculate elapsed time only inside that window.

The clock should not implicitly start from the first event in the entire case.

Acceptance criteria
Existing First Response still starts from its intended start event.
Resolution still starts from its intended commitment lifecycle.
A future Next Reply cycle can have its own start time without being affected by events before that cycle.
Pause calculation is aware of the state at the beginning of the evaluation window.
Important

Do not implement multi-cycle persistence yet.

### Step 5 — Introduce Next Reply cycle derivation

Only after Steps 1–4 are stable.

Next Reply semantics

A Next Reply commitment is different from First Response and Resolution.

It can have:

0..N cycles per case
Expected behavior

Example:

09:00 Customer A
10:00 Customer B
11:00 Agent reply

One Next Reply cycle:

start = 09:00
end = 11:00

The agent reply answers the customer comments waiting before that reply.

Then:

12:00 Customer C
13:00 Agent reply

creates a new cycle:

start = 12:00
end = 13:00
Rules
Before First Response is completed, customer comments do not create a Next Reply cycle if that matches the chosen product semantics.
The oldest unanswered customer comment anchors the cycle.
Additional customer comments before the agent reply join the same cycle.
One public agent reply closes the open cycle.
Consecutive agent replies do not create additional cycles.
Private/internal notes do not close a cycle.
A customer comment after an agent reply can start a new cycle.
Next Reply does not pause on Pending.
Same-timestamp ordering must use the deterministic ordering from Step 1.
Required implementation

Introduce a focused cycle derivation layer, for example:

deriveNextReplyCycles(events, context)

Do not immediately generalize every existing commitment into a giant generic framework.

Start with the smallest abstraction that supports:

First Response = one cycle
Resolution = lifecycle-based cycle
Next Reply = multiple cycles

### Step 6 — Persist multiple Next Reply commitments

Problem

Current persistence assumes:

one commitment per case + kind

That cannot represent:

Case 50
Next Reply cycle 1
Next Reply cycle 2
Next Reply cycle 3
Required change

Introduce a stable cycle identifier/key.

Conceptually:

caseId + kind + cycleKey

instead of:

caseId + kind
Requirements
Existing First Response remains one commitment.
Existing Resolution remains one commitment/lifecycle.
Next Reply can have multiple commitments.
Re-running evaluation is idempotent.
A cycle keeps a stable identity across re-evaluation.
Removed/invalidated cycles are handled explicitly rather than silently duplicated.
Database migration

Make the smallest schema change necessary.

Do not redesign the whole commitment schema.

### Step 7 — Update the commitment pipeline

Once cycle persistence exists, update the pipeline to:

Load ordered events.
Derive the expected commitment cycles.
Match cycles to existing commitments.
Create missing commitments.
Update existing commitments.
Handle cycles that no longer exist.
Evaluate each commitment using its own window.
Preserve idempotency.
Acceptance criteria

Running the worker repeatedly produces the same commitment set.

No duplicate Next Reply commitments are created.

### Step 8 — Add Next Reply policy/importer support

Only after the engine can actually evaluate and persist Next Reply.

Required changes

Support:

next_reply_time

in policy importing.

Add:

next_reply

to commitment kinds.

Update:

policy mapping
commitment configuration
SLA overrides
validation
target lookup
Acceptance criteria

A policy containing Next Reply targets imports correctly.

Priority-specific targets work.

Overrides affect newly created commitments according to the existing override/versioning model.

### Step 9 — Add UI support for Next Reply

Only after backend evaluation and persistence are stable.

Case detail

Display:

First Response
Next Reply
Cycle 1
Cycle 2
Cycle 3
Resolution

Do not hide the entire commitment card merely because one particular calculation detail is unavailable.

Timeline

Show:

Customer replied
Agent replied

Keep internal/private events according to the existing visibility rules.

Formatting

Update:

commitment labels
status badges
deadline formatting
notifications
case detail grouping
Important

Replace any UI logic that assumes there are only two commitment kinds.

For example, avoid logic like:

a.kind === "first_response" ? -1 : 1

Use an explicit ordering map instead.

### Step 10 — Add complete regression test coverage

At minimum:

Event ordering
Same timestamp + different source sequence.
Randomized input order produces the same result.
First Response
Customer → agent reply.
Pending before agent reply does not pause the clock.
Internal note does not fulfill First Response.
Next Reply
A → B → agent = one cycle.
A → agent → B → agent = two cycles.
A → B → C → agent = one cycle.
Consecutive agent replies do not create extra cycles.
Internal note does not close a cycle.
Pending does not pause Next Reply.
Exact target = met.
One second beyond target = breached.
Open cycle can be evaluated as-of the current time.
Customer reply after resolution/reopen follows the explicitly chosen lifecycle rule.
Same timestamp ordering is deterministic.
Re-running evaluation is idempotent.
Resolution
Existing behavior remains covered.
Reopen behavior remains covered.
Pending behavior follows the explicitly defined Resolution rule.

### Step 11 — Fix secondary issues discovered during the investigation

Only after the core Next Reply implementation is stable.

These are separate tasks and should NOT be mixed into the Next Reply implementation.

11.1 Resolution reopen/solved duration

The investigation found that Resolution may currently count time across a solved interval after reopening.

Create a separate investigation and test before changing behavior.

11.2 Priority changes

Current commitments appear to preserve the original target even if priority changes later.

Investigate whether the product should:

freeze target at commitment creation, or
create/recalculate a new target version.

Do not change this without explicitly defining product semantics.

11.3 Agent-created tickets

Investigate First Response semantics when the agent is the ticket creator.

Do not mix this with Next Reply implementation.

11.4 Autoreplies / triggers

Investigate whether system-generated public replies should count as agent replies.

Define the product rule first, then implement it separately.

Recommended Work Method

For every step:

Phase A — Inspect

The agent should first identify:

relevant files
current behavior
existing tests
database schema
pipeline path
affected UI only if applicable

No code changes yet.

Phase B — Plan

Produce:

exact files to modify
exact behavior change
migration requirements
tests required
risks/regressions
Phase C — Implement

Implement only the current step.

Do not silently include later steps.

Phase D — Verify

Run:

relevant unit/integration tests
typecheck
any project-specific validation

Do not rely only on a successful build.

Phase E — Report

Report:

What changed
Why
Files changed
Tests added/updated
Verification results
Known remaining issues

Then stop and wait for the next step.

Final Dependency Graph
Step 1
Deterministic event ordering
↓
Step 2
Preserve customer replies
↓
Step 3
Per-commitment pause semantics
↓
Step 4
Explicit evaluation windows
↓
Step 5
Derive Next Reply cycles
↓
Step 6
Persist multiple cycles
↓
Step 7
Update commitment pipeline
↓
Step 8
Policy / override support
↓
Step 9
UI support
↓
Step 10
Full regression coverage
↓
Step 11
Secondary investigations/fixes
First Task

Start with Step 1 only: deterministic event ordering.

Do not modify the code yet.

Inspect the current event model, normalizers, persistence, event-loading queries, evaluator sorting, and existing tests.

Return an implementation plan with exact files and the smallest safe change.

Wait for approval before making changes.

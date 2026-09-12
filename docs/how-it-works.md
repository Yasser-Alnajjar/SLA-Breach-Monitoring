# How SLA Works

## The core idea

SLA treats an escalated customer issue as one case whose timeline can cross system boundaries.

Zendesk records the customer-facing support work. Jira records the engineering-side work. SLA reconstructs the events from both systems and evaluates the customer commitment against the combined timeline.

## The two-leg model

The MVP uses two primary work legs:

1. **Support** — work represented in the helpdesk.
2. **Engineering** — work represented in the engineering tracker.

Ownership is derived from the observable event history rather than configured through team mapping.

A handoff is treated as an event boundary. It can be represented by the linked engineering issue being created or the ticket entering an escalated state, depending on the available signals.

## From provider data to a case

The product architecture is based on this flow:

```text
Provider API
    ↓
Adapter
    ↓
Raw events
    ↓
Normalizer
    ↓
Normalized events
    ↓
Correlator
    ↓
Case + Case Link
    ↓
SLA / leg engine
    ↓
Evaluation
    ↓
Dashboard + notifications
```

The provider-specific adapter is kept separate from the SLA calculation layer so the calculation model does not depend on Zendesk-specific or Jira-specific status strings.

## Case lifecycle

A typical case follows this model:

```text
Ticket created
    ↓
Case opened
    ↓
Customer resolved from Zendesk organization
    ↓
Commitments created from the applicable SLA policy
    ↓
Events accumulate from Zendesk and Jira
    ↓
Support / engineering / waiting-on-customer spans are derived
    ↓
Commitments are evaluated
    ↓
On-track → At-risk → Met or Breached
    ↓
Case closed and evaluation retained
```

## Correlation

SLA deliberately favors deterministic relationships.

The MVP can use signals such as:

- official Zendesk–Jira integration links
- Jira remote links pointing to a Zendesk ticket
- external IDs populated by an integration
- explicit structured ticket references

Weak signals such as title similarity or shared participants are not intended to create a factual relationship.

### Why this matters

If SLA cannot confidently establish that a Jira issue belongs to a Zendesk ticket, the product should not use that relationship to manufacture an SLA number.

Coverage is therefore expected to be visible.

Example:

> Linked 214 of 318 escalations (67%).

The remaining cases are not silently assigned to engineering.

## Confidence

The architecture defines three levels for timeline certainty:

- **Certain** — boundaries are backed by explicit events.
- **Inferred** — a boundary is bounded by surrounding known events.
- **Unknown** — signals are contradictory or missing.

Unknown or unattributed time remains visible rather than being silently redistributed.

## Evidence

The case timeline is generated from the normalized event history and the evaluation inputs.

The design intentionally avoids storing a separate evidence document that could later disagree with the underlying event stream.

## Read-only by design

The MVP is designed around observation.

It should not:

- auto-reassign tickets
- auto-comment
- write back to Zendesk
- write back to Jira

Keeping the integrations read-only reduces the security and procurement impact of the first version.

# Troubleshooting

## I connected Zendesk but do not see enough findings

Check whether the historical backfill has completed or is still processing.

The first-run experience is designed around historical data, so findings may appear progressively as events are processed.

Also verify that the Zendesk connection can provide the required ticket, organization, policy, schedule, and event information.

## I connected Jira but some escalations have no engineering leg

The most likely product-level explanation is correlation coverage.

SLA intentionally requires a confident relationship before Jira data contributes to an engineering leg.

Check whether the escalation has:

- an official Zendesk–Jira link
- a Jira remote link to the Zendesk ticket
- a structured external ID/reference

A pasted URL in an unrelated comment may not be enough for deterministic correlation.

The product should report coverage rather than silently guessing.

## The SLA number looks different from Zendesk

SLA is designed to calculate the customer commitment using the event history, applicable calendar, and explicit pause semantics.

Check:

1. Which SLA policy was matched?
2. Which calendar was used?
3. Which intervals were considered running?
4. Which intervals were considered customer-caused waiting?
5. Whether the case contains inferred or unknown boundaries.

In particular, do not assume that Zendesk `Pending` automatically means the customer SLA clock paused.

## The engineering time looks wrong

Review the case timeline and correlation first.

The engineering leg depends on knowing when the case crossed into engineering and when the relevant engineering work ended or changed state.

If a handoff is missing, the architecture allows an inferred boundary rather than inventing an exact event.

## A case shows unattributed time

This is intentional behavior.

Unattributed time can result from:

- ambiguous handoff signals
- missing events
- contradictory events
- incomplete integration data

The product should keep that time visible instead of silently assigning it to support or engineering.

## I see duplicate Slack alerts

Notifications are intended to be deduplicated.

If duplicates occur, check whether the same case has been evaluated multiple times under materially different states or whether notification state has been reset.

The exact operational behavior depends on the current implementation.

## I cannot connect Jira

The product definition identifies Jira authorization as a potential organizational blocker because engineering may control the required access.

The MVP uses read-only access specifically to reduce the security impact of the connection.

If authorization is blocked, the intended fallback during validation is to demonstrate value from Zendesk data while Jira approval is pending.

## Data looks stale

The architecture defines a two-speed monitoring approach:

- frequent polling for active cases with live commitments
- a slower reconciliation sweep
- a nightly integrity check

The product research proposes a five-minute active-set interval and an hourly reconciliation sweep.

These intervals should be verified against the deployed implementation before being treated as an SLA or contractual freshness guarantee.

## When should I trust a result?

Use the confidence information in the case timeline.

- **Certain:** boundary backed by explicit events.
- **Inferred:** boundary reconstructed from surrounding events.
- **Unknown:** contradictory or absent signals.

A result with significant unknown/unattributed time should be interpreted as incomplete rather than as a precise attribution.

## What SLA does not do

The MVP is deliberately not designed to:

- calculate service-credit liability
- automatically reassign work
- automatically comment on tickets
- write back to Zendesk or Jira
- use AI to determine SLA outcomes
- split parallel engineering work across multiple teams
- act as a general-purpose workflow engine

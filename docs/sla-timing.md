# SLA Timing

## What is being measured?

SLA evaluates customer commitments using:

- ordered events
- the applicable SLA policy version
- the applicable business calendar version
- pause behavior
- the reconstructed work intervals

Elapsed time is calculated from the event history rather than treated as a permanently stored number.

## Commitment creation

When a case becomes known, its attributes are matched against active SLA policy versions.

The model can consider attributes such as:

- customer
- priority
- tier
- channel

The most specific applicable policy is selected.

The resulting commitment is tied to the policy and calendar versions used for the calculation so historical results remain reproducible if policies change later.

## Business hours

A deadline is not simply calculated as:

```text
start time + target duration
```

Instead, working minutes are accumulated through the applicable calendar.

Non-working periods and holidays are skipped according to the configured calendar.

A 24/7 policy behaves as an always-open calendar.

## Running versus paused time

The engine reconstructs intervals from normalized events.

Conceptually:

```text
ordered events
    ↓
running / paused intervals
    ↓
intersect with working hours
    ↓
sum elapsed working time
```

## Customer-caused waiting

The product definition makes an important distinction between a provider's raw status and the business meaning of a pause.

A pause is a state predicate over normalized events, not simply a provider status string.

The intended rule is:

> The customer-facing commitment pauses on customer-caused waiting, regardless of which system reports that state.

The case timeline should show the pause and its cause.

## Zendesk Pending

The product research specifically calls out an important behavior:

Zendesk's First Reply, Next Reply, Periodic Update, and Total Resolution targets do not pause merely because a ticket is in Pending status.

Therefore, SLA should not assume that every Pending period is automatically a customer-caused pause.

## Engineering leg

The engineering leg measures the time an escalated case spends in the engineering system.

The MVP intentionally does not require a full OLA policy builder.

Instead, an optional engineering-leg target can be configured as one target number.

Where a target exists, the UI can report the observed leg duration against that target.

## Status lifecycle

The evaluation model is:

```text
on-track
   ↓
at-risk
   ↓
met
or
breached
```

The exact transition depends on the applicable commitment, warning threshold, event history, and current elapsed time.

## Reproducibility

The architecture's central rule is:

> Store events, not computed time.

The elapsed-time result can therefore be recomputed from the same inputs.

This is important when a customer needs to understand why a historical number changed or verify how a result was produced.

## Financial calculations

The MVP does not calculate service credits, penalties, or financial exposure.

Account value or tier may be used for prioritization where supported, but the product is not intended to make contractual financial conclusions.

# Dashboard and Cases

## Dashboard

The MVP dashboard is designed to answer three questions immediately:

1. What needs attention now?
2. What breached during the selected period?
3. Which escalations are aging?

The core dashboard areas are:

- at-risk commitments
- breached commitments
- escalations by age

## At-risk

An at-risk commitment is one that is approaching its applicable target and has reached a configured warning threshold.

The purpose is to create an action window before the commitment is breached.

The exact warning thresholds should be treated as configuration/product behavior rather than assumed contractual rules.

## Breached

A breach is represented as an evaluation whose status is `breached`.

A breach is not modeled as a separate source of truth.

The evaluation retains the inputs needed to explain the result.

## Case detail

A case detail page should provide the reconstructed timeline for the case.

A useful case view includes:

- customer
- priority/tier information where available
- applicable commitment
- current evaluation status
- elapsed time
- remaining time where applicable
- support leg
- engineering leg
- waiting-on-customer periods
- correlation information
- confidence or attribution uncertainty
- important status transitions

## Timeline

The timeline is the primary explanation surface.

Instead of only showing a final number, the product should make it possible to see where the elapsed time came from.

For example:

```text
09:10  Ticket created
10:05  Support activity
11:20  Escalated to engineering
11:20  Engineering leg starts
13:45  Engineering status changes
14:10  Waiting on customer
15:00  Customer responds
16:20  Case resolved
```

The exact events shown depend on the source data available for that case.

## Time by stage

For a commitment that is breached, the architecture calls for reporting time by stage rather than assigning blame.

The preferred language is:

- time in support
- time in engineering
- time waiting on customer
- unattributed time

Avoid framing the result as proving that a particular team caused the breach.

## Missing or uncertain events

The system is designed to surface uncertainty.

Examples:

- ambiguous handoff → unattributed/unknown span
- missing handoff event → inferred boundary
- contradictory signals → unknown
- missing Zendesk–Jira link → no engineering leg

The goal is that the customer can distinguish a measured fact from a reconstructed or incomplete interval.

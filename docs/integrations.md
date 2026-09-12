# Integrations

## Zendesk

Zendesk is the source for the customer-facing commitment and support history.

### Data used

The product definition identifies:

- tickets
- organizations
- SLA policy definitions
- business schedules
- holidays/calendar information where available
- audit and event history
- priority and tier-related ticket fields

### What SLA derives from Zendesk

SLA can derive:

- customers from organizations
- applicable SLA commitments from policy definitions
- business-hours behavior from schedules
- support-side events from the ticket history

### Access model

The MVP is designed around OAuth and read-only access.

SLA observes the existing Zendesk workflow rather than changing it.

---

## Jira

Jira is the engineering-side source.

### Data used

The product definition identifies:

- issues
- issue status
- status transitions
- changelog
- remote links

### What SLA derives from Jira

SLA can use Jira history to understand:

- when engineering work begins
- how long an escalated case remains on the engineering leg
- status transitions that affect the case timeline
- links between Jira issues and Zendesk tickets

### Access model

The MVP is designed around OAuth and read-only access.

---

## Zendesk ↔ Jira correlation

The strongest correlation signal is the official integration link.

Jira remote links and structured external references can also provide deterministic relationships.

SLA intentionally avoids treating:

- similar titles
- close timestamps
- shared participants
- keyword overlap

as proof that two records are the same case.

## Missing links

If a Zendesk escalation has no confident Jira relationship, the case can still exist, but it does not receive an engineering leg based on an invented relationship.

Account-level coverage should make this visible.

Example:

> 104 of 318 escalations could not be linked to an engineering issue.

This is a data-coverage limitation, not a reason to fabricate a result.

---

## Slack

Slack is the notification channel identified for the MVP.

The intended use is operational:

- notify about important at-risk cases
- avoid duplicate alerts
- alert at meaningful warning thresholds

Slack does not become a source of truth for SLA timing in the core model.

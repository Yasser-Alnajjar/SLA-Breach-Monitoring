# Getting Started

## Before you begin

SLA is designed for B2B SaaS support teams that use a customer-facing helpdesk and a separate engineering tracker.

The intended first setup is:

- Zendesk
- Jira
- optionally Slack for notifications

The integrations are read-only in the MVP. SLA is intended to observe the existing workflow rather than modify tickets or engineering issues.

## 1. Create your account

The planned onboarding starts with a simple account:

- email
- password

No company profile or onboarding survey is required before the first connection.

## 2. Connect Zendesk

Zendesk is the first source because it contains the information needed to understand the customer commitment, including:

- tickets
- organizations
- SLA policy definitions
- business schedules
- ticket audit/event history
- priority and related ticket fields

The connection is intended to use OAuth with read-only access.

## 3. Connect Jira

Jira provides the engineering-side history needed to understand what happened after an escalation.

Relevant information includes:

- issues
- status transitions
- changelog
- remote links

The Jira connection is also intended to be read-only.

## 4. Historical backfill

After the required systems are connected, SLA performs a historical backfill.

The product definition targets approximately the last 60–90 days so that the first experience can show existing behavior rather than waiting for new tickets.

During backfill, useful progress information should include real counts as data is processed, such as tickets, escalations, and linked issues.

## 5. First findings

The intended experience is to reach useful findings without first requiring the customer to manually configure every policy.

Customer and SLA information can be derived from Zendesk:

- customers from Zendesk organizations
- SLA targets from Zendesk SLA policies
- business hours from Zendesk schedules

Engineering leg timing can then be derived from the cross-system event history.

## 6. Optional configuration

After the first findings are available, configuration can be refined.

The product definition identifies these optional steps:

### SLA policy confirmation

Imported SLA policies can be confirmed or corrected when the source data is not exactly what the customer expects.

### Engineering leg target

A customer can optionally define one target for the engineering leg.

The target is intentionally narrower than a full OLA policy builder.

### Slack

Connect Slack and select a channel if the customer wants at-risk notifications.

### Live monitoring

Enable ongoing monitoring after the historical data has established the baseline.

## Setup checklist

- [ ] Account created
- [ ] Zendesk connected
- [ ] Jira connected
- [ ] Historical backfill completed or progressing
- [ ] Initial findings reviewed
- [ ] Imported SLA policies confirmed
- [ ] Engineering leg target configured, if needed
- [ ] Slack connected, if needed
- [ ] Monitoring enabled

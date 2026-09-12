# SLA

## Support escalation visibility

### Your SLA clock doesn't stop when the ticket leaves Zendesk.

SLA connects your support and engineering workflow so an escalated customer issue can be understood as one continuous timeline across Zendesk and Jira.

Instead of looking at two systems separately, you can see:

- which customer commitments are at risk
- which escalations are aging
- how much time was spent on the support and engineering legs
- what happened before a commitment was met or breached
- which escalations could not be linked confidently

### What SLA is designed to solve

When a support ticket moves to engineering, the customer commitment can continue while the support team loses visibility into the engineering work.

SLA is designed to keep that customer-facing clock visible across the handoff.

### Core workflow

1. Connect Zendesk with read-only access.
2. Connect Jira with read-only access.
3. Historical data is backfilled.
4. SLA identifies cases and deterministic Zendesk–Jira relationships.
5. SLA evaluates customer commitments using the available event history, policies, calendars, and pause rules.
6. The dashboard surfaces at-risk and breached commitments.
7. A case timeline explains how the elapsed time was accumulated.
8. Slack notifications can warn about important at-risk cases.

### Documentation

- [Getting Started](getting-started.md)
- [How SLA Works](how-it-works.md)
- [Integrations](integrations.md)
- [Dashboard and Cases](dashboard-and-cases.md)
- [SLA Timing](sla-timing.md)
- [Troubleshooting](troubleshooting.md)

> **Important:** This documentation is based on the current project/product definition supplied for this documentation pass. It describes the intended MVP behavior and product model; it is not a substitute for a code-level implementation audit.

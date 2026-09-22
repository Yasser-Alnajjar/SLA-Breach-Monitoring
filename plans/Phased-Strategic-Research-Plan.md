# Elapsed — Phased Strategic Research & Product Validation Plan

## Objective

Act as a senior SaaS product strategist, B2B product manager, and technical architect.

The goal is **not to validate Elapsed**.

The goal is to determine whether this is a problem worth solving, identify the strongest market wedge, challenge the product assumptions, and define the smallest product that should be validated before significant development investment.

Be aggressively skeptical.

If the idea is weak, say so.

If the original concept should change significantly, propose the better version.

---

# Phase 1 — Problem & Idea Teardown

## Objective

Determine whether the core problem is genuinely painful and whether the proposed solution is solving a problem customers actually have.

## Analyze

### Core Concept

Elapsed is a vendor-neutral monitoring layer above systems such as:

- Zendesk
- Jira / Jira Service Management
- Linear
- Slack
- GitHub
- CRM systems
- Email
- Other ticketing/project-management systems

It collects events, reconstructs issue lifecycles, and evaluates SLA and internal OLA commitments.

Example:

Customer SLA:

- P1 First Response: 1 hour
- P1 Resolution: 8 hours

Internal OLAs:

- Support: 30 minutes
- Engineering: 2 hours
- Security: 1 hour
- Operations: 90 minutes

The system reconstructs:

Customer
→ Support
→ Engineering
→ Security
→ Operations

And determines:

- SLA status
- OLA status
- Remaining time
- At-risk commitments
- Breaches
- Ownership
- Handoff delays
- Delay attribution
- Root cause
- Evidence timeline

Instead of:

> SLA breached.

It could report:

> SLA breached by 32 minutes. Engineering contributed 137 minutes of delay. Support, Security, and Operations remained within their targets.

## Challenge

Determine:

1. What is genuinely valuable?
2. What is unnecessary?
3. What sounds impressive but customers probably don't care about?
4. What is already solved?
5. What is actually differentiated?
6. What assumptions are potentially wrong?
7. Is the problem frequent enough to justify dedicated software?
8. Is this a monitoring problem, reporting problem, compliance problem, contract-management problem, or operational accountability problem?

## Output

Produce:

- Core problem
- Jobs-to-be-done
- Existing alternatives
- Pain level
- Key assumptions
- Biggest risks
- Strongest potential value
- Reasons NOT to build it

---

# Phase 2 — Market & Competitive Reality

## Objective

Determine whether the market already solves this problem and where the actual whitespace exists.

## Analyze Competitors By Category

### 1. Helpdesks

Examples:

- Zendesk
- Jira Service Management
- Freshdesk
- ServiceNow

Analyze:

- Built-in SLA capabilities
- Escalations
- Reporting
- SLA dashboards
- Limitations

### 2. PSA / MSP Platforms

Analyze:

- ConnectWise
- Autotask
- HaloPSA
- Other relevant platforms

### 3. SLA Monitoring Products

Identify products focused specifically on SLA monitoring or compliance.

### 4. Vendor SLA Monitoring

Products monitoring third-party vendor/service SLAs.

### 5. Workflow / Process Monitoring

Products reconstructing workflows across systems.

### 6. Compliance / Audit Platforms

Products that provide evidence, audit trails, accountability, and compliance reporting.

## For Every Category

Explain:

- What they solve
- What they don't solve
- Their target customer
- Their pricing model where available
- Why customers would use Elapsed instead
- Whether they could easily copy the feature
- Whether the category represents direct or indirect competition

## Critical Question

Determine whether:

> "Cross-system SLA monitoring + OLA attribution + evidence"

is actually a defensible product category or simply a feature that existing platforms could add.

## Output

Produce:

- Competitive landscape
- Competitive gaps
- Saturated areas
- Genuine whitespace
- Threat level
- Potential moat

---

# Phase 3 — Customer & Buyer Analysis

## Objective

Determine exactly who experiences the problem, who owns it, and who would pay for it.

## Analyze Potential Buyers

- Support Manager
- Head of Support
- Operations Manager
- MSP Owner
- CTO
- COO
- Account Manager
- Customer Success
- Compliance
- Service Delivery Manager

For each determine:

- Pain
- Responsibility
- Budget ownership
- Trigger event
- Current workaround
- Buying authority
- Expected ROI
- Willingness to pay

## Important Question

Do not assume the person experiencing the pain is the person who buys the product.

Identify:

- User
- Champion
- Buyer
- Economic buyer
- Executive stakeholder

## Output

Create a buyer map and identify the strongest buyer persona.

---

# Phase 4 — Vertical Selection

## Objective

Select ONE vertical to start with.

Compare:

1. MSPs
2. Software agencies
3. SaaS companies
4. Financial services
5. Healthcare

## Score Each

Use a 1–10 score for:

- Pain intensity
- SLA breach frequency
- Financial impact
- Customer count
- Market size
- Accessibility
- Ease of reaching buyers
- Integration complexity
- Sales cycle
- Willingness to pay
- Competition
- Defensibility
- Data availability
- MVP complexity

## Output

Provide a weighted comparison.

Then select exactly ONE vertical.

Do not answer "it depends."

Explain why the selected vertical is the best starting point for a solo/small team.

---

# Phase 5 — Find the Wedge

## Objective

Avoid launching as:

> Universal SLA monitoring for every company.

Find the narrowest possible entry point that provides immediate value.

## Generate 3–5 Wedges

Examples:

- SLA compliance monitoring for MSPs using ConnectWise + Jira
- SLA breach evidence for software agencies using Jira + Slack
- Cross-team OLA monitoring for support organizations
- SLA dispute/evidence reporting for managed service providers
- Contract SLA monitoring across multiple ticketing systems

Do not blindly use these examples.

Find better wedges if the research supports them.

## Rank Each

Score:

- Pain
- Urgency
- Buyer accessibility
- Competition
- Technical complexity
- Data availability
- Expansion potential
- Willingness to pay
- Defensibility

## Output

Select ONE initial wedge.

---

# Phase 6 — Ideal Customer Profile

## Objective

Define the first customer precisely.

Do NOT say:

> Medium-sized companies.

Instead define:

- Employee count
- Customer count
- Ticket volume
- SLA volume
- Contract structure
- Tools used
- Teams involved
- Existing workflow
- SLA complexity
- Current reporting process
- Current pain
- Buyer
- Budget
- Trigger event

## Example Format

> 20–100 employee MSP managing 30+ customer contracts, using ConnectWise + Jira, with multiple internal teams and contractual SLA penalties.

But validate this assumption rather than accepting it.

## Output

Produce one concrete ICP.

---

# Phase 7 — Product Reframing

## Objective

Based on the previous phases, determine what Elapsed should actually be.

Challenge the original positioning.

Potential positioning:

> Don't miss your SLA.

Weak because existing products already do this.

Potential alternatives:

> Know why your SLA was breached.

> Track, explain, and prove every SLA breach.

> The system of record for service commitments.

Determine whether any of these are strong.

Also propose better positioning if necessary.

## Output

Define:

- Product category
- Core problem
- Core promise
- One-line value proposition
- Homepage headline
- Subheadline
- 3 key benefits
- Differentiation statement

---

# Phase 8 — Evidence & Attribution Validation

## Objective

Determine whether the "Evidence Timeline" and "Delay Attribution" concepts are actually valuable.

Example:

09:00 Customer request received  
09:04 Support assigned  
09:31 Support → Engineering  
11:48 Engineering started  
13:12 Engineering → Security  
14:01 Security approved  
15:32 Resolved

Potential conclusion:

> SLA breached by 32 minutes. Engineering contributed 137 minutes of delay.

## Analyze

Who would use this?

- Management
- Support leadership
- Account managers
- Customer success
- Customers
- Compliance
- Legal
- Contract management

When would they use it?

Examples:

- Monthly SLA reviews
- Customer disputes
- Service-credit disputes
- Internal performance reviews
- Executive reporting
- Contract renewal
- Compliance audits

## Critical Question

Determine whether:

> "Prove who caused the breach"

is strong positioning or politically dangerous.

Consider whether the product should instead use neutral language such as:

> "Identify contributing delays."

## Output

Determine whether Evidence should be:

- Core product
- Supporting feature
- Premium feature
- Not worth building

---

# Phase 9 — Financial Impact

## Objective

Determine whether financial SLA impact belongs in the product.

Example:

Customer:

ACME

Contract:

$20,000/month

P1 breach:

Potential service credit: $2,000

## Analyze

Potential features:

- Potential service credit
- Revenue at risk
- Customer impact
- Contract exposure
- Renewal risk
- Financial reporting

## Risks

Evaluate:

- Legal implications
- Accounting implications
- Contract interpretation
- Incorrect calculations
- Liability
- Customer disputes

## Output

Determine what financial functionality belongs in MVP, if any.

---

# Phase 10 — MVP Definition

## Objective

Design the smallest product capable of proving customer value.

Assume:

- Solo/small development team
- No enterprise sales team
- Limited development budget
- Need real customer validation quickly

## Categorize Features

### MUST HAVE

Only features required to deliver the core value.

### SHOULD HAVE

Important but not required for initial validation.

### NICE TO HAVE

Future enhancements.

### DO NOT BUILD

Features that increase complexity without improving validation.

## Explicitly Evaluate

- Organizations
- Users
- Customers
- Integrations
- SLA policies
- OLA policies
- Team mapping
- Event ingestion
- Timeline reconstruction
- SLA engine
- OLA engine
- Breach detection
- Evidence timeline
- Dashboard
- Notifications
- Slack
- Email
- Reports
- Financial calculations
- AI

## Output

A tightly scoped MVP.

---

# Phase 11 — Core Customer Workflow

## Objective

Design the exact experience from signup to first value.

Proposed workflow:

1. Create organization
2. Connect integration
3. Import historical data
4. Detect customers
5. Configure SLA policies
6. Configure OLA policies
7. Map teams
8. Start monitoring
9. Detect risk
10. Detect breach
11. Reconstruct evidence
12. Notify stakeholders
13. Generate report

## Challenge This Workflow

Determine:

- What should be automatic?
- What requires configuration?
- What creates onboarding friction?
- What can be inferred?
- What should happen before the customer configures anything?
- How quickly can the customer see value?

## Critical Goal

Try to achieve:

> Connect → Analyze historical data → See useful findings

as quickly as possible.

---

# Phase 12 — Data Model

## Objective

Design an integration-agnostic domain model.

Core entities may include:

- Organization
- User
- Customer
- Contract
- SLA Policy
- OLA Policy
- Team
- Integration
- Ticket / Case
- Raw Event
- Normalized Event
- Handoff
- SLA Commitment
- OLA Commitment
- Breach
- Evidence Event
- Notification

## Important Distinction

Clearly separate:

### Raw Events

Events exactly as received from external systems.

### Normalized Events

Provider-independent representation of those events.

### Commitments

Specific SLA/OLA obligations evaluated against an issue.

### Breaches

The result of evaluating a commitment.

### Evidence

Immutable or auditable records explaining how the system reached the conclusion.

## Requirements

The architecture must allow:

Zendesk  
Jira  
Slack  
Linear  
GitHub  
ConnectWise  
Freshdesk  
ServiceNow  
Custom APIs

without coupling the SLA engine directly to a specific provider.

## Output

Provide:

- Entity model
- Relationships
- Important fields
- Lifecycle
- Ownership
- Data flow

---

# Phase 13 — SLA Engine

## Objective

Design the SLA calculation engine conceptually before writing code.

It must eventually support:

- First response
- Resolution
- Business hours
- 24/7
- Holidays
- Pauses
- Waiting for customer
- Waiting for third party
- Reopened tickets
- Multiple SLA policies
- Priority changes
- Customer-specific SLA
- Contract-specific SLA
- Escalations
- Warning thresholds

## Explain

1. How a commitment is created
2. How its deadline is calculated
3. How elapsed time is calculated
4. How pauses work
5. How business calendars work
6. How policy changes affect commitments
7. How breaches are detected
8. How historical calculations remain reproducible

## Then Provide

TypeScript interfaces for:

- SLA Policy
- SLA Commitment
- Business Calendar
- SLA Evaluation
- SLA Breach

---

# Phase 14 — OLA Engine

## Objective

Design internal accountability tracking.

Example:

Support → Engineering

Determine:

- When Support handed off
- When Engineering became responsible
- How long Engineering owned the issue
- Whether Engineering breached its OLA
- Whether the delay contributed to customer SLA breach

## Hard Cases

Handle:

- Ambiguous handoffs
- Missing handoff events
- Multiple teams
- Parallel work
- Reassignments
- Ownership without explicit status
- Missing Jira/Zendesk relationships
- Human configuration errors

## Output

Define:

- OLA commitment model
- Ownership model
- Handoff model
- Attribution algorithm
- Confidence/uncertainty handling

---

# Phase 15 — Cross-System Correlation

## Objective

Solve the hardest technical problem.

Example:

Zendesk #18392  
↔ Jira ENG-492  
↔ Slack thread  
↔ Customer ACME

## Determine

How relationships should be established.

### Deterministic Signals

Examples:

- Explicit ticket links
- Issue IDs
- External IDs
- URLs
- Shared customer IDs
- Shared email/domain
- Integration metadata

### Configurable Signals

Examples:

- Project mappings
- Team mappings
- Customer mappings
- Naming conventions

### Weak Signals

Examples:

- Similar titles
- Timing
- Participants
- Keywords

Determine what should be:

- Automatic
- Configurable
- Manual

## Critical Requirement

Do not allow the system to confidently invent relationships.

When correlation is uncertain, represent uncertainty explicitly.

---

# Phase 16 — Polling & Event Architecture

## Objective

Evaluate whether the proposed 15–30 minute polling architecture is viable.

Analyze:

- Accuracy
- SLA deadlines
- Alert latency
- API rate limits
- Cost
- Complexity
- Historical synchronization
- Duplicate events
- Event ordering
- Missed events

## Compare

### MVP

Polling:

Scheduler  
→ Integration Adapter  
→ Fetch Changes  
→ Normalize  
→ Store  
→ Evaluate

### Later

Webhooks + polling reconciliation:

Webhook  
→ Event Queue  
→ Normalization  
→ Evaluation

plus periodic polling for reconciliation.

## Critical Question

Can 30-minute polling work for the initial wedge?

If not, determine the minimum acceptable polling interval.

---

# Phase 17 — MVP UI

## Objective

Define the smallest interface that communicates value immediately.

## Main Dashboard

Potential sections:

- Active commitments
- At-risk SLAs
- Breached SLAs
- Compliance %
- Delaying teams
- Customers at risk
- Recent breaches

Determine what actually deserves dashboard space.

## Breach Detail Page

Should potentially show:

- Commitment
- Customer
- Contract
- SLA target
- Deadline
- Actual resolution
- Timeline
- Handoffs
- Team ownership
- Delays
- Contributing factors
- Evidence
- Related external records

Determine the minimum required experience.

---

# Phase 18 — Pricing

## Objective

Find a pricing model aligned with customer value.

Compare:

- Per ticket
- Per customer
- Per integration
- Per commitment
- Per organization
- Usage-based
- Flat subscription

Analyze:

- Value metric
- Predictability
- Expansion potential
- Customer understanding
- Pricing friction
- Gross margin

## Output

Recommend one pricing model and propose initial pricing tiers.

---

# Phase 19 — Go-To-Market

## Objective

Determine how a founder with no sales team gets the first five customers.

## Explore

Potential acquisition strategy:

> Connect your existing systems and we'll reconstruct your last 30 days of SLA performance.

Determine whether this is compelling.

## Define

For the first customer:

- Outreach target
- Buyer
- Message
- Demo
- Required data
- Integration setup
- Time-to-value
- Pilot structure
- Success criteria
- Conversion strategy

## Important

The goal is not to sell the entire SaaS.

The goal is to prove that customers care enough about the problem to pay for the solution.

---

# Phase 20 — 30-Day Validation Plan

## Objective

Validate demand before committing to significant development.

Create a day-by-day or week-by-week plan.

### Week 1 — Market Validation

- Competitor research
- ICP validation
- Customer interviews
- Existing workflow discovery
- Identify current workarounds

### Week 2 — Problem Validation

- Interview target buyers
- Collect real SLA reports
- Understand breach workflows
- Identify financial consequences
- Test positioning

### Week 3 — Concierge MVP

Instead of building the complete product:

- Import customer data
- Reconstruct historical timelines manually/programmatically
- Generate breach reports
- Show evidence
- Validate attribution
- Measure customer reaction

### Week 4 — Paid Pilot Validation

Attempt to get real customers to:

- Connect systems
- Run a pilot
- Review findings
- Pay for continued usage

## Output

Define measurable success criteria.

---

# Phase 21 — Kill Criteria

## Objective

Define objective conditions under which the project should be abandoned or radically changed.

Potential kill criteria:

### Problem

- Customers do not consider SLA breaches painful
- Breaches happen too rarely
- Existing reports are sufficient
- Customers don't care about attribution

### Product

- Historical evidence is unreliable
- Cross-system correlation requires too much manual work
- Customers need excessive configuration
- 30-minute polling is insufficient
- Integration maintenance becomes dominant engineering work

### Market

- No clear vertical has strong pain
- Competition closes the gap easily
- Buyer is unclear
- Sales cycle is too long for the target market

### Commercial

- Customers refuse to pay
- Willingness to pay is below viable SaaS economics
- ROI is difficult to demonstrate
- Customers won't connect their operational data

## Output

Define explicit thresholds.

Example:

> Stop if fewer than 3 of 15 qualified prospects agree to a paid pilot after seeing historical breach analysis.

---

# Phase 22 — Final Strategic Verdict

After completing all previous phases, provide a final decision.

## Required Output

### Verdict

Score the idea from 1–10.

Explain the score.

### Best Vertical

One specific vertical.

### Best Wedge

One very specific initial use case.

### Best Buyer

One specific buyer/persona.

### MVP

The smallest viable feature set.

### Differentiator

The ONE capability/value proposition the product should own.

### Product Positioning

The recommended positioning.

### Architecture

High-level technical architecture.

### Data Model

Core entities and relationships.

### First Integration

Which integration should be built first and why.

### First Customer

Describe the exact type of company to target.

### Validation Strategy

How to validate the idea before significant development.

### 30-Day Plan

Concrete execution plan.

### Kill Criteria

The exact conditions under which the project should be abandoned.

---

# Final Rule

Do not optimize for making Elapsed sound exciting.

Optimize for answering:

> **Is there a painful, frequent, valuable problem here that a small team can solve better than existing alternatives?**

If the answer is NO:

Say NO.

If the answer is YES but the current product definition is wrong:

Redefine it.

If a smaller or different product has a stronger opportunity:

Recommend that product instead.

The objective is not to build Elapsed.

The objective is to find the **best business opportunity hidden inside the Elapsed hypothesis.**

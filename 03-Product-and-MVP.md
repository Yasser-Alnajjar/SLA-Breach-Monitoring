# 03 — Product Definition, MVP, Workflow & Pricing
**Phases 7–11 and 18.**

---

# Phase 7 — Product Reframing

## Judging the proposed positioning

| Candidate | Verdict |
|---|---|
| *"Don't miss your SLA."* | **Dead.** Every helpdesk says this and most do it adequately. Competing here means being compared on a feature the incumbent gives away. |
| *"Know why your SLA was breached."* | **Weak.** Retrospective and low-frequency. It sells a post-mortem, and post-mortems get budget once. |
| *"Track, explain, and prove every SLA breach."* | **Weak and politically loaded.** "Prove" points a finger; see Phase 8. It also anchors on breaches — an event you want to be rare — which means the product's perceived value falls as it succeeds. |
| *"The system of record for service commitments."* | **Weakest.** Category-creation language written for an investor, not a buyer. No Head of Support has ever gone looking for one. |

All four share a flaw: they lead with **SLA**, a word the buyer associates with a feature they already own.

## Recommended positioning

Lead with the moment of pain instead — the escalation — and let SLA be the consequence.

- **Product category:** Support escalation visibility. Sits in the support-operations tooling budget, next to QA and CSAT tools. *Do not invent a category.* A solo founder cannot afford to teach the market a new noun.

- **Core problem:** When a ticket is escalated to engineering, the customer's clock keeps running but support's visibility stops.

- **Core promise:** One honest clock that survives the handoff, and sight of the leg you cannot currently see.

- **One-line value proposition:** *Escalated tickets stop being a black box — and your SLA numbers start being true.*

- **Homepage headline:**
  > **Your SLA clock doesn't stop when the ticket leaves Zendesk.**

  This works because it is a **verifiable factual claim about the buyer's own system** — Zendesk's First Reply, Next Reply, Periodic Update and Total Resolution targets genuinely do not pause in Pending status. The reader either already knows and feels seen, or does not know and immediately needs to check. Either reaction gets the next click.

- **Subheadline:**
  > See every escalated ticket across Zendesk and Jira on one clock. Know which customer commitments are at risk while there's still time to act — and where the hours actually went when there wasn't.

- **Three key benefits:**
  1. **No more blind escalations.** Every ticket in engineering's queue, shown against the customer's remaining time, not Jira's.
  2. **SLA numbers you can defend.** One elapsed-time calculation that reconciles both systems' pause rules and calendars, instead of two systems producing two answers for the same case.
  3. **The monthly report, already written.** Escalation performance by team, by customer, by tier — instead of four hours in a spreadsheet before every QBR.

- **Differentiation statement:**
  > Zendesk sees its half. Jira sees its half. Neither is built to tell you the truth about the whole, because neither is neutral. We are the only system whose job is the handoff itself.

---

# Phase 8 — Evidence & Attribution Validation

## Who would actually use it, and how often

| Audience | Would they use it? | Frequency | Honest read |
|---|---|---|---|
| Support leadership | Yes | Weekly | The real user. Uses it to explain, not accuse. |
| Management / exec | Yes | Monthly | Wants the aggregate, not the case file |
| Account managers / CS | Yes | Per incident | Highest emotional value — walking into a call already knowing |
| Customers | **Rarely, and carefully** | 2–6×/yr | Sending a customer a document proving you breached by 32 minutes is a decision most companies will not make |
| Compliance / Legal | **No** | — | No regulatory driver exists in this segment. Legal's instinct is to *prevent* the record's creation, not consume it. |
| Contract management | No | — | Different market, different systems |

The honest conclusion: **evidence is used internally, weekly, to explain — and externally, rarely, under legal caution.**

## The critical question: is "prove who caused the breach" strong or dangerous?

**Dangerous, and the danger is structural rather than presentational.**

The product needs a Jira API token. That token is controlled by engineering. The product's stated purpose is to generate evidence that engineering caused the delay. A VP Engineering asked to authorise this has every reason to decline, and the decline is invisible to you — it surfaces as a deal that "went quiet during setup."

There is a second failure mode past installation. A tool used as an internal weapon gets gamed: statuses get changed to stop clocks, work moves out of Jira, tickets get closed and reopened. The measurement corrupts the thing it measures, and the data — the only asset that compounds — degrades.

**Use neutral language, without exception:**

| Never | Always |
|---|---|
| "Prove who caused the breach" | "See where the time went" |
| "Root cause: Engineering" | "Longest leg: engineering queue — 2h 17m" |
| "Delay attribution" | "Time by stage" |
| "Engineering breached its OLA" | "Engineering leg exceeded its 2h target" |
| "Blame" / "fault" / "responsible" | "Contributing" / "elapsed" / "leg" |

And design a first-run view for engineering that shows *their* benefit: which escalations are ageing in their queue, which have customer commitments expiring soonest, which are misrouted. Give the blocker a reason to say yes.

## Verdict on Evidence

**Supporting feature in the MVP — not the core product, not premium, not skipped.**

- **Not core**, because it fires too rarely to justify a subscription and its framing is what makes engineering block the install.
- **Not premium**, because gating it behind a higher tier prevents the moment that creates loyalty — the first time a support lead walks into an exec review with a timeline instead of an apology.
- **Not skipped**, because it costs almost nothing: once you have a normalised event store and a working clock, the timeline is a rendering of data you already hold. It is the cheapest differentiation available.

Build it as a **rendered timeline on the case detail page**. Do not build dispute packs, PDF exports, customer-facing portals or e-signature workflows until a paying customer asks twice.

---

# Phase 9 — Financial Impact

## Recommendation: exclude from the MVP entirely, with one narrow exception.

The original concept proposes computing potential service credits ("ACME, $20,000/month contract, P1 breach → $2,000 credit"). This should not ship.

**Why:**

1. **The number is small and rarely realised.** Verified: credits are typically capped at a low percentage of monthly fee, defined as the customer's *sole and exclusive remedy*, and must be claimed in writing within a short window. ROI built on "credits avoided" is built on money that mostly never moves.

2. **Contract interpretation is not computable.** Whether a given breach triggers a credit depends on exclusions, maintenance windows, force majeure, customer-caused delay, aggregation rules, and monthly caps that interact across incidents. Every contract is different. A rules engine that gets this 90% right is worse than no engine, because the 10% arrives in front of a customer.

3. **It manufactures discoverable liability.** A dashboard reading "Q3 potential service credits: $47,000" is a document that exists on the vendor's own systems, is timestamped, and is discoverable. Legal will say no, and legal will be right.

4. **One wrong number ends the relationship.** Operational estimates get corrected. Financial estimates get escalated to a CFO, and the tool never recovers.

5. **It is the wrong buyer.** Finance does not buy support tooling. Adding a financial module lengthens the sale and adds an approver without adding a champion.

**This is a product-risk assessment, not legal advice.** Anyone who ships credit calculation should have a lawyer review the liability position and the terms of service first — particularly around disclaiming reliance.

## The narrow exception

Allow an optional, manually entered **account value or tier** on each customer, used for **prioritisation and sorting only**:

> *"3 commitments at risk on accounts you've marked Tier 1."*

That is enough to make the dashboard rank by what matters, costs nothing, invents nothing, and states no financial conclusion. Nothing is calculated, multiplied, or labelled as a credit, penalty, or exposure.

**Revisit financial features only after** 10+ paying customers, real contract corpus in hand, and a customer explicitly asking — at which point it is a paid professional-services conversation, not a feature.

---

# Phase 10 — MVP Definition

Constraint: solo/small team, no enterprise sales, limited budget, needs validation fast. Everything below is judged against one question — *does this help prove customers will pay?*

## The reframe that shrinks the build

In this wedge there are only **two legs**: the ticket is either with support (in the helpdesk) or with engineering (in the tracker). Which leg owns it is not something the user configures — **it is directly observable from which system the work is in and what state it is in.**

That collapses three of the heaviest items in the original scope:

- **Team mapping** → unnecessary. Two legs, inferred.
- **OLA policy configuration** → unnecessary. The engineering leg's duration is measured automatically; a target is one optional number, not a policy engine.
- **Handoff detection** → unnecessary. The handoff is the moment the linked issue is created or the ticket enters the escalated state. It is an event, not an inference.

The OLA differentiator survives; the OLA *configuration surface* disappears. This is the single largest scope reduction available and it costs nothing.

## MUST HAVE

| Feature | Note |
|---|---|
| Zendesk integration (read-only OAuth) | Tickets, audits/events, organizations, SLA policy definitions |
| Jira integration (read-only OAuth) | Issues, changelog, status transitions, remote links |
| **Historical backfill of the last 60–90 days** | The entire go-to-market depends on this. Without it there is no first-run "wow" and no reason to stay past day one. |
| Deterministic case correlation via the official Zendesk↔Jira link | No fuzzy matching in v1 |
| Normalised event store (raw + normalised, separate) | The compounding asset |
| SLA engine: first response, resolution, business hours, holidays, pause states | Correct time arithmetic across both systems' rules |
| Leg timing (support leg / engineering leg elapsed) | The OLA capability, config-free |
| At-risk and breach detection with warning thresholds | |
| One dashboard: at-risk now, breached this period, escalations by age | |
| Case detail page with rendered timeline | Evidence, as a byproduct |
| Slack notifications | The only channel that matters to this buyer |
| CSV export | The floor of the reporting job |
| Org + multi-user auth | Minimal; email + OAuth |
| Customers auto-derived from Zendesk organizations | Never ask the user to type a customer list |

## SHOULD HAVE (post-validation, weeks 6–12)

Linear integration · optional per-team leg targets · scheduled monthly PDF report · email notifications · SLA policy override UI · webhooks for real-time freshness

## NICE TO HAVE (only if pulled by customers)

Intercom / Freshdesk / Pylon sources · GitHub · custom business calendars per customer · public API · SSO/SAML · anomaly detection on cycle times

## DO NOT BUILD

| Item | Why |
|---|---|
| **Financial / service-credit calculation** | Phase 9. Liability with no upside. |
| **AI anything** | No question in this product needs a model. The value is correct arithmetic; an LLM makes it less trustworthy, not more. |
| **Team mapping / org chart / role config** | Two legs, inferred. |
| **OLA policy builder** | One optional number per leg, not a policy engine. |
| **Configurable rules/workflow engine** | The road to a product nobody can onboard themselves into. |
| **Customer-facing portal or shared reports** | Legal review, permissions, support burden. Zero validation value. |
| **Escalation *actions*** (auto-reassign, auto-comment, write-back) | Write access changes the security conversation completely and turns a read-only install into a procurement review. **Stay read-only in v1** — this is worth more than any feature. |
| **Generic connector framework / plugin SDK** | Premature abstraction, the classic solo-founder time sink |
| **Mobile app, browser extension, on-prem** | |
| **6+ integrations** | Every connector is a permanent maintenance tax. Two, done properly. |

## Explicit verdict on each item the brief lists

| Item | Verdict |
|---|---|
| Organizations | MUST — minimal, one per account |
| Users | MUST — minimal, no roles/permissions in v1 |
| Customers | MUST — **auto-derived**, never manually entered |
| Integrations | MUST — **exactly two**: Zendesk + Jira |
| SLA policies | MUST — **imported from Zendesk first, editable second** |
| OLA policies | **DO NOT BUILD** as a policy system; MUST as one optional target number per leg |
| Team mapping | **DO NOT BUILD** |
| Event ingestion | MUST |
| Timeline reconstruction | MUST |
| SLA engine | MUST |
| OLA engine | MUST, in its reduced form (leg durations) |
| Breach detection | MUST |
| Evidence timeline | MUST — as a page, not a document product |
| Dashboard | MUST — one screen |
| Notifications | MUST |
| Slack | MUST |
| Email | SHOULD |
| Reports | CSV MUST, PDF SHOULD |
| Financial calculations | **DO NOT BUILD** |
| AI | **DO NOT BUILD** |

**Estimated build for one competent full-stack developer: 6–9 weeks.** The historical backfill and the pause/calendar arithmetic are the two things that will take longer than expected. Everything else is CRUD.

---

# Phase 11 — Core Customer Workflow

## The proposed 13-step workflow is wrong

Steps 1–7 of the original workflow (create org → connect → import → detect customers → configure SLA → configure OLA → map teams) place **three configuration screens between the customer and their first insight.** Every one is a place to abandon. A solo founder cannot afford an onboarding that requires a call.

## The rule

> **No configuration before first value. None.**

Everything needed for the first insight is already present in the connected systems. Zendesk holds the SLA policies, the organizations, and the ticket history. Jira holds the changelog. The link between them already exists. **Ask for nothing you can read.**

## Redesigned flow

**Before any configuration — target: under 10 minutes, unattended**

1. **Sign up** — email + password. No company profile, no onboarding survey.
2. **Connect Zendesk** (OAuth, read-only) — one click.
3. **Connect Jira** (OAuth, read-only) — one click. *This is the moment the deal is really won or lost; see the note on engineering below.*
4. **Backfill runs automatically** — last 60–90 days. Show a live progress view with counts appearing as they land ("1,204 tickets · 318 escalations · 41 linked issues"), because a progress bar with real numbers is itself persuasive.
5. **Findings appear with zero input:**
   > *Over the last 90 days, 318 tickets were escalated to Jira. 47 of them exceeded their customer resolution target. Escalated tickets spent an average of 2h 41m waiting to be picked up in Jira. Your top 5 affected accounts are…*

   Note what makes this possible: SLA targets came from Zendesk's own policies; customers came from Zendesk organizations; leg durations came from the Jira changelog. **The user has typed nothing.**

**Only then, configuration — each step optional and individually skippable**

6. Confirm or correct the imported SLA policies (pre-filled).
7. Optionally set a target for the engineering leg (one number, with the observed median offered as the default — "your current median is 2h 41m; set a target?").
8. Connect Slack and choose a channel.
9. Turn on live monitoring.

**Then, ongoing**

10. At-risk alerts to Slack, deduplicated, at meaningful thresholds only.
11. Breach recorded with its timeline, no action required.
12. Monthly report generated automatically and waiting on the first of the month.

## What is automatic vs. configured

| Automatic (inferred) | Configured (asked) |
|---|---|
| Customers ← Zendesk organizations | Engineering leg target (optional) |
| SLA targets ← Zendesk SLA policies | Slack channel + who gets alerted |
| Business hours ← Zendesk schedules | Alert thresholds (sensible defaults) |
| Case correlation ← official link | Account tier for sorting (optional) |
| Leg ownership ← which system holds the work | SLA corrections, if the import is wrong |
| Priority/tier ← ticket fields | |

## Onboarding friction, honestly ranked

1. **The Jira OAuth grant.** Not technical — political. The Head of Support cannot grant it alone. Mitigations: a read-only scope stated prominently, a one-page security summary they can forward, a shareable "request access" link addressed to the Jira admin, and — critically — **let the product deliver partial value from Zendesk alone while Jira approval is pending**, so the trial does not stall at step 3.
2. **Backfill duration** on large instances. Mitigate by streaming findings as they compute rather than gating on completion.
3. **Poor link discipline.** If a team pastes URLs instead of using the integration, correlation coverage drops. Detect and report this honestly — *"we could link 61% of your escalations"* — rather than silently under-reporting. Never invent a link to improve the number.

## Time-to-value target

**Under 15 minutes from signup to a findings screen**, unattended, on a real dataset. If it takes a demo call, the business does not work at this price point.

---

# Phase 18 — Pricing

## Choosing the value metric

| Model | Assessment |
|---|---|
| Per agent | **No.** Familiar, but value has no relationship to agent count, and it penalises the customer for growing the team. It also invites direct comparison with the helpdesk's per-agent price, which is a losing frame. |
| Per ticket | **No.** Most tickets never escalate. Charges for volume the product does not touch. |
| Per integration | **No.** Punishes the exact behaviour that makes the product stickier. |
| Per commitment | **No.** Unpredictable and impossible to forecast at purchase time. |
| Per customer/account | Plausible — value does scale with named accounts — but the count is volatile and creates awkward mid-month arithmetic. |
| Pure usage | **No.** Unpredictable bills kill mid-market renewals. |
| **Flat tiers banded by monthly escalation volume** | **Yes.** |

**Recommendation: flat monthly subscription, tiered by monthly escalated-ticket volume.**

It scores well on every axis that matters: the value metric is the thing the product actually acts on; the price is predictable within a tier; it expands naturally as the customer grows; a support leader understands "escalations per month" without explanation; and gross margin is unaffected by seat count.

## Proposed tiers

| Tier | Price | Included | Purpose |
|---|---|---|---|
| **Historical Review** | Free, one-time | 90-day backfill, findings report, read-only, expires in 14 days | The entire acquisition motion. Not a freemium tier — a self-serve diagnostic. |
| **Starter** | **$299/mo** | Up to 150 escalations/mo · Zendesk + Jira · Slack alerts · CSV export | Lands inside discretionary approval for a Head of Support |
| **Growth** | **$699/mo** | Up to 600 escalations/mo · leg targets · scheduled reports · multiple projects/brands | The expected centre of gravity |
| **Scale** | **$1,499/mo** | Up to 2,500 escalations/mo · API access · SSO · priority support | |
| **Enterprise** | Custom | Above 2,500 · security review · custom calendars | Only when inbound |

Overage: soft — notify and upgrade at the next renewal. Never hard-stop monitoring, because a customer whose alerts went silent mid-incident churns immediately and tells people.

## Reasoning on the numbers

- **Target ACV $3.6k–$8.4k**, which needs roughly **12–20 customers to reach $10k MRR** — a plausible target for one founder in 12–18 months.
- **$299 is deliberately above the original doc's $99.** A $99 product needs 100 customers for the same revenue, which means a self-serve funnel and a marketing budget — neither of which exists here. $99 is not a cheaper price, it is a different and harder company.
- **Anchors:** Supportbench runs $32–$100/agent/mo, so a 10-agent team already pays $320–$1,000/mo for a helpdesk. Pylon starts at $70/seat with a 3-seat minimum. A $299 add-on is a small fraction of tooling spend the buyer already approves.
- **Counter-anchor, stated honestly:** Jira Marketplace apps solve an adjacent problem for a fraction of this, and QBR Studio gives MSPs client reporting free. If the buyer frames this as "an SLA app," the price loses. The positioning in Phase 7 exists partly to prevent that framing.

**The pricing kill signal:** if qualified prospects consistently anchor below $200/mo, the unit economics do not support a founder building integrations for a living. That threshold is in [05-Validation-and-Kill-Criteria.md](05-Validation-and-Kill-Criteria.md).

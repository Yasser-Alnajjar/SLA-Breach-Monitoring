# 02 — Vertical, Wedge & ICP
**Phases 4–6.**

---

# Phase 4 — Vertical Selection

## Weighting

Weights reflect the stated constraint — solo/small team, no sales force, limited budget, needs validation fast. Under that constraint, *willingness to pay*, *how easily you can reach a buyer*, *integration complexity* and *how crowded it already is* matter far more than total market size. A large market you cannot reach with one person is worth zero.

Scores are 1–10. Criteria marked (inv) are inverted so that 10 is always good: for *Integration complexity*, 10 = simple; for *Sales cycle*, 10 = short; for *Competition*, 10 = empty; for *MVP complexity*, 10 = trivial.

| Criterion | Weight | MSPs | Agencies | **B2B SaaS** | FinServ | Healthcare |
|---|---:|---:|---:|---:|---:|---:|
| Pain intensity | 11 | 8 | 6 | **8** | 7 | 6 |
| SLA breach frequency | 5 | 7 | 5 | **8** | 5 | 4 |
| Financial impact | 4 | 7 | 4 | **6** | 8 | 6 |
| Customer count per account | 3 | 9 | 6 | **6** | 5 | 4 |
| Market size | 5 | 7 | 5 | **8** | 6 | 5 |
| Accessibility | 7 | 8 | 7 | **8** | 2 | 1 |
| Ease of reaching buyers | 7 | 9 | 6 | **8** | 2 | 1 |
| Integration complexity (inv) | 10 | 4 | 5 | **8** | 2 | 1 |
| Sales cycle (inv) | 8 | 7 | 8 | **7** | 1 | 1 |
| Willingness to pay | 12 | 7 | 3 | **7** | 9 | 7 |
| Competition (inv) | 10 | 3 | 8 | **7** | 5 | 6 |
| Defensibility | 6 | 3 | 5 | **6** | 6 | 6 |
| Data availability | 7 | 8 | 5 | **9** | 4 | 3 |
| MVP complexity (inv) | 5 | 5 | 5 | **8** | 2 | 1 |
| **Weighted total** | **100** | **6.41** | **5.61** | **7.51** | **4.67** | **3.85** |

## Selected vertical: B2B SaaS companies

Specifically: **B2B SaaS companies with contractual support commitments to enterprise customers, running a customer-facing helpdesk and a separate engineering tracker.**

## Why — and why not MSPs

The original research ranked MSPs first. That ranking does not survive scrutiny, for four reasons:

**1. The MSP's PSA already is the single source of truth.** The entire product thesis is "work crosses systems and nobody has the whole picture." In an MSP, tickets, contracts, SLAs, time entries and billing all live in ConnectWise or HaloPSA by design. The problem the product solves is the problem MSPs have least. Ranking MSPs first optimises for *SLA pain* while ignoring *cross-system pain*, and only the second one is defensible.

**2. It is the most crowded segment checked.** ConnectWise Reports & Dashboards ships with the PSA; QBR Studio does client-ready SLA reporting with a free tier, flat pricing and unlimited clients; MyITFleet does real-time cross-client SLA dashboards; CloudRadial and Handover do MSP client reporting. Entering here means being the sixth option against incumbents with distribution.

**3. The conflict of interest.** An MSP creating a timestamped record of its own contractual breaches, in a market where credits are the client's sole and exclusive remedy and must be claimed in a short written window, is manufacturing evidence against itself. The pitch collapses to "prove you delivered," which is the reporting job — the crowded one.

**4. ConnectWise integration is the wrong first build for a solo founder.** One legacy API, painful auth, and a data model that must be learned before a line of value ships.

By contrast, B2B SaaS scores highest on the four things that decide whether one person can ship and sell this:

- **Data availability (9).** The Zendesk↔Jira link is written by Atlassian's and Zendesk's own official integration. The hardest problem in the concept — cross-system correlation — arrives pre-solved and deterministic. This single fact is worth more than any other consideration in the table.
- **Integration complexity (8).** Two well-documented modern REST APIs with generous rate limits, OAuth, and rich webhook/audit history. Zendesk and Jira are the two best-documented ticketing APIs in existence.
- **Reachability (8/8).** Heads of Support congregate publicly — Support Driven, LinkedIn, support-ops newsletters, conference Slacks. A solo founder can get twenty conversations in two weeks without a list purchase.
- **Frequency (8).** Escalations happen daily. Daily pain makes a habit; a habit makes retention.

Financial services and healthcare are eliminated outright, not on pain but on access: a solo founder with no security certifications, no SOC 2, and no sales team cannot survive a procurement and infosec review cycle before running out of runway. Agencies are eliminated on willingness to pay — the pain is real and the whitespace genuine, but agencies buy on price and this would be a $49/mo product, which is not a business.

**One caveat, stated honestly:** B2B SaaS wins on execution feasibility more than on pain. MSPs hurt more. The judgment is that a solo founder should optimise for a problem they can actually reach, integrate with, and sell against — not for the deepest pain in the hardest market. If this were a funded team with two sales hires, the MSP answer would be more competitive.

---

# Phase 5 — Find the Wedge

## Five candidate wedges

**W1 — Escalation SLA continuity.** When a Zendesk ticket is escalated to a linked Jira/Linear issue, keep one authoritative customer-facing clock running across both, show support what is happening on the engineering leg, and warn before the customer commitment breaks.

**W2 — MSP cross-client SLA command centre.** Live compliance across all clients from ConnectWise/HaloPSA.

**W3 — Breach evidence & dispute packs.** After any breach, in any system, generate a defensible timeline document.

**W4 — Agency client commitment tracking.** Contractual response/turnaround commitments across Linear + GitHub + Slack.

**W5 — Escalation cycle-time analytics.** No alerting at all. A monthly report on how long escalated tickets spend on each leg, sold as a support-ops analytics product.

## Ranking

10 = best. Technical complexity and Competition are inverted (10 = simple / empty).

| Criterion | W1 Escalation | W2 MSP | W3 Evidence | W4 Agency | W5 Analytics |
|---|---:|---:|---:|---:|---:|
| Pain | 8 | 8 | 9 | 6 | 5 |
| Urgency (is it bought *now*?) | 8 | 6 | 3 | 5 | 3 |
| Buyer accessibility | 8 | 9 | 6 | 6 | 8 |
| Competition (inv) | 7 | 3 | 8 | 8 | 6 |
| Technical complexity (inv) | 8 | 4 | 5 | 5 | 9 |
| Data availability | 9 | 8 | 6 | 5 | 9 |
| Expansion potential | 8 | 7 | 5 | 5 | 6 |
| Willingness to pay | 7 | 7 | 6 | 3 | 4 |
| Defensibility | 6 | 3 | 5 | 5 | 4 |
| **Mean** | **7.7** | **6.1** | **5.9** | **5.3** | **6.0** |

**W3 scores highest on pain and lowest on urgency — the exact trap identified in Phase 1.** Nobody buys a dispute tool between disputes. It is a feature of W1, not a product.

**W5 is the safest build and the weakest business.** A monthly report is a nice-to-have that gets cancelled in the first budget review.

## Selected wedge: W1 — Escalation SLA continuity

> **For B2B SaaS support teams: when a ticket is escalated to engineering, the customer's clock keeps running and support goes blind. This keeps the clock honest across both systems and tells you before the commitment breaks.**

Why this one:

1. **It is the only wedge where the differentiated capability and the frequent job are the same thing.** Support needs the cross-boundary view daily, not quarterly.
2. **The hard technical problem is free here.** Deterministic correlation via the official Zendesk↔Jira link means no fuzzy matching, no invented relationships, no confidence scores in v1. A solo founder cannot afford to solve entity resolution; in this wedge they do not have to.
3. **It has a demo that lands in ten seconds.** "Here are your last 30 days of escalations. Fourteen of them blew the customer commitment while sitting in Jira. Here's where the time went."
4. **Neutral framing is available.** "Escalation visibility" is something a VP Engineering can approve. "Prove who caused the breach" is not.
5. **Expansion is natural:** more sources (Linear, GitHub, Slack, Intercom, Pylon) → OLA targets per team → evidence packs → compliance reporting. The wedge widens without repositioning.

---

# Phase 6 — Ideal Customer Profile

Not "medium-sized companies." One concrete profile, with the reasoning for each number.

| Attribute | Specification | Why this number |
|---|---|---|
| **Company type** | B2B SaaS, sells to enterprise or upper-mid-market | Needs contractual support commitments to exist at all |
| **Employees** | 80–400 | Below ~80, support and engineering sit in one room and Slack solves it. Above ~400, they have a support-ops team building internal dashboards, and procurement gets involved. |
| **Support team size** | 6–25 agents | Below 6, no dedicated Head of Support and no budget owner. Above 25, likely already on ServiceNow or building in-house. |
| **Enterprise customers with SLAs** | 15–150 named accounts | Enough that manual tracking has broken; few enough that each one matters by name |
| **Ticket volume** | 800–6,000/month | Aligns with the observed 500–5,000/month mid-market band |
| **Escalation volume** | **40–400 escalations to engineering per month** | **The actual qualifying metric.** Below ~40, the pain is anecdotal. This is the number to ask for in a sales call. |
| **Tool stack** | Zendesk (or Intercom / Pylon / Freshdesk) **+ Jira or Linear**, connected by the official integration, plus Slack | The official link is the correlation backbone. No link, no product. |
| **Contract structure** | Support commitments in MSAs or order forms — P1/P2 response and resolution targets by tier. Service credits may exist but are capped and rarely claimed. | Commitments create the obligation; credits are not the motivator |
| **Teams involved** | Support (owns SLA) → Engineering (owns Jira) → occasionally Security/Infra | The handoff is the product |
| **SLA complexity** | 2–4 tiers × 3–4 priorities = 6–16 distinct targets; business hours for P2/P3, 24/7 for P1 | Complex enough to be error-prone, simple enough for a v1 engine |
| **Existing workflow** | Agent escalates, links a Jira issue, sets ticket to Pending or On-hold, then chases in Slack. Nobody knows the real remaining time. | **The Zendesk clock does not pause in Pending** (verified) — so their own numbers are wrong today and they may not know it |
| **Current reporting** | A monthly SLA number pulled from Zendesk that everyone privately distrusts, plus 4–8 hours of manual work when an exec asks why a specific account slipped | Manual effort is the budget you are displacing |
| **Current pain** | Support is accountable for a number it cannot influence or explain after the escalation boundary | |
| **Buyer** | Head of Support / Director of Support Operations | Owns the metric, owns a tooling budget |
| **Blocker** | VP Engineering, who must approve the Jira token | Design and messaging must give them something |
| **Budget** | $5–50k/yr discretionary support tooling, already spending on QA/CSAT/WFM point tools | Comparable spend precedent exists |
| **Trigger event** | A named enterprise account escalated to the CEO over a missed commitment, and nobody could explain what happened. Or: a QBR where the customer's SLA numbers disagreed with theirs. | This is the sentence to listen for in interviews |

## Assumptions in this ICP that are not yet validated

Per the brief's instruction to validate rather than accept:

1. **That 40+ escalations/month is the right qualifying threshold.** Invented from reasoning about when manual tracking breaks. Test it — it may be 100, or 15.
2. **That the Head of Support controls budget at 80–400 employees.** Plausible, but at many companies this rolls up to a VP CS or COO, which lengthens the cycle.
3. **That companies this size have written SLAs at all.** Many B2B SaaS companies have *published* support targets with no contractual force. If the commitment is not contractual, the urgency drops and this becomes an internal-metrics product.
4. **That the official Zendesk↔Jira link is actually used.** Some teams paste a URL into a comment instead. If link discipline is poor, the deterministic-correlation advantage evaporates and the whole feasibility case with it.

**Item 4 is the highest-leverage thing to check first** — it is answerable in the first three customer conversations, and a negative answer changes the product.

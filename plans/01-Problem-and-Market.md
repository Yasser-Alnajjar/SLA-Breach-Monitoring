# 01 — Problem, Market & Buyer

**Phases 1–3.** Every competitive claim here traces to [Research-Sources.md](Research-Sources.md).

---

# Phase 1 — Problem & Idea Teardown

## The core problem, stated honestly

Not "companies breach SLAs." They do, and they mostly already know.

The real problem is narrower:

> **When work crosses a system boundary, the customer's clock keeps running but the organisation's visibility stops.**

A ticket is escalated from Zendesk into Jira. From that moment, the support lead who owns the customer commitment cannot see the work, cannot see whether it is moving, and cannot answer "will we make it?" without walking over to an engineer. Meanwhile the two systems disagree about elapsed time, because — verified — they use different pause rules, different calendars, different time zones, and different definitions of "waiting." Two systems, same case, different numbers.

That is a genuine gap. The rest of the original concept is decoration on top of it.

## Jobs to be done, ranked by frequency × pain

| #   | Job                                                                             | Frequency         | Pain                          | Already solved?                                                                      |
| --- | ------------------------------------------------------------------------------- | ----------------- | ----------------------------- | ------------------------------------------------------------------------------------ |
| 1   | _"Tell me a customer commitment is about to blow while I can still act"_        | Daily             | High                          | **Yes**, inside a single system. Zendesk, JSM, ConnectWise all do this. Not a wedge. |
| 2   | _"Tell me what's happening to my escalated tickets after they leave my system"_ | Daily             | High                          | **No.** This is the gap.                                                             |
| 3   | _"Give me a client-ready compliance report without a day of spreadsheet work"_  | Monthly/quarterly | Medium                        | **Partly.** Solved for MSPs (BrightGauge, QBR Studio). Unsolved for B2B SaaS.        |
| 4   | _"Settle the argument about which internal team caused the slip"_               | Weekly            | High but **political**        | Partly (ServiceNow OLA, Deviniti). See the politics problem below.                   |
| 5   | _"Defend me when a customer disputes a breach"_                                 | 2–6× per year     | Very high **when it happens** | No. But too rare to anchor a purchase.                                               |

The structural trap sits between rows 2 and 5: **the emotionally compelling capability is rare, and the frequent capability is commoditised.** The original doc's "strongest angle" (breach evidence, delay attribution) is job #5 — the best demo and the worst recurring-revenue anchor. A product sold on a job that fires four times a year churns.

The only row that is both frequent and unsolved is **#2**. That is the entire business.

## Answering the eight challenge questions directly

**1. What is genuinely valuable?** Cross-boundary clock continuity. One authoritative elapsed-time number for a customer commitment when the work spans two systems, plus visibility into the leg that is currently invisible.

**2. What is unnecessary?** The universal integration ambition (8+ connectors), financial/service-credit calculation, AI, "SLA assurance" guarantees, and a notification engine with three channels. Each adds maintenance and none is why anyone buys.

**3. What sounds impressive but customers don't care about?** "Vendor-neutral monitoring layer" and "system of record for service commitments." These are architecture descriptions dressed as value propositions. No support leader has ever asked for a system of record for service commitments. They ask where their escalation went.

**4. What is already solved?** In-system SLA timers, warning thresholds, escalation automations, per-system compliance dashboards, OLA definitions (ITIL construct, native in ServiceNow, available for Jira via Deviniti), and MSP client reporting. Roughly 70% of the feature list in the original doc.

**5. What is actually differentiated?** One thing: **a correct, continuous, defensible elapsed-time calculation across a system boundary, reconciling two systems' conflicting pause rules and calendars.** Everything else in the concept is available elsewhere.

**6. What assumptions are potentially wrong?**

- _That companies want breach attribution._ Many actively do not — see politics, below.
- _That MSPs are the best vertical._ Argued against in [02-Vertical-Wedge-ICP.md](02-Vertical-Wedge-ICP.md); the MSP's PSA already **is** the single source of truth, so the cross-system thesis is weakest exactly where the original doc ranked it first.
- _That SLA penalties drive urgency._ Verified: credits are capped, defined as sole-and-exclusive remedy, and must be claimed in writing inside a short window. Small money, claimed by exception.
- _That correlation across systems is the hard part._ In the recommended wedge it is deterministic — the Zendesk↔Jira integration writes an explicit link. The hard part is time arithmetic, not matching.
- _That "breach happened" is the trigger to buy._ More likely the trigger is a specific angry customer or a lost renewal.

**7. Is the problem frequent enough?** For job #2, yes — every escalation, every day. For jobs #4 and #5, no. This is why the product must be sold on visibility and bought on visibility, with evidence as the thing that makes it stick.

**8. Which kind of problem is this?** It is an **operational visibility problem** first, a reporting problem second, and an accountability problem third. It is _not_ a compliance problem (no regulator requires this) and _not_ a contract-management problem (that market is Icertis/Sirion and has nothing to do with tickets). Positioning it as compliance or contract management walks into fights it cannot win.

## The politics problem

The original doc proposes positioning the product as **"Prove who caused the SLA breach."**

This is the most dangerous sentence in the concept.

The buyer is a support or service-delivery leader. The evidence the product generates will most often implicate **engineering** — a function that in nearly every software company outranks support, controls the Jira instance, and must personally approve the API token the product needs to work.

So the product's core promise requires the cooperation of the group it exists to indict. That is not a hard sale; it is a self-blocking one. A VP Engineering asked to authorise a tool whose landing page says it will prove their team caused the breach has an obvious and entirely rational answer.

The capability is fine. The framing must be neutral — _contributing delays_, _where time went_, _escalation cycle time_ — and the first-run experience must show engineering something it wants (where its own queue is stuck) rather than an indictment. This is not cosmetic; it decides whether the integration gets connected at all.

## Pain level

**6/10 for the visibility job**, sustained and daily. Real, but survivable — teams cope with Slack pings and manual chasing, and coping is the competitor that kills most B2B tools.

**9/10 for the dispute job**, four times a year. Intense and forgettable.

Nobody's hair is on fire. That is the honest read.

## Key assumptions the business rests on

1. Support leaders will pay to see past the escalation boundary (untested — see [05](05-Validation-and-Kill-Criteria.md)).
2. Engineering will permit a read-only Jira/Linear connection for a support-owned tool.
3. A ticket's Zendesk↔Jira link is reliable enough to be the correlation backbone.
4. 15–30 minute polling is accurate enough for commitments measured in hours.
5. Integration maintenance stays under ~15% of engineering time.

## Biggest risks

| Risk                                                                                   | Severity                                                     |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Engineering vetoes the Jira connection                                                 | **Critical** — kills the product at install, not at sale     |
| Willingness to pay lands under $200/mo, below viable SaaS economics for a solo founder | **Critical**                                                 |
| Zendesk or Atlassian ships escalation-SLA continuity as a feature                      | High — but slow; both have known this gap for years          |
| Marketplace apps (Deviniti, SaaSJet) extend downward from the Jira side                | High, and cheaper than a standalone SaaS                     |
| Integration maintenance becomes the whole job                                          | High — the classic killer of one-person integration products |
| Attribution is wrong once in front of an executive and trust never returns             | High                                                         |

## Strongest potential value

A support leader opens one screen and sees every customer commitment currently at risk **including the ones sitting in engineering's queue**, with an honest remaining-time number that neither Zendesk nor Jira can produce alone — and at month end exports the escalation performance report they currently assemble by hand.

## Reasons NOT to build it

Stated without softening, because the brief asks for them:

1. The frequent job is commoditised; the differentiated job is rare.
2. The product's core promise antagonises the team whose permission it requires.
3. The MSP vertical — the obvious one — is both crowded and the worst fit for the cross-system thesis.
4. Process mining (Celonis) already does this analysis properly, and will move down-market before a solo founder moves up.
5. Integration surface grows linearly with customers while price does not.
6. Nobody has this in a budget line. It is a new spend category, which for a solo founder means every sale is an education sale.
7. Coping is free. Slack, a spreadsheet, and a Monday morning meeting already solve this badly enough that most teams will not switch.

---

# Phase 2 — Market & Competitive Reality

## 1. Helpdesks — Zendesk, JSM, Freshdesk, ServiceNow

**Solve:** SLA policies, business calendars, countdowns, breach detection, escalation automations, per-system compliance reporting. Mature, cheap (bundled), and good.

**Don't solve:** anything past their own boundary. Verified specifics — Zendesk's First Reply Time, Next Reply Time, Periodic Update Time and Total Resolution Time do not pause in Pending status, so the moment a ticket is parked awaiting engineering the number stops meaning anything. JSM tracks SLAs per project with no native cross-project view, and carries open bugs where the SLA fails to pause on participant comments or under add-on post-functions.

**Target customer:** everyone. **Pricing:** bundled per agent.

**Could they copy it?** Yes, technically — and this is the honest threat assessment: Zendesk could ship "SLA continues across linked Jira issue" as a feature. What protects the wedge is not difficulty but **incentive**: Zendesk's job is to make Zendesk the system of record, not to build a neutral layer that treats Jira as a peer. Atlassian has the mirror-image incentive. Neither wants to build the thing whose value comes from not taking sides. That is a real, if modest, structural moat — worth maybe three years, not ten.

**Competition type:** indirect for the wedge, direct for anything broader.

## 2. PSA / MSP platforms — ConnectWise, Autotask, HaloPSA

**Solve:** contract-linked SLAs per client, ticketing, billing, and — with ConnectWise Reports & Dashboards (ex-BrightGauge) — SLA compliance dashboards.

**Don't solve:** real-time. Native SLA compliance reporting requires running a report and waiting; the breach is visible after it happened. Cross-client live views are third-party territory (MyITFleet).

**Why choose Elapsed instead?** For most MSPs, **you wouldn't.** The PSA is genuinely the single source of truth for MSP work. This is the finding that most damages the original doc's ranking: it placed MSPs first, but MSPs are the segment where the least work crosses systems.

**Competition type:** direct, and well-defended.

## 3. Dedicated SLA-monitoring products

Thin, and thinner than the original doc implied. **Clockspring** is a 29-use-case data-integration platform where cross-system SLA monitoring is the last item on the list — it is the _build-it-yourself substitute_, not a competitor. **Supportbench** ($32–$100/agent/mo) has genuinely sophisticated dynamic SLAs keyed to contract tier and renewal risk, but it is a helpdesk you migrate to, not a layer you add. **Effigate could not be found to exist.**

The real competitors in this category are the **Atlassian Marketplace apps**, which the original doc missed entirely:

- **Deviniti SLA Time Management** — centralised **SLA _and OLA_** management spanning multiple Jira and JSM projects, JQL start/stop rules, recalculation of closed issues. This sells the OLA differentiator through Atlassian's own distribution channel.
- **SaaSJet SLA Time and Report** — consolidated multi-project reporting, and rules that pause/restart the SLA when an issue transfers between projects. 4.6/5 across ~97 reviews, so it has real users.

**Competition type:** direct, cheap, and already distributed. Their limitation is that they live inside Jira and therefore cannot see the Zendesk leg — which is precisely where the remaining wedge is.

## 4. Vendor SLA monitoring — Complaya, Vendorica, Pingoru, Reclivio, Reclaim, Venminder

This is a real and rapidly filling market, and it is **the mirror image of this product**. These tools monitor SLAs your _suppliers_ owe _you_, and are bought by procurement to recover money. Elapsed monitors SLAs _you_ owe _your customers_, and is bought by operations to avoid embarrassment.

The distinction matters commercially: the vendor-side product recovers cash (self-funding ROI), the customer-side product prevents a capped, rarely-claimed credit. **The inbound side has the better business model, and six companies have already noticed.**

**Competition type:** not competitors. Useful as proof the category is fundable, and as a warning that the easier money is on the other side of the same problem.

## 5. Workflow / process monitoring — Celonis and process mining

**The most serious threat, and absent from both original documents.**

Celonis's ITSM offering combines event logs across ERP, CRM, ITSM and custom apps and explicitly surfaces "escalation paths, ticket ping-pong between teams, and actual SLA compliance." That is the Elapsed thesis, executed by a company with a decade of head start on exactly the hard part — reconstructing a process from multi-system event logs.

**What saves the wedge:** process mining is sold to enterprise transformation teams as a six-figure analytics project. It is retrospective, consultative, and priced out of the mid-market. It answers "how does our process behave in aggregate," not "is the ACME P1 going to breach in the next 40 minutes."

**But:** everything in the previous paragraph is a statement about go-to-market, not technology. If process mining moves down-market — and mid-market process mining is already a discussed 2026 category — the moat is gone.

**Competition type:** indirect today, existential if it descends.

## 6. Compliance / audit platforms

Not competitors. GRC platforms (Vendorica, Venminder) track vendor obligations at the contract level; they do not ingest tickets. There is **no regulatory driver** for customer-SLA evidence in the target segments, which removes the compliance-budget angle entirely. Do not position here.

## Answering the critical question

> Is "cross-system SLA monitoring + OLA attribution + evidence" a defensible category, or a feature existing platforms could add?

**As stated: a feature.** All three components exist somewhere already — cross-system correlation in Clockspring and Celonis, OLA in ServiceNow and Deviniti, evidence in every audit trail. The bundle has no technical secret. Any of Zendesk, Atlassian, or ConnectWise could ship a credible version within two quarters if they chose to.

**What is genuinely defensible is much smaller:** being the only party willing to compute one honest number across two vendors who each want to be the system of record. That is a _positional_ moat — it comes from being neutral, not from being clever — and positional moats are real but shallow. They protect a beachhead; they do not protect a platform.

Which means: this can be a good small business. The evidence does not support it being a large defensible one.

## Landscape summary

|                                                              | Saturated  | Genuine whitespace |
| ------------------------------------------------------------ | ---------- | ------------------ |
| In-system SLA timers & alerts                                | ██████████ | —                  |
| MSP client reporting / QBR                                   | █████████  | —                  |
| Vendor-side SLA credit recovery                              | ███████    | —                  |
| Jira-side cross-project SLA/OLA                              | ██████     | —                  |
| Enterprise cross-system process mining                       | █████      | —                  |
| **Mid-market support→engineering escalation SLA continuity** | █          | **← here**         |

**Threat level: High.** **Potential moat: narrow and positional** — vendor neutrality, plus the accumulated correctness of a time-arithmetic engine that reconciles two systems' conflicting pause and calendar rules. The second of those is the only asset that compounds.

---

# Phase 3 — Customer & Buyer Analysis

## Buyer map

| Persona                                   | Pain                                                               | Owns the problem?      | Budget                  | Trigger event                                              | Current workaround                             | Buys?                                 |
| ----------------------------------------- | ------------------------------------------------------------------ | ---------------------- | ----------------------- | ---------------------------------------------------------- | ---------------------------------------------- | ------------------------------------- |
| **Support Manager**                       | Chases engineering daily, gets blamed for slips they can't control | Yes                    | No                      | An escalation blew up and they found out from the customer | Slack pings, manual Jira checks, a spreadsheet | **User + Champion**                   |
| **Head of Support / Support Ops**         | Owns the SLA number, defends it to execs, can't explain it         | **Yes — most acutely** | **Yes, $5–50k tooling** | Missed a commitment on a named account; QBR embarrassment  | Manual monthly report, 4–8 hours               | **★ Economic buyer**                  |
| **Service Delivery Manager** (MSP/agency) | Contractual SLAs across many clients                               | Yes                    | Sometimes               | Client escalation or renewal                               | PSA reports + BrightGauge                      | Buyer, but well-served already        |
| **MSP Owner**                             | Cares about margin and retention, not attribution                  | Partly                 | Yes                     | Losing a client over service quality                       | PSA + QBR tool                                 | Buyer, but **conflicted** — see below |
| **Operations Manager**                    | Cross-team flow                                                    | Partly                 | Sometimes               | Recurring bottleneck                                       | Meetings                                       | Influencer                            |
| **CTO / VP Engineering**                  | Doesn't feel the pain; feels the accusation                        | No                     | Yes                     | Being blamed                                               | Denial, or "it's not in our Jira"              | **★ Blocker — must be neutralised**   |
| **COO**                                   | Aggregate service quality                                          | Partly                 | Yes                     | Board-level complaint                                      | Whatever support sends up                      | Executive stakeholder                 |
| **Account Manager / CS**                  | Blindsided in customer calls                                       | Yes, sharply           | No                      | Customer complains before they knew                        | Asks support in Slack                          | Strong champion, no budget            |
| **Compliance / Legal**                    | Nothing. No regulation requires this.                              | No                     | Yes                     | Rare                                                       | —                                              | Not a buyer. Do not pursue.           |

## The distinction the brief asks for

- **User:** Support Manager and Account Manager — daily, and the ones who feel relief.
- **Champion:** Support Manager, because they are tired of being blamed for engineering's queue.
- **Buyer / Economic buyer:** **Head of Support** or **Support Operations lead**. Owns the metric, owns a tooling budget, and is the only person for whom this is a career problem rather than an annoyance.
- **Blocker:** **VP Engineering.** Controls the Jira token. Has no upside and obvious downside. Every design and messaging decision must account for them.
- **Executive stakeholder:** COO or CCO, who hears about it only when it breaks.

## The conflict of interest that reframes the MSP vertical

An MSP or vendor that installs this tool creates a **contemporaneous, timestamped, exportable record of its own contractual failures** — in a market where service credits are the client's sole and exclusive remedy, are capped, and must be claimed in writing inside a short window that providers have little incentive to make easy.

Their lawyer's advice will be: do not create that record.

This does not kill the MSP vertical, but it inverts the pitch. To an MSP you cannot sell _"prove who breached."_ You can only sell _"prove you delivered"_ — positive compliance evidence for QBRs and renewals. And that job is already served by BrightGauge and QBR Studio, the latter with a free tier and flat unlimited-client pricing.

**Strongest buyer persona:** Head of Support at a B2B SaaS company running a customer-facing helpdesk and an engineering tracker, with contractual response/resolution commitments on named enterprise accounts and no visibility once a ticket escalates. Reasoning in [02-Vertical-Wedge-ICP.md](02-Vertical-Wedge-ICP.md).

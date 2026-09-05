# 06 — Outreach Kit

**Supports Phases 19–20.** Everything needed to run Week 1–2 of [05-Validation-and-Kill-Criteria.md](05-Validation-and-Kill-Criteria.md): how to find the 60 companies, what to send them, and what to ask on the call. Companion files: [target-list.csv](target-list.csv), [call-scorecard.csv](call-scorecard.csv).

---

## 1. Building the 40-company target list

### Qualifying signal, cheapest checks first

Work through these in order — each filters out companies before you spend time on the next check:

1. **Employee count 80–400.** LinkedIn company page "employees" figure, or the about page. Fastest filter, do it first.
2. **B2B, not B2C.** Sells to companies, not consumers — a consumer app has no contractual SLA to breach.
3. **Runs a visible support operation.** Has a `support.company.com` or `help.company.com` page, or a status page at `status.company.com`.
4. **Uses Zendesk.** Check the support portal footer ("Powered by Zendesk"), or search `site:company.com "zendesk"`, or check job postings.
5. **Uses Jira or Linear for engineering.** Check engineering job postings — they almost always name the tracker. Search `"[company name]" jira OR linear engineer` on LinkedIn Jobs or a search engine.
6. **Some signal of contractual (not just published) SLAs.** Look for "Enterprise" or "Premium" tiers on the pricing page with support commitments named, or a security/trust page that mentions SLA response times.

A company that passes 1–5 is a lead. Passing 6 as well makes it a strong lead — mark it as such, but don't discard the rest; contractual status is confirmed on the call (question 5–6 in the script below), not before.

### Where to search

| Source                                              | What to look for                                                                                                                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LinkedIn people search                              | Titles: "Head of Support," "Director of Support Operations," "Support Operations Manager," "VP Customer Support," "Director of Customer Support" — filtered to company size 51–500 |
| LinkedIn Jobs / Indeed                              | Postings for support or support-ops roles that name Zendesk _and_ a postings for engineering roles that name Jira/Linear, at the same company, within the last 12 months           |
| Support Driven Slack / community directories        | Members with the buyer titles above; their company is visible in profile or bio                                                                                                    |
| G2 / Capterra reviews of Zendesk and Jira           | Reviewer's company name + title, filtered to mid-market segment                                                                                                                    |
| Status pages (statuspage.io, status.io directories) | A public status page is a weak signal of "cares about reliability commitments" — useful as a tiebreaker, not a primary filter                                                      |

### Target list fields

Use [target-list.csv](target-list.csv) — one row per company, columns for the qualifying checks above, the specific buyer's name and LinkedIn URL, the observable personalization hook you'll use in outreach, and outcome tracking (sent / replied / booked / declined). Filling in the "hook" column _while_ researching is what makes the messages below non-templated — do this as one pass, not two.

**Target: 40 rows by end of Tuesday 8 Sep** (revised down from the original 60-row/20-reserve target on 2026-09-05) — reached same-day via job-board sourcing. Every row is still `needs_qualification`: Jira/Linear usage (and, for several, the buyer's name) needs confirming before check 6 is skipped and a message goes out.

---

## 2. Outreach messages

### The rule these all follow

Every message leads with a **specific, verifiable, slightly alarming fact about their own system** — never with the product. The fact does the work; the product is one line at the end, framed as research, not a pitch. Nothing asks for a login or a meeting longer than the reply itself requires.

Do not send the same message twice. Each one needs the personalization line filled in from the target-list hook column — a job posting, a status page incident, a specific enterprise-tier promise on their pricing page.

### A — LinkedIn connection request + follow-up (primary channel, ~25 of 40)

**Connection note** (300 char limit — keep to two sentences):

> Hi [Name] — noticed [Company] runs support through Zendesk and hands escalations to Jira. I'm researching a specific SLA-timing gap between the two and would value 10 min of your view, no pitch.

**First message after they accept:**

> Thanks for connecting. Quick context on why I reached out: Zendesk's resolution and reply timers don't actually pause while a ticket sits in Pending — so if [Company] escalates P1s to engineering and marks them Pending while waiting, the customer-facing SLA clock is probably still running underneath, uncounted. I'd be surprised if that's on anyone's radar.
>
> I'm not selling anything — researching whether this is a real, felt problem before building something for it. Would a 15-minute call be worth your time? Happy to work around your calendar.

**Follow-up, day 5, if no reply:**

> Following up in case this got buried — totally fine if now's not the moment. If it's useful, I can also just send you a 2-question async version instead of a call: (1) roughly how many tickets/month get escalated from support to engineering, and (2) do you trust the SLA number you report internally? Either way, appreciate you reading this far.

### B — Warm intro request (to your own network, ~5 of 40)

> Hey [Name] — random ask: do you know anyone who runs support or support-ops at a B2B SaaS company (Zendesk + Jira/Linear stack, ~100–300 people)? I'm researching a specific SLA-tracking problem and want to talk to people who actually own that number, not just anyone in support. A LinkedIn intro or forward is plenty — no need to set anything up.

### C — Community post (Support Driven Slack / similar, 1 post reaching many, counted as ~5 of 40)

> Quick research ask for anyone running support ops at a B2B SaaS company that escalates tickets from Zendesk (or similar) into Jira/Linear: does your reported SLA number account for time the ticket sits in engineering's queue? I've been digging into how the two systems' clocks actually disagree once a ticket crosses that boundary, and I'm looking for 15-min conversations with people who own that number monthly. Not selling anything yet — genuinely trying to figure out if this is a real problem before building for it. DMs open.

### D — Cold email (~5 of 40, for leads with a public support/security-contact email but no clear LinkedIn path)

**Subject:** Zendesk timers don't pause in Pending — does that affect [Company]?

> Hi [Name],
>
> Quick, specific note: Zendesk's First Reply, Next Reply, Periodic Update and Total Resolution SLA targets don't pause while a ticket is in Pending status. If [Company] escalates tickets to Jira and marks them Pending while engineering works them, the customer-facing clock is likely still counting underneath — independent of whatever Jira shows.
>
> I'm researching how teams handle this gap before building anything for it, and would value 15 minutes of your perspective. No pitch — happy to share what I find either way.
>
> [Name]

---

## 3. Interview script

Framing at the top of every call, said out loud: **"This isn't a sales call — I'm trying to understand the problem before I decide whether to build anything. I'll ask about your workflow first; if it's useful I'll say what I'm looking at in the last two minutes."** This framing is load-bearing — it is why people will be candid.

### Opening (2 min)

- Confirm role, team size, and roughly how many people are in support vs. engineering.
- "What tools does support run on, and what does engineering use?" — confirms Zendesk/Jira-or-Linear before going further.

### Core questions (in this order; do not skip to the product)

1. **"Walk me through the last time an escalated ticket went badly. What happened?"**
   Open-ended on purpose. Let them tell the story before you ask anything leading. Note whether they can name a _specific_ incident unprompted — that's the Phase 20 threshold metric.

2. **"When a ticket goes to engineering, how do you know what's happening to it?"**
   Listen for: Slack pings, standups, "I ask [name] directly," nothing. A "nothing" answer is a strong positive signal for the product.

3. **"How do you produce your monthly SLA number? Roughly how long does that take?"**
   Get a number in hours if you can — this feeds the ">2h/month" threshold directly.

4. **"Do you trust that number? Would engineering agree with it if you showed them?"**
   The second half of this question is the one that actually matters — disagreement between systems is the whole thesis.

5. **"How many tickets a month get escalated from support to engineering?"**
   The ICP-qualifying number. Write it down precisely; don't round.

6. **"When a ticket's escalated, do people use the actual Zendesk–Jira link/integration, or do they paste a URL into a comment?"**
   **The single highest-leverage question in the script.** It decides whether deterministic correlation — the entire technical feasibility case — holds for this company. Push for specifics if the first answer is vague ("mostly," "depends on the person") — ask "for the last 5 escalations you can remember, were they linked properly?"

7. **"When was the last time a customer disputed whether you'd met a commitment? What did you do about it?"**
   Tests the evidence-frequency assumption from Phase 8/20. If they can't remember one, say so plainly in your notes — it's a real finding, not a failed interview.

8. **"If I could show you exactly where the time went on every escalation — which team, which stage — who else at [Company] would want to see that?"**
   Reveals the political map (who's the champion, who might be the blocker) without ever using the word "attribution" or "blame."

### Closing (2 min)

- "Would you be willing to export your last 90 days of Zendesk tickets and Jira issue history — two CSVs — so I can show you what actually happened? Takes about 10 minutes on your end, I'll send back a findings doc within 48 hours, no strings, no login needed from me."
- If yes: get the export mechanics sorted before hanging up (who pulls it, by when).
- If hesitant: don't push. Ask instead: "Is there anyone else at [Company] — maybe on the engineering side — worth me talking to as well?"

### Immediately after every call

Fill in [call-scorecard.csv](call-scorecard.csv) while it's fresh — the raw answers, not just yes/no, so patterns across calls are visible later, not just the tallied score.

---

## 4. Weekly targets (from [05](05-Validation-and-Kill-Criteria.md), repeated here for reference)

|                               | Target                    |
| ----------------------------- | ------------------------- |
| Target-list rows by Tue 8 Sep | 40 (revised down from 60) |
| Messages sent by Thu 10 Sep   | 40                        |

**Note:** with the list capped at 40 rows and a send target of 40, there is no reserve for Week 1's bounces/disqualifications (the original 60-row list held 20 in reserve). Every row also still needs Jira/Linear confirmed before it's send-ready — expect the sendable count to be below 40 once qualification runs.

**Buyer identification (in progress, 2026-09-05):** the 10 rows with both Zendesk and Jira independently confirmed (Prove, DataSnipper, Rentman, Aiwyn, Kojo, DEUNA, BriteCore, Dexterity, Horizon3.ai, Viewpost) now have a named buyer and title in target-list.csv, found via LinkedIn search. Exact profile URLs could not be extracted through search (Google/Bing don't surface bare linkedin.com/in/ links reliably) — each row's `notes` column says who to look up by name directly on LinkedIn before sending. The remaining 30 rows still need both their Jira/Linear signal and a named buyer before they're outreach-ready.
| Replies | ≥10 |
| Calls booked | ≥6 (Week 1), 12–15 total by end of Week 2 |
| CSV exports obtained | ≥3 by end of Week 2, ≥5 by end of Week 3 |

Track sent/replied/booked per row in [target-list.csv](target-list.csv); track interview answers per call in [call-scorecard.csv](call-scorecard.csv). The scorecard's tally row is what you read against the Phase 20 success table on 20 Sep.

---

## 5. Search recipes for building the list (manual, but fast)

Generic web search surfaces vendor marketing content and integration blog posts, not named target companies — confirmed by running it. A list at this specificity needs LinkedIn or a tech-stack lookup tool. These are copy-paste-ready starting points; each takes under 20 minutes.

### LinkedIn Sales Navigator (best source — do this first)

**Lead filter:**

- Title (any of): `Head of Support` · `Director of Support Operations` · `VP Customer Support` · `Support Operations Manager` · `Director of Customer Support`
- Company headcount: `51–200` and `201–500` (run both bands, LinkedIn doesn't offer 80–400 directly)
- Industry: `Computer Software` or `Internet`

No free Sales Navigator account? The equivalent plain LinkedIn search still works, just paginate manually:
`site:linkedin.com/in "Head of Support" "SaaS"` — run separately for each title above.

### Job-board Google dorks — surfaces companies actively naming their stack

Run each of these as a literal search:

```
site:boards.greenhouse.io "Zendesk" "Jira" support
site:jobs.lever.co "Zendesk" "Jira" support
site:jobs.ashbyhq.com "Zendesk" "Jira" support
"support operations" "Zendesk" "Jira" hiring
```

A posting that names both tools in the same job description is a near-certain qualifier for checks 4–5 in section 1 — it's a company self-disclosing its stack.

### G2 comparison-page mining

G2's [Jira Service Management vs. Zendesk Support Suite](https://www.g2.com/compare/jira-service-management-vs-zendesk-support-suite) page and the [Zendesk reviews page](https://www.g2.com/products/zendesk-support-suite/reviews) filtered to **Mid-Market** segment surface real reviewers who volunteer "we also use Jira for escalations" in the review text — their listed company and title are often public on the review itself.

### 30-second manual stack check, per candidate company

1. Open `support.[company].com` or `help.[company].com` — Zendesk-hosted help centers usually show a `zdassets.com` script if you view page source, or the Zendesk widget is visually recognizable.
2. Open their careers page or search `"[company]" jira OR linear engineer` — engineering postings almost always name the tracker.

### Leads found this session

| Company               | Size                            | Signal                                                                                              | Caveat                                                                          |
| --------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **360Learning**       | unconfirmed                     | Actively hiring Global Head of Support; confirmed Zendesk user                                      | Same search surfaced Salesforce, not Jira — verify via engineering postings     |
| **Virtuous**          | 51–200                          | Director of Support req open ~1 day; JD names Zendesk as "platform of record"                       | Jira/Linear listed only as general "familiarity," not confirmed primary tracker |
| **Prove**             | 201–500                         | Senior Director, Global Support req; JD names Zendesk, Jira, PagerDuty directly                     | B2B identity-verification vendor to banks — strong fit, unconfirmed on call     |
| **HappyCo**           | 201–500                         | L2 Support posting describes Zendesk→Jira/Notion/Gainsight escalation flow                          | Buyer identified: Keith J. Nelson, Chief Customer Officer                       |
| **DataSnipper**       | 201–500                         | Support Specialist posting names Intercom, Zendesk, Jira; sells to Big Four audit firms             | Buyer not yet identified                                                        |
| **Rentman**           | 51–200                          | Support posting names Zendesk and Jira directly                                                     | Slightly under the 80-employee floor                                            |
| **Inspera**           | 51–200                          | Head of Customer Support req open; sells assessment platform to universities                        | Stack list in JD is illustrative ("such as"), not confirmed current tools       |
| **Neon One**          | 201–500                         | Support Specialist posting lists Zendesk, Jira, Salesforce, Slack                                   | Buyer not yet identified                                                        |
| **Datarails**         | 201–500                         | Posting says Zendesk/Jira experience "a plus"                                                       | Weak, optional signal — low confidence                                          |
| **Aptitude Software** | conflicting (275 vs. 501–1,000) | Head of Customer Support req lists Jira Service Mgmt, Zendesk, ServiceNow, Salesforce as acceptable | Confirm headcount before treating as in-range                                   |

None of these are outreach-ready yet — every row needs its Jira/Linear signal (and, for several, its buyer name) confirmed before check 6 is skipped and a message goes out. Sourcing method: job-board Google dorks (`site:boards.greenhouse.io`, `site:jobs.lever.co`, `site:jobs.ashbyhq.com`, `site:linkedin.com/jobs`, each + `"Zendesk" "Jira"`) per the recipes above — G2 mining and LinkedIn Sales Navigator search are still untried and are the next sources to pull from to reach 60.

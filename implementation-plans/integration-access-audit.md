# Integration Relationship & Access Audit Report

Scope: Zendesk, Jira, Linear — as connected to and correlated by **this product**
(SLA-Breach-Monitoring), and as they relate to each other natively as
third-party SaaS platforms.

Two distinct systems are analyzed throughout, and every claim below is tagged
with which one it describes:

- **[SBM]** — SLA-Breach-Monitoring, this codebase. Verified by reading
  `packages/zendesk`, `packages/jira`, `packages/linear`, `packages/core`,
  `packages/db/prisma/schema.prisma`, and `apps/web/src/app/settings/integrations`.
- **[Native]** — behavior of Zendesk, Jira, or Linear's own official
  integrations with each other, independent of this codebase. Verified against
  vendor documentation (cited in §12).

This distinction matters because **SBM does not chain the three platforms
together** (`Zendesk → Jira → Linear` is not a pipe that exists anywhere in
this system). SBM connects to each of the three independently and does its own
read-only correlation; any *native* Zendesk↔Jira or Jira↔Linear sync is a
separate, optional thing a customer may or may not also have installed on
their own tenants, and SBM has no visibility into whether it exists.

---

## 1. Executive Summary

| System | Role |
|---|---|
| **Zendesk** | Customer-facing support/ticketing. The system of record for the customer commitment (first response, resolution SLA). |
| **Jira** | Engineering issue tracker. One of two supported sources for the "engineering leg" of a case. |
| **Linear** | Engineering issue tracker. The other supported source for the engineering leg — **an alternative to Jira, not a supplement to it** (`apps/web/src/app/settings/integrations/page.tsx:147-149`). |

**[SBM]** topology, as actually built:

```text
Zendesk ──OAuth(read)──▶ RawEvent ──▶ NormalizedEvent ──▶ Case ─┐
Jira    ──OAuth(read)──▶ RawEvent ──▶ NormalizedEvent ──▶ CaseLink (via Jira remote links → Zendesk URL)
Linear  ──OAuth(read)──▶ RawEvent ────────(no correlator yet — roadmap step 15 unbuilt)
```

Every arrow above is **this product pulling from each platform independently**
and stitching the result together itself. There is no arrow from Zendesk to
Jira, or from Jira to Linear, or from Zendesk to Linear — SBM is the only place
the three systems' data ever meet. The naive textbook diagram —

```text
Customer → Zendesk Ticket → Jira Issue → Linear Issue
```

— describes a *possible customer workflow* (a support agent escalates a
ticket, engineering tracks it in Jira, and some teams additionally mirror Jira
into Linear), **not a data pipe that exists in this system, and not something
this codebase can assume is configured.** SBM must discover any such
relationship after the fact from evidence (a Jira remote link pointing at a
Zendesk URL), never assume it.

Combination summary:

| Combination | What SBM can do |
|---|---|
| Zendesk only | Full customer-side SLA tracking (first response, resolution). No engineering leg — every case's engineering time is `unknown`. |
| Jira only | Raw Jira ingestion runs, but with no Zendesk `Case` rows to link against, `runJiraCorrelation` (`packages/jira/src/correlate.ts:98-102`) short-circuits immediately (no Zendesk subdomain on the org) and produces zero `CaseLink`s. Nothing surfaces on the dashboard. |
| Linear only | Same as Jira-only: ingestion runs, no correlator exists yet at all (roadmap step 15), so Linear data is inert regardless of Zendesk. |
| Zendesk + Jira | Full pipeline: SLA tracking + engineering leg attribution via deterministic Jira-remote-link correlation. This is the only fully-wired cross-system combination today. |
| Zendesk + Linear | SLA tracking works; engineering leg does **not** — the Linear normalizer/correlator (step 15) doesn't exist yet, so connecting Linear today has zero effect on case timelines. |
| Jira + Linear (no Zendesk) | No `Case` rows exist at all (`Case` is created only from Zendesk ticket ingestion — see `packages/db/prisma/schema.prisma:100-114`, `Customer.zendeskOrgId`). Both integrations ingest `RawEvent`s that are never normalized into anything visible. |
| All three | Same as Zendesk + Jira, plus inert Linear ingestion, until step 15 ships. |

---

## 2. Integration Matrix

| Integration | Direct Connection | Purpose | Data Flow | Direction | Required Access | Agent Dependency |
|---|---|---|---|---|---|---|
| Zendesk ↔ Jira | **[SBM]** No direct connection — both connect independently to SBM, which correlates them via Jira remote-link evidence. **[Native]** Yes, if the customer separately installs Zendesk's official "Support for Jira" app. | [SBM] Attribute engineering time on a support case. [Native] Let a support agent create/link a Jira issue from a ticket. | [SBM] Jira `remote_link` RawEvents scanned for a URL matching `{subdomain}.zendesk.com/{agent/tickets\|requests\|api/v2/tickets}/{id}` (`packages/jira/src/correlate.ts:19`). | [SBM] One-way read, both legs, correlation happens in SBM. [Native] Zendesk→Jira issue creation/linking; Jira→Zendesk status/comment push-back (see §12). | [SBM] Two independent OAuth grants: Zendesk `read`, Jira `read:jira-work offline_access`. [Native] Marketplace app install in Zendesk + a Jira account with project access. | [SBM] None — fully automated, no agent action required once both are connected. |
| Zendesk ↔ Linear | No direct connection in either [SBM] or [Native]. No official Zendesk↔Linear app exists. | [SBM] Intended as an alternative engineering-leg source. Not yet functional (§8). | None today — the Linear normalizer/correlator does not exist (roadmap step 15). | N/A | Zendesk `read` + Linear `read` OAuth grants, independently. | A bridge (Zapier/Make/custom, or SBM itself once step 15 ships) is mandatory — there is no native path. |
| Jira ↔ Linear | **[SBM]** No connection — SBM never compares Jira and Linear data to each other; both are only ever compared against Zendesk. **[Native]** Yes — Linear's own "Jira Sync"/"Jira Importer" (see §12), entirely outside SBM. | [Native] Migrate off Jira onto Linear, or run both in parallel during a transition. | [Native] Issues, epics/projects, status, assignee (only when both sides' users have linked accounts), labels. | [Native] Configurable per team: uni-directional (Jira→Linear) or bi-directional. | [Native] The Jira-side connecting user needs Jira's **ADMINISTER** permission (site/project admin) to let Linear install webhooks — project-level access alone is insufficient. | N/A to SBM — this is a customer-side choice SBM has no visibility into. |

For every integration, answered explicitly:

- **Who initiates the connection:** [SBM] An authenticated user of the SBM organization, from `/settings/integrations` — there are no per-integration role checks (`apps/web/src/lib/auth.ts:8`: "v1 has no roles/permissions to look up per-request anyway"). Any signed-in teammate can connect, disconnect, or trigger a backfill for Zendesk, Jira, or Linear.
- **Which system owns the source record:** Always the external platform (Zendesk ticket, Jira issue, Linear issue). SBM never writes back (`ZendeskConnectForm`/`JiraConnectButton`/`LinearConnectButton` copy: "no tickets/issues/comments/fields are ever written back" — `apps/web/src/app/settings/integrations/page.tsx:79,113,147`).
- **One-way or two-way:** [SBM] Strictly one-way, read-only, into all three. [Native] Zendesk↔Jira and Jira↔Linear can be configured bi-directional on the vendor side; that has no bearing on SBM's own one-way ingestion.
- **Entities synchronized:** [SBM] Zendesk: tickets, ticket audits, organizations, SLA policies, business-hours schedules + holidays (`packages/zendesk/src/backfill.ts:33`, `packages/zendesk/src/calendars.ts`). Jira: issues, changelog histories, remote links, global statuses (`packages/jira/src/backfill.ts:24`). Linear: issues, history entries (status transitions), attachments/linked resources (`packages/linear/src/backfill.ts:11`).
- **Fields synchronized:** Whatever the provider's list/search endpoint returns, stored verbatim as `RawEvent.payload` JSON (`packages/db/prisma/schema.prisma:64-78`) — no field-level allowlist at ingestion time; field selection happens later in the (Zendesk/Jira-only, Linear-pending) normalizer.
- **Comments synchronized:** No. None of the three adapters ingest ticket/issue *comments* — only tickets/issues, status-change history, org/policy metadata, and link objects. [Native, Zendesk↔Jira only]: the official app does surface Jira comments in the Zendesk sidebar.
- **Status changes synchronized:** [SBM] Ingested as raw audit/changelog/history events for Zendesk and Jira; used by the (not-yet-existent for Linear) normalizer to build `NormalizedEvent.fromState/toState`. [Native] Zendesk↔Jira and Jira↔Linear can push status changes across, per each vendor's own sync rules.
- **Users/assignees synchronized:** [SBM] Actor identity is captured per raw event but there is no user-identity mapping table across the three systems — an "actor" string is provider-local and never reconciled against a person across platforms. [Native, Jira↔Linear] Assignee only carries over if both accounts are explicitly linked.
- **Links/references maintained:** Yes — this is the entire purpose of `CaseLink` (`packages/db/prisma/schema.prisma:143-160`), carrying `method` (`official_link | remote_link | pattern | manual`) and `confidence` (`certain | probable`). Only `remote_link` is implemented; `official_link` is a defined-but-unused enum value/UI label (`apps/web/src/lib/format.ts:107`) reserved for reading Zendesk's own official-integration link field, which SBM does not currently ingest.
- **Webhooks/API/OAuth/service accounts:** OAuth 2.0 authorization-code grants only, one per organization per provider (`@@unique([organizationId, provider])`, `packages/db/prisma/schema.prisma:58`). No webhooks exist anywhere in this codebase yet (roadmap step 19, unbuilt) — everything is poll-based (5-min active-set / 60-min sweep, per `implementation-plans/roadmap.md:64-80`). No service accounts; credentials are the connecting user's own OAuth grant, stored per-organization, not per-user.
- **Workspace/project/team/global level:** **Global, per connected account, in all three.** Zendesk: entire subdomain. Jira: the first Jira Cloud site returned by `accessible-resources` for that user (`packages/jira/src/oauth.ts:125-142` — "v1 assumes one Jira site is granted per org and uses the first one returned"), with no per-project filter in `runJiraBackfill`. Linear: entire workspace, no per-team filter in `runLinearBackfill`. **There is no project- or team-scoped connection anywhere in SBM** — see §5.

---

## 3. Agent Access Model

"Agent" here means a **human user of SBM's organization**, since SBM has no
concept of per-integration roles (§2). Distinct from this is a **support/
engineering agent working directly inside Zendesk/Jira/Linear**, called out
separately where relevant.

### Scenario A — Zendesk only

- **Can do:** Everything SBM's core value proposition needs — connect, backfill 90 days (`ZendeskBackfillButton`), see the dashboard's at-risk/breached lists and compliance %, open a case detail page with the full Zendesk-side timeline and "how this was calculated" disclosure.
- **Cannot do:** See any engineering-leg attribution. Every `Case`'s engineering time renders as `unknown`/unattributed (Phase 14's honesty rule: "unattributed time must never be silently redistributed" — `plans/04-Architecture-Sketch.md:209`). Cannot create a Jira or Linear issue — SBM has no write capability to any provider, ever, regardless of connection state.
- **Linked-record visibility:** None. With no Jira/Linear `Integration` row, `runJiraCorrelation` never runs for that org, so no `CaseLink` rows exist and the case-detail page's Jira/Linear outbound link is simply absent.
- **Service/integration-account execution:** No — SBM has no server-side or service-account path that acts on Zendesk data independent of the org's own OAuth grant. If a customer *separately* has Zendesk's official Jira app installed, that operates entirely outside SBM and has no bearing on what SBM shows.
- **What the agent sees in Zendesk itself:** Nothing changes in Zendesk — SBM is read-only and makes zero writes, so a Zendesk agent working tickets sees no SBM-originated activity in Zendesk at all.

### Scenario B — Jira only

- **Can do:** Trigger a Jira OAuth connect and backfill; `RawEvent` rows accumulate for issues/changelogs/remote links.
- **Cannot do:** See any of it surface anywhere in the product. `runJiraCorrelation` looks up the org's Zendesk `Integration` for a subdomain and returns immediately with all-zero counts if none exists (`packages/jira/src/correlate.ts:98-102`). No `Case` exists to attach anything to (Case is only created from Zendesk ticket ingestion). The dashboard, case list, and CSV export all read from `Case`/`Commitment` — Jira-only data is invisible everywhere in the UI.
- **Linked Zendesk visibility:** None — there's nothing to link to.
- **Zendesk interaction:** None — SBM never writes to Zendesk under any configuration.
- **Linear interaction:** None — Jira and Linear are never compared to each other in SBM (§2); a Jira connection has zero effect on Linear ingestion or vice versa.

### Scenario C — Linear only

- Identical outcome to Scenario B, for a different reason: even *with* a Zendesk connection, Linear's normalizer/correlator doesn't exist yet (roadmap step 15). Linear-only or Linear+Zendesk both currently produce Linear `RawEvent`s that are permanently inert. This is the one scenario in this report driven by an unshipped feature rather than an architectural boundary — worth flagging to product/eng as a materially different "why it doesn't work" than the Jira case.

### Scenario D — Zendesk + Jira

```text
Zendesk Agent
      ↓
Zendesk Ticket ── (optionally) Zendesk's own official Jira app creates/links a Jira issue
      ↓
Jira remote-link object now exists on the Jira issue, pointing at the ticket URL
      ↓
SBM's poller ingests that remote link as a RawEvent, independently of the above
      ↓
runJiraCorrelation matches it to the Zendesk Case by ticket id in the URL → certain/remote_link CaseLink
      ↓
Engineering-leg NormalizedEvents from Jira now attribute time to that Case
      ↓
Dashboard: "escalations aging in engineering," case detail: time-by-stage bar, link-out to both systems
```

This is the fully-wired path and the only one that produces engineering-leg
data today. Two things worth being precise about:

- SBM does **not** require the customer to have Zendesk's official Jira app
  installed. Any mechanism that leaves a Jira **remote link** pointing at a
  Zendesk ticket URL works — including an engineer manually pasting the ticket
  URL into a Jira issue's web links. The official app is simply the most
  common way that link gets created.
- Link coverage is reported honestly, never assumed complete: `unmatchedNotZendeskUrl` and `unmatchedNoCase` counters (`packages/jira/src/correlate.ts:68-73`) exist specifically so an account's "linked N of M escalations" number is real, per Phase 15's explicit anti-goal: "the system must never confidently invent a relationship" (`plans/04-Architecture-Sketch.md:231-241`).

**Required permissions, both sides:**
- Zendesk: SBM's OAuth grant needs only `read` (`packages/zendesk/src/oauth.ts:10`) — ticket/org/policy read.
- Jira: SBM's OAuth grant needs `read:jira-work offline_access` — but per Atlassian's own documentation, **that scope is capped by the connecting user's own Jira permissions**: "if a user does not have the Browse projects permission then the Get project operation won't be able to access project data even if the app has the required scopes" ([Atlassian dev docs](https://developer.atlassian.com/cloud/jira/platform/scopes-for-oauth-2-3LO-and-forge-apps/)). Practically: whichever teammate clicks "Connect Jira" determines which projects SBM can ever see remote links from — a broader OAuth scope does not compensate for that person lacking Browse Projects on a given project.

### Scenario E — Zendesk + Linear

Structurally identical intent to Scenario D, but **non-functional today**:
Linear issues are ingested, but nothing in `packages/linear` or `packages/core`
creates a `CaseLink` or `NormalizedEvent` from them (no `correlate.ts` /
`normalize.ts` exists in `packages/linear/src`, confirmed absent). Connecting
Linear today has the same visible effect on the dashboard as not connecting it
at all — the only difference is `RawEvent` rows accumulating in the database.
Treat any customer-facing claim of "Linear support" as ingestion-only until
roadmap step 15 ships.

### Scenario F — Jira + Linear (without Zendesk)

```text
Jira Project(s)               Linear Team(s)
      ↓  RawEvent                    ↓  RawEvent
      └──────────────┬───────────────┘
                      ↓
         No Case exists to attach either to
                      ↓
              Nothing surfaces anywhere
```

**[SBM]** With no Zendesk `Integration`, there is no `Case` row for anything to
correlate against (Case is created only from a Zendesk ticket, per
`packages/db/prisma/schema.prisma:119-141` and roadmap step 3). Both
integrations poll and store `RawEvent`s that are dead weight from SBM's
perspective — no dashboard signal, no notification, nothing.

**[Native]** Separately from SBM, Linear's own **Jira Sync** can connect a Jira
project/space to a Linear team directly, entirely outside this product:

| Aspect | Behavior |
|---|---|
| Project/team mapping | One Jira space maps to at most one Linear team; multiple Jira spaces can target the same team. |
| Issue sync | Title, description, assignee, creator, priority, status, labels, due date. |
| Status sync | Yes, per the configured direction. |
| Assignee sync | Only if both the Jira and Linear accounts are explicitly linked by each user — otherwise defaults to unassigned or the integration's configuring user. |
| Comments | Not listed among Linear's documented synced fields for Jira Sync. |
| Labels | Yes. |
| Projects/epics | Synced with title, status, labels, priority, description, project lead. |
| Direction | Configurable per team: uni-directional (Jira→Linear) or bi-directional. |
| Permissions required | The Jira-side connecting user must hold Jira's **ADMINISTER** permission (site or project admin) — required because Linear installs webhooks on the Jira side. Project-level access alone does not qualify. On the Linear side, workspace admin access is required to enable the integration. |

Source: [Linear Docs — Jira](https://linear.app/docs/jira).

### Scenario G — Zendesk + Jira + Linear

**Zendesk → Jira → Linear does not mean Zendesk data automatically reaches
Linear.** This is the single most important architectural fact in this
report, and it holds in both directions of analysis:

- **[SBM]:** The deterministic correlator only ever compares Jira against
  Zendesk (`packages/jira/src/correlate.ts` looks up the org's *Zendesk*
  integration specifically). There is no equivalent Linear correlator at all
  yet, and even once step 15 ships, the roadmap describes it as extending
  "the deterministic correlator... to produce `CaseLink` rows from
  Zendesk↔Linear links on the same deterministic-tier basis as
  Zendesk↔Jira" (`implementation-plans/roadmap.md:173-178`) — i.e. a
  **second, independent Zendesk↔Linear correlation path**, not something
  that rides through Jira. A case whose engineering work is tracked in
  Linear (not Jira) gets zero attribution from the mere fact that Jira is
  also connected.
- **[Native]:** Even if a customer separately runs both Zendesk's official
  Jira app *and* Linear's Jira Sync, those are two unrelated point-to-point
  integrations configured by two different vendors with no shared state.
  Zendesk's app only knows about the Jira issue it linked; Linear's Jira Sync
  only knows about the Jira project/team mapping it was configured with.
  Neither product is aware the other exists. A true "Zendesk ticket visible
  from Linear" experience requires **both** links to independently exist and
  point at the same Jira issue — nothing propagates a relationship
  transitively.

So today, with all three connected: Zendesk+Jira gives full engineering-leg
attribution (Scenario D); Linear ingests silently and contributes nothing
(Scenario E's limitation persists regardless of Jira being connected too).

---

## 4. Permission Dependency Matrix

| Agent Access | Zendesk | Jira | Linear | What Can Agent Do? | What Is Blocked? |
|---|---:|---:|---:|---|---|
| Zendesk only | ✅ | ❌ | ❌ | Full SLA/first-response/resolution tracking, dashboard, CSV export, case timeline (support side only). | Any engineering-leg attribution; time-by-stage always shows 100% unattributed. |
| Jira only | ❌ | ✅ | ❌ | Raw ingestion runs silently. | Everything user-visible — no `Case` exists to attach data to. |
| Linear only | ❌ | ❌ | ✅ | Raw ingestion runs silently. | Everything user-visible — same reason as Jira-only, compounded by the correlator not existing yet. |
| Zendesk + Jira | ✅ | ✅ | ❌ | Everything above, plus deterministic engineering-leg attribution wherever a Jira remote link points at the ticket. | Cases whose engineering work lives in Linear instead of Jira get no attribution. |
| Zendesk + Linear | ✅ | ❌ | ✅ | Full SLA tracking. Linear connects and backfills. | Engineering-leg attribution entirely — Linear correlator doesn't exist (roadmap step 15). |
| Jira + Linear | ❌ | ✅ | ✅ | Raw ingestion for both. | Everything user-visible — no Zendesk means no `Case`. |
| All three | ✅ | ✅ | ✅ | Same as Zendesk + Jira. | Linear's contribution, until step 15 ships. |

Precision on the different kinds of "access" this table collapses:

| Kind of access | Where it lives | Enforced by |
|---|---|---|
| **Platform access** | Whether an `Integration` row exists for that provider on the org (`packages/db/prisma/schema.prisma:48-60`). | Whether someone completed the OAuth connect flow. |
| **Project access** | Zendesk/Jira/Linear's own project- or space-level permission scheme. | The connecting user's account on that platform — see §5. |
| **Team access** | Linear's team membership model. | Linear itself; SBM never queries or stores it (no per-team filter anywhere in `packages/linear`). |
| **Issue-level access** | Per-issue restrictions (e.g. a Jira issue security scheme). | The connecting user's account, transparently to SBM — SBM will simply never see a `RawEvent` for an issue the connecting account can't read. |
| **Integration/service-account access** | N/A here — SBM has no service account; every request rides on the org's own single stored OAuth token per provider. | The original OAuth grant, refreshed via `tokenLifecycle.ts` in each package. |
| **Agent personal account access (in SBM)** | Whether a person is a signed-in `User` of the `Organization` (`packages/db/prisma/schema.prisma:35-46`). | `getServerSession`/`authOptions` (`apps/web/src/lib/auth.ts`) — no per-feature role check exists on top of this. |
| **Admin/configuration access** | Connecting, disconnecting, or re-triggering backfill for any provider. | Nothing beyond being a signed-in `User` — there is no separate "admin" tier in v1. |

---

## 5. Project-Level Access

**"The agent has access to the project" does not mean the same thing in any
two of these three systems, and SBM does not model project/team access at
all.**

| System | What "project access" means natively | Does SBM scope to it? |
|---|---|---|
| Zendesk | No first-class "project" concept for tickets — closest analogue is a Brand, Organization, or Group. Access is typically account-wide for an agent, refined by ticket views/group membership. | No — SBM's Zendesk OAuth grant covers the entire subdomain; `runZendeskBackfill` pulls all tickets/orgs/policies with no filter. |
| Jira | **Project** is first-class, with its own permission scheme (Browse Projects, etc.) layered under any OAuth scope (§3, Atlassian's own docs). | No — `runJiraBackfill` has no project filter; it ingests everything the connecting user's account (and the requested scope) can see across the whole site returned by `accessible-resources` (`packages/jira/src/oauth.ts:125-142`). |
| Linear | **Team** is first-class (roughly Jira's project equivalent); **Project** in Linear is a separate, thinner grouping *within* a team, closer to a Jira epic than to a Jira project. | No — `runLinearBackfill` has no team filter; it ingests every issue the OAuth grant's account can see workspace-wide. |

**Cross-system access does not carry over.** Having access to `Jira Project A`
gives an agent nothing in `Zendesk` and nothing in `Linear` — there is no
identity or permission bridge between the three platforms anywhere in this
codebase, and none exists nativel either (a Jira account and a Zendesk agent
account are unrelated identities unless a customer separately runs SSO across
both, which is outside all three products' own integrations). Equivalent-
sounding names (`"Project A"` in Jira, a like-named `"Team A"` in Linear) carry
**zero** implied permission relationship.

Entity mapping, to be explicit:

| Jira | Linear | Zendesk |
|---|---|---|
| Project | Team | *(no equivalent — closest is Brand/Group)* |
| Epic | Project | *(no equivalent)* |
| Issue | Issue | Ticket |
| *(no equivalent)* | Sub-issue | *(no equivalent)* |

Because SBM connects at the whole-subdomain/whole-site/whole-workspace level,
**the org-level question "is Zendesk/Jira/Linear connected at all" is the only
access question SBM's own architecture ever asks.** Finer-grained
project/team scoping is not a gap that needs "additional access" to close in
v1 — it structurally does not exist as a control point. If a customer wants
per-project data segregation, that would need to be built (see §9's
"excessive permissions" risk, which follows directly from this).

---

## 6. Integration vs User Permissions

**Integration permissions** (what the stored OAuth grant can technically call):
- Zendesk: `read` scope — GET endpoints for tickets, ticket audits, organizations, SLA policies, business-hours schedules.
- Jira: `read:jira-work` + `offline_access` — GET endpoints for issues, changelogs, remote links, statuses, plus refresh-token issuance.
- Linear: `read` (default scope, no refresh token — Linear tokens don't expire, per `packages/linear/src/oauth.ts:9-14`).

**Agent permissions** (what the human clicking "Connect" needed on the
provider side, and what any *other* SBM teammate can subsequently do):
- On the provider side: whatever Browse/Read permission that specific person's
  account holds — this silently caps the integration's effective reach
  regardless of the OAuth scope granted (§3).
- On the SBM side: **none** — every signed-in `User` of the organization can
  view dashboards, case detail, and the integrations settings page equally;
  there is no user-level restriction on who sees what SBM has ingested.

**The scenario the prompt specifically asks about:**

> Agent has no direct Jira access + the SBM/Jira integration has access = what can the agent actually do?

In SBM, the answer is unambiguous: **the agent can see everything SBM ingested
via the integration, through the SBM UI, with no way to reach Jira itself.**
The dashboard, case detail page, and CSV export are all populated from
`NormalizedEvent`/`Commitment`/`Evaluation` rows already computed server-side —
an SBM user without any Jira account of their own still sees engineering-leg
attribution, time-by-stage, and the case's linked-issue confidence, because
that data was fetched once by the integration's own OAuth grant and persisted.
**Integration-level access is fully substitutive for the viewing agent inside
SBM's own screens** — but it grants nothing outside them: the case detail
page's "link out to Jira" is a plain URL (`apps/web/src/app/cases/[caseId]/page.tsx`
builds it from the stored `siteUrl`/`subdomain` credentials, per roadmap step
10) that Jira's own login/permission wall still gates. Clicking it does not
carry any SBM-side authorization into Jira — the agent needs their own Jira
account and their own Browse Projects permission on that project to see the
issue after following the link.

---

## 7. Data Flow

### Zendesk

```text
Zendesk API
  │  tickets, ticket audits, organizations, SLA policies,
  │  business-hours schedules + holidays
  ▼
packages/zendesk (adapter) ──▶ RawEvent (immutable)
  ▼
packages/zendesk/normalize.ts ──▶ NormalizedEvent, Case, Customer
```

| | |
|---|---|
| Source | Zendesk REST API (`api/v2/tickets`, `/organizations`, `/business_hours/schedules`, etc.) |
| Destination | `RawEvent` then `NormalizedEvent`/`Case`/`Customer` |
| Trigger | 90-day backfill on connect, then 5-min active-set poll / 60-min sweep |
| API/Webhook | REST polling only — no webhook receiver exists |
| Auth | OAuth 2.0, `read` scope, access+refresh token (refresh only if the customer's OAuth client has token rotation enabled — `packages/zendesk/src/oauth.ts:41-45`) |
| Permission required | Connecting agent's own Zendesk role/permissions |
| Sync direction | One-way, Zendesk → SBM |
| Failure behavior | 401 on refresh → `ZendeskReauthRequiredError`, integration marked `reauthRequired`, never auto-deleted; UI surfaces a reconnect prompt (`ZendeskBackfillButton` `initialReauthRequired` prop) |

### Jira

```text
Jira Cloud REST API
  │  issues, changelog histories, remote links, global statuses
  ▼
packages/jira (adapter) ──▶ RawEvent (immutable)
  ▼
packages/jira/correlate.ts ──▶ CaseLink (against existing Zendesk Cases)
  ▼
packages/jira/normalize.ts ──▶ NormalizedEvent (engineering-leg events)
```

| | |
|---|---|
| Source | Jira Cloud REST API, resolved via `accessible-resources` to one site |
| Destination | `RawEvent` → `CaseLink` (correlation) → `NormalizedEvent` |
| Trigger | 90-day backfill, then poll/sweep cycles |
| API/Webhook | REST polling only |
| Auth | OAuth 2.0 (3LO), `read:jira-work offline_access` |
| Permission required | Connecting user's Jira project Browse permission caps what's ever fetched, independent of scope |
| Sync direction | One-way, Jira → SBM; correlation is SBM comparing Jira data against already-ingested Zendesk data, never the reverse |
| Failure behavior | Same reauth pattern as Zendesk (`JiraReauthRequiredError`); Atlassian rotates refresh tokens on almost every use, and SBM persists whatever comes back via compare-and-swap to survive concurrent refreshes across serverless instances (`packages/jira/src/tokenLifecycle.ts:38-51`) |

### Linear

```text
Linear GraphQL API
  │  issues, history entries (status transitions), attachments
  ▼
packages/linear (adapter) ──▶ RawEvent (immutable)
  ▼
[no correlator / normalizer yet — roadmap step 15]
```

| | |
|---|---|
| Source | Linear GraphQL API |
| Destination | `RawEvent` only, today |
| Trigger | 90-day backfill, then poll/sweep cycles |
| API/Webhook | REST/GraphQL polling only |
| Auth | OAuth 2.0, `read` scope, **no refresh token** — Linear tokens don't expire by design |
| Permission required | Connecting user's Linear workspace/team read access |
| Sync direction | One-way, Linear → SBM, terminating at `RawEvent` |
| Failure behavior | A 401 is unambiguous (no refresh token to fall back on) — immediately marks `reauthRequired` (`packages/linear/src/tokenLifecycle.ts:68-71`) |

---

## 8. Failure & Missing Integration Scenarios

### Jira is disconnected (integration row removed / reauth required and never resolved)

- Zendesk still works: fully — SLA tracking is independent of Jira.
- Linear still works: independently, to whatever limited extent it works today (ingestion only).
- Existing linked records: **`CaseLink` rows already created are not deleted.** Historical engineering-leg attribution and evaluations remain intact and reproducible (this is the entire point of the "store events, never store computed time" design — `plans/04-Architecture-Sketch.md:12-18`), because `Commitment` binds a specific `policyVersionId`/`calendarVersionId` at creation and never depends on the integration staying connected.
- New escalations: get no engineering leg from that point forward — they fall into `unknown`/unattributed until Jira is reconnected and correlation catches up.
- Synchronization: the poll/sweep cycles for that provider simply stop; per roadmap step 7, "a failing integration is recorded per organization rather than thrown, so one broken connection never stops the rest of the cycle" — Zendesk polling is unaffected.
- Agent experience: dashboard and case pages keep working; new cases just show unattributed engineering time; the integrations settings page shows the disconnected/reauth-required state.

### Linear is disconnected

Same shape as Jira, but with materially lower stakes today since Linear
contributes nothing to case timelines regardless of connection state (§3
Scenario E/C). Disconnecting Linear currently has **no observable effect** on
the product beyond halting `RawEvent` accumulation.

### Zendesk is disconnected

- This is the load-bearing integration. No new `Case` rows are created at all — `Case` only comes from Zendesk ticket ingestion.
- Existing cases and their `Commitment`/`Evaluation` history remain intact and viewable (same immutability guarantee as above).
- Jira/Linear polling can continue but `runJiraCorrelation` returns all-zero the moment there's no Zendesk `Integration` row to read a subdomain from (`packages/jira/src/correlate.ts:98-102`) — so reconnecting Jira/Linear without Zendesk produces nothing new either.
- Notifications: the worker still runs, but nothing new triggers a Slack alert, since new commitments require a new Case.

### Agent loses provider-side project access (not modeled as an SBM-tracked event)

SBM has no explicit detection for "the connecting user's permissions were
reduced but the OAuth token is still technically valid" — there is no
403-specific handling anywhere in the three `tokenLifecycle.ts` files (only
401/`invalid_grant` triggers `reauthRequired`). Practical consequence:

- Existing links: untouched, same immutability guarantee.
- New issue creation: N/A — SBM never creates issues.
- Issue visibility: a project the connecting account can no longer Browse
  simply stops appearing in subsequent Jira polls, **silently** — no error
  surfaces to the SBM user, no `reauthRequired` flag is set, because the API
  call likely still returns `200` with a narrower result set rather than an
  error. This is flagged as a real risk in §9.
- Comments: N/A — never ingested by any of the three adapters.
- Status updates: stop arriving for the now-invisible project's issues; any `Case` linked to one of those issues silently stops receiving engineering-leg updates, indistinguishable in the UI from "no new activity happened."
- Synchronization: continues normally for everything the account can still see; degrades invisibly for what it can't.

---

## 9. Security & Access Risks

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Whole-subdomain/whole-site/whole-workspace OAuth scope with no project/team filter (§5) | A single connecting user's OAuth grant exposes every ticket/issue in the entire Zendesk subdomain, Jira site, and Linear workspace to every SBM teammate, regardless of that teammate's own access on the underlying platform. | High (this is the default, unconditional behavior today, not an edge case) | Document clearly to customers pre-sale; consider a v2 project/team allowlist on the `Integration` row before any customer with strict internal data segregation onboards. |
| No SBM-side roles/permissions (§4, §6) | Any signed-in teammate can disconnect an integration, trigger a backfill, or view every case — including cases tied to customers/projects they'd have no access to natively. | High | Explicitly a documented v1 tradeoff (`implementation-plans/roadmap.md` step 1); revisit before selling into orgs with internal need-to-know boundaries. |
| Silent permission-mismatch drift (§8) | A connecting Jira/Zendesk user losing project access produces no error and no `reauthRequired` signal — engineering-leg data for that project quietly goes stale with no operator-visible symptom besides "nothing changed" on affected cases. | Medium | Add a 403-vs-401 distinction to each `tokenLifecycle.ts`, or a periodic scope/coverage audit that flags projects with zero new events despite the integration being healthy. |
| Single connecting-user identity per integration (Jira `accessible-resources` "assumes one Jira site... uses the first one returned" — `packages/jira/src/oauth.ts:147`) | If the person who connected Jira is later deactivated on the Atlassian side, the whole org's Jira ingestion dies with them — a single point of failure with no redundancy. | Medium | Recommend connecting via a dedicated, non-personal Jira/Zendesk account rather than an individual's; document this explicitly at onboarding. |
| `official_link` correlation method is defined but unimplemented (§2) | If sales/docs imply SBM reads Zendesk's own official Jira-link field, that's currently false — only Jira *remote links* are read. Overclaiming coverage risks the exact "fabricated 100%" failure Phase 15 explicitly designed against. | Low likelihood of silent wrong data (the counters are honest), but real risk of a documentation/marketing mismatch | Keep `official_link` as an explicit "not yet built" item in customer-facing coverage explanations until implemented. |
| Cross-tenant lookalike-domain link spoofing | `parseZendeskTicketId` guards against this by requiring an exact `{subdomain}.zendesk.com` hostname match (`packages/jira/src/correlate.ts:10-21`) — a link to a different tenant's Zendesk, or a similar-looking domain, is correctly rejected rather than correlated. | Low (already mitigated in code) | None needed — flagged here as a verified-safe control, not a gap. |
| Linear connection with zero functional effect (§3, §8) | A customer who connects Linear reasonably assumes engineering-leg tracking is active; it silently isn't until step 15 ships. | High if marketed before step 15 ships | UI already discloses "alternative... not a replacement" for Jira (`page.tsx:147-149`) but does not disclose that correlation is unbuilt — worth adding an explicit "ingestion only, attribution coming soon" badge. |
| Stale/orphaned integrations after org offboarding | An `Integration` row with valid, unexpired credentials (esp. Linear, whose tokens never expire) could keep polling a customer's Zendesk/Jira/Linear account after the commercial relationship ends, if the org isn't explicitly deprovisioned. | Low-Medium (operational hygiene issue, not a code defect) | Add an offboarding runbook step to explicitly disconnect/revoke all three OAuth grants, not just deactivate SBM users. |
| Zendesk OAuth client default scope, if misconfigured outside SBM's own code | Zendesk's platform-wide default (no scope specified) is full read **and write** access ([Zendesk dev docs](https://developer.zendesk.com/documentation/api-basics/authentication/viewing-oauth-tokens/)) — SBM's code explicitly always requests `read` (`packages/zendesk/src/oauth.ts:10`), but this depends on that constant never being changed. | Low | Keep the read-only scope as a reviewed, tested invariant (e.g. a unit test asserting the authorize-URL scope parameter), not just a comment. |

---

## 10. Recommended Access Model

**Agent (SBM end user) — minimum required:**
- One signed-in `User` account in the organization. No provider-side account is required to *view* SBM's dashboard or case detail — all data is pre-fetched by the integration's own grant (§6). A provider-side account is only needed to follow an outbound link into the actual Zendesk ticket or Jira issue.

**Integration account (the OAuth grant SBM stores) — minimum required:**
- Zendesk: `read` scope only — never request `write` (already the case; keep it enforced by test, not just convention).
- Jira: `read:jira-work` + `offline_access` only — never request `write:jira-work` or `manage:jira-project`. Connect using a dedicated non-personal Jira account with Browse access to every project the customer wants covered, to avoid the single-point-of-failure risk in §9.
- Linear: `read` scope only. Same dedicated-account recommendation, since Linear tokens don't expire and a personal account's departure has no natural token-invalidation trigger.

**Administrator (setup/configuration only) — permissions needed only transiently:**
- Enough Zendesk/Jira/Linear admin rights to create/authorize an OAuth client and complete the connect flow once. Per Atlassian's OAuth 2.0 docs, no ongoing admin role is required after the initial grant — subsequent access is governed by the connecting account's standing permissions, not an admin flag. Nothing in SBM's own data model requires re-elevating admin access after initial connect.

**Least-privilege gap to close before scaling to security-conscious customers:**
the whole-subdomain/whole-site/whole-workspace scope (§5, §9) is the biggest
deviation from least privilege in the current design, followed closely by the
complete absence of SBM-side roles (§4). Both are documented, intentional v1
scope cuts (`implementation-plans/roadmap.md`), not oversights — but they are
the first two things to revisit before onboarding a customer with strict
internal data-segregation requirements.

---

## 11. Final Decision Matrix

| Requirement | Zendesk Only | Jira Only | Linear Only | Zendesk + Jira | Zendesk + Linear | Jira + Linear | All |
|---|---:|---:|---:|---:|---:|---:|---:|
| Customer ticket handling (SLA tracking) | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Create engineering issue | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View engineering issue (link-out only) | ❌ | ❌ | ❌ | ✅ | ⚠️ (ingested, not linked) | ❌ | ✅ (Jira only) |
| Update engineering issue | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Track issue status (engineering leg) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ (via Jira only) |
| Sync comments | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cross-system workflow (case timeline spanning both) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |

Notes on the ❌ rows that might look surprising:
- **"Create/update engineering issue" is ❌ in every column, always** — SBM
  is read-only by design in every configuration; this is a deliberate,
  permanent product boundary (Phase 10's DO NOT BUILD list explicitly
  excludes "write-back/escalation actions" — `implementation-plans/roadmap.md:251`),
  not a gap to close.
- **"Sync comments" is ❌ everywhere** — none of the three adapters ingest
  comments today, independent of which systems are connected.

---

## 12. Evidence & Assumptions

**[SBM] claims** are backed by direct code citations throughout this document
(file path + line number) and are current as of this repository's `HEAD`
(`012b9d7`, branch `feature/linear-connect-ingest`). They will drift as the
roadmap progresses — in particular, everything in §3/§8/§11 describing Linear
as "ingestion only" is expected to change once roadmap step 15 ships.

**[Native] claims**, sourced from official documentation:

- Zendesk's official Jira app (linking, comment visibility in the Jira
  sidebar, Jira→Zendesk status push-back): [Using the Zendesk Support for Jira integration](https://support.zendesk.com/hc/en-us/articles/4408827996058-Using-the-Zendesk-Support-for-Jira-integration), [Jira integration resources](https://support.zendesk.com/hc/en-us/articles/4408845662746-Jira-integration-resources), [Synchronizing the status of Zendesk tickets with linked Jira issues](https://support.zendesk.com/hc/en-us/articles/10055291434394-Synchronizing-the-status-of-Zendesk-tickets-with-the-status-of-linked-issues-in-Jira) (this last article sits behind a Zendesk login wall — its title and the surrounding search index confirm status sync exists and is admin-configurable, but the exact field-level mapping is **tenant-specific configuration I could not directly verify** and should be confirmed against a live tenant before being stated as fact to a customer).
- Jira Cloud OAuth 2.0 (3LO) scopes, and permissions capping scope: [Jira platform scopes for OAuth 2.0 (3LO) and Forge apps](https://developer.atlassian.com/cloud/jira/platform/scopes-for-oauth-2-3LO-and-forge-apps/), [OAuth 2.0 (3LO) apps](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/).
- Zendesk OAuth scope defaults and granularity: [Zendesk API OAuth scopes guide](https://www.eesel.ai/blog/zendesk-api-oauth-scopes) (third-party summary of Zendesk's own behavior — flagged as such since it is not Zendesk's own doc, but the "default = full read+write if unscoped" claim is consistent with [Zendesk's own OAuth token docs](https://developer.zendesk.com/documentation/api-basics/authentication/viewing-oauth-tokens/)).
- Linear OAuth scopes (`read`, `write`, `issues:create`, `comments:create`, `admin`): [Linear Developers — OAuth 2.0 Authentication](https://linear.app/developers/oauth-2-0-authentication).
- Linear's Jira Importer vs. Jira Sync, team-level mapping, sync direction, and the Jira ADMINISTER-permission requirement: [Linear Docs — Jira](https://linear.app/docs/jira).

**Explicitly flagged as unverified or tenant-dependent:**
- The exact field(s) that trigger Zendesk↔Jira status push-back (ticket status vs. a custom field vs. an internal note) are admin-configured per Zendesk tenant and could not be confirmed beyond "it is configurable and documented to exist."
- Whether a given customer's Zendesk instance has the official Jira app installed at all is unknowable to SBM and was not assumed anywhere in this report — SBM's correlator works whether or not that app exists, because it only requires *a* Jira remote link, however it got there.
- No official Zendesk↔Linear integration was found in vendor documentation or Linear's own integrations directory; this report treats that as a confirmed absence based on the negative search result and general market knowledge, not a documentation citation of "this does not exist."
- Plan/tier gating (e.g., whether OAuth apps or granular scopes require a specific Zendesk/Jira/Linear plan) was not verified and should be checked against current pricing pages before being relied on for a specific customer's tenant.

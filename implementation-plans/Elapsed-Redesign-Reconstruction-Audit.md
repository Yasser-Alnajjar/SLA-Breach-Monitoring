# Elapsed Redesign — Reconstruction Audit (Dashboard, At-Risk, Cases, Case Detail)

> Scope: audits the **in-progress redesign work currently on `refactor/redesign`** (the modified files already sitting in the working tree) against the Stitch mockups in `apps/web/stitch_elapsed/`, treated as the target UI/UX contract per the product's data-mapping rule (existing data → derivable → aggregation needed → API gap → new capability). This is a reconstruction audit, not a styling audit: the question answered per screen is *"how far is the current implementation from actually being the Stitch screen?"*, not *"does it use the right colors?"*. No code was changed to produce this document.
>
> This audit stands independently of `Elapsed-Full-UI-Migration-Plan.md` (the pre-existing phase-by-phase plan) — it re-verifies that plan's claims against the actual current code rather than citing it as ground truth, and corrects it in a couple of places (noted inline). **Documentation drift note:** four Stitch reference directories cited by the migration plan and by this audit's own task briefs — `escalations_sla_dashboard/`, `deterministic_case_explorer/`, `deterministic_case_timeline/`, `mobile_incident_commander_active_runway/` — no longer exist in `apps/web/stitch_elapsed/` (confirmed by directory listing). Only `elapsed_dashboard/`, `cases/`, `elapsed_case_detail/`, and `at_risk_queue/` were available to audit against; findings below are based solely on those.

---

## Executive Summary

**Verdict, bluntly: none of the four screens are a reconstruction of the Stitch target yet. Three of the four (Dashboard, Cases List, Case Detail) are the pre-redesign product with a design-token/shell pass and a few new stat tiles layered on; only At-Risk has been substantially rebuilt around Stitch's actual component (`AtRiskCard`), and even it is missing roughly two-thirds of the information each Stitch card carries.** The one piece of groundwork that *is* genuinely done across all four screens is the color/token layer — `apps/web/src/styles/colors.css` has already been remapped to Stitch's dark-theme surface/semantic tokens and all four audits independently confirm this is not where the gap is. The gap is structural: wrong column sets, missing composite cells, missing live hero elements, and wrong KPI/tile definitions.

**Per-screen headline:**

| Screen | Status | One-line verdict |
|---|---|---|
| [Dashboard](#dashboard) | Lightly restyled | 3-tile KPI row (Stitch: 4), stacked full-width charts (Stitch: single 12-col row, one chart type wrong), generic sortable/paginated at-risk table (Stitch: fixed 8-col operational snapshot), entire "Aging Queue" card list and "30-Day Attribution Ledger" panel don't exist. |
| [At-Risk Queue](#at-risk-queue) | Rebuilt, incomplete | Already ported to a dedicated `AtRiskCard` component (correct move), but renders ~6 of ~20 data points Stitch's card shows — no severity, no dual-ID, no tier, no time-allocation bar, no locus breadcrumb, no action row. KPIs measure the wrong dimensions (status/leg-% vs. Stitch's runway-time-bands). One migration-plan risk (risk-tier grouping) is resolved by this audit: Stitch's DOM is a flat list, not grouped sections — no restructuring needed there. |
| [Cases (List)](#cases-list) | Old generic data-grid, reskinned | 10 flat scalar columns vs. Stitch's 7 composite columns (dual-key, correlation, live runway+progress bar, leg-allocation mini-bar). No live countdown anywhere in the table. Wrong 4 stat tiles (2 of Stitch's 4 need data the query doesn't fetch at all). |
| [Case Detail](#case-detail) | Closest to target, still missing the flagship element | The individual components (`CaseJourney`, `ActivityTimeline`, `CommitmentCard`) already model the right domain concepts and are the strongest reuse candidates of the four screens — but the page has no live hero runway countdown (Stitch's dominant visual), no arithmetic-reconciliation ledger, and `CaseJourney`/`LinkedRecords` are presentational supporting widgets today where Stitch makes them the flagship components. |

**The single highest-leverage backend gap, recurring in 3 of 4 screens:** a per-case **link-confidence / dual-ticket-ID** concept (Zendesk ⇄ Jira correlation, `CaseLink.confidence`) is already modeled in the database (`CaseLink`, `LinkConfidence` enum) and already used at case-detail scope, but is **never queried at list/dashboard/at-risk scope**. This one join, added to `getDashboardData`, `getAtRiskData`, and `getCaseListData`, unblocks: the Dashboard's "Total Escalated" footer split and Attribution Ledger, At-Risk's dual-ID pairing and "Linked: Certain" pill, and the Cases List's Linked/Unlinked stat tiles, dual-key column, and correlation column. This should be the first piece of shared backend work, before any of the four pages' presentation layers are rebuilt.

**Two confirmed genuine backend gaps (category 4), each blocking multiple screens, requiring real data-model work (not frontend-only):**
- **Engineering-side assignee / queue name.** `Case.assigneeName` is explicitly support-side only (schema doc comment). No Jira-side assignee or queue/team field exists anywhere. Blocks: Dashboard's Aging Queue "Assignee"/"Queue" fields, At-Risk's locus breadcrumb queue/assignee, Case Detail's "Engineering Queue (UNASSIGNED)" line.
- **Per-event observed-vs-inferred confidence.** Independently verified absent from `TimelineEventDetail` — confirms the pre-existing migration plan's flagged risk was correct. Recommend marking `ConfidenceIndicator` DESIGN ONLY / NOT IMPLEMENTED and excluding it from this phase, per the plan's own risk note, rather than fabricating a score.

**One migration-plan claim this audit corrects:** the plan's risk register (`Elapsed-Full-UI-Migration-Plan.md:265-287`) frames At-Risk's "risk-tier grouping" (Immediate Threat / Elevated Risk section headers) as an open structural-UX decision needing product sign-off. Reading `at_risk_queue/code.html` directly shows this is a non-issue: `#riskLedger` is a flat, ungrouped list of `<article>` cards with no section wrappers — "Immediate Threat" / "Elevated Risk" are KPI-tile captions summarizing counts, not a grouping scheme. The current flat-list `AtRiskView.tsx` rendering is already structurally correct here; no regrouping work is required.

**Nothing below invents production values.** Every data-contract classification follows the required 5-category rubric (existing / derivable / needs aggregation / backend gap / new capability), and every Stitch element that current data can't yet back is flagged as a gap to close, not a reason to drop the element from the reconstructed UI.

---

## Dashboard

### 1. Stitch structure

Source: `apps/web/stitch_elapsed/elapsed_dashboard/code.html` (998 lines) and `screen.png`.

**Shell (outside the page content, but part of the visual contract):**
- Fixed top header, `h-16`, `bg-surface-container-lowest/95` with backdrop blur: left cluster = logo/wordmark + "Continuous Support ↔ Engineering SLA Tracking" eyebrow, a vertical divider, then a "Sync Active (Zendesk • Jira)" pill with pulsing green dot; center = a `⌘K` search input (`hidden lg:block`); right cluster = "Last 30 Days (Fixed)" pill, a `#sla-alerts connected` pill, divider, and a user avatar badge ("MV" / "Marcus Vance" / "Owner").
- Fixed left sidebar, `w-64`, from `top-16` to bottom: "SLA OPERATIONS" section label, nav items (Dashboard active / At Risk / Cases / Settings) with `border-l-2 border-primary-container` active-state, and a footer block pinned to the bottom showing "Tracking Engine v2.14.0" and a "Zendesk ↔ Jira Deterministic" check-mark line.
- Main content is offset `pl-64 pt-16`, content column capped at `max-w-[1720px] mx-auto`, `px-gutter-desktop` (24px), vertical rhythm via `gap-space-lg` (2.5rem) between major blocks.

**Page content, top to bottom:**
1. **Operational status bar**: left side — "Deterministic Attribution • Production Cluster 01" eyebrow, then page title "Elapsed Operations Ledger" next to a "Fixed 30-Day Analysis Window" chip, then a line "Read-only sync active: Zendesk (Primary) • Jira Software (Primary) • Intercom (Beta)". Right side — two buttons: "Export Full CSV (30 Days)" and "Auto-Sync: 10s" (with a sync icon that spins on click).
2. **Anomaly/operational banner**: rounded-xl card, amber left accent bar, warning icon, "UNASSIGNED ENGINEERING QUEUE | CRIT_THRESHOLD_EXCEEDED" label, body text "**4 cases** currently in Engineering have exceeded their target resolution window without an engineer assigned. SLA clock is running.", a "View 4 At Risk Cases →" link (anchors to `#at-risk-table`) and a dismiss (×) button.
3. **4 KPI tiles** in a `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` row, each `rounded-xl bg-surface-container-low p-space-md shadow-md` with a decorative corner gradient blob, a label+icon row, a big `display-hero` (40px) number with a trend/qualifier, and a **footer strip** (separate background tone) with a secondary breakdown:
   - **Breached Cases**: 14, "↑2 vs prior 30d" (red), footer splits "4 First Response" / "10 Resolution".
   - **SLA Compliance Rate**: 92.4% (amber — below target), "Target: 95.0%", "-2.6% vs target", footer has a mini progress bar plus a one-line cause note "Resolution dip driven by handoff delays".
   - **Aging in Engineering**: 18 cases, footer shows "Avg Queue Wait: 4h 12m".
   - **Total Escalated**: 142 cross-team, footer splits "118 Linked — Certain" / "24 Unlinked".
4. **3 charts in a `lg:grid-cols-12` row**, side by side, not stacked:
   - **Breaches Over Time** (5/12 cols): inline SVG stacked bar chart, 15 two-day bins across the 30-day window, two series (Support = primary blue, Engineering = error/red) stacked per bar, x-axis labels "Day 1 / Day 10 / Day 20 / Day 30 (Today)".
   - **SLA Compliance Trend** (4/12 cols): inline SVG line+area chart with a dashed "95.0% Benchmark" reference line, an "Below Target" status pill, footer "97.2% Peak / Current: 92.4% / 89.1% Low".
   - **Breaches by Stage** (3/12 cols): donut chart with a center label "64% / ENG LEG", 3-row legend with colored dots.
5. **"At Risk Right Now" table** (`id="at-risk-table"`): pulsing amber dot, title + subtitle "Cases projected to breach within 2.5 hours under current allocation trajectory", "4 Active Escalations" count pill. **8 columns**: Priority (badge), Ticket Correlation (dual ID `#ZD-8921 ⇄ ENG-4102`), Customer (name + tier/segment subtext), SLA Target ("Resolution (4h Max)"), Health Status (badge "AT RISK"), Leg Time Allocation (two-color mini distribution bar + text), Time Remaining (right-aligned, colored), Inspect ("Open Trace" button). 4 rows, **no pagination, no sort/filter UI, no search box.**
6. **Bento split section**, `xl:grid-cols-12`:
   - **Aging in Engineering Queue** (8/12 cols): divided list of 4 items, each with an icon tile, dual ticket ID + a "Linked — Certain: Official Jira link" badge, a "Queue: &lt;team&gt; • Assignee: &lt;name or 'Unassigned (Triaged/Backlog)' in red&gt;" line, and on the right an "ENG LEG ELAPSED" mono duration plus a "Ping Team" button.
   - **"30-Day Attribution Ledger"** (4/12 cols): 3 rows of colored-swatch + label + mono value ("Total Support Leg Hours 412.5 hrs", "Total Engineering Leg Hours 1,280.2 hrs", "Waiting on Customer/Vendor 189.4 hrs"); a "Linking Precision" progress bar (83.1% Certain) + "118 Direct ID Matches / 24 Unlinked / Standalone" line; footer "Audit Timestamped / UTC 14:02:18".

Density/spacing: consistent `space-md`/`space-lg` rhythm, `rounded-xl` cards, `shadow-md` on every panel, monospace (JetBrains Mono) pervasive for every numeric/ID/timestamp, label-caps for eyebrow/badge text, hairline dividers between header/body/footer. **No pagination, no client-side sort/filter chrome anywhere on this screen** — a fixed, read-optimized 30-day snapshot.

### 2. Current implementation structure

Source: `apps/web/modules/dashboard/dashboard/ssr/Dashboard.tsx`, `csr/DashboardView.tsx`, `csr/columns.tsx`, `csr/AtRiskList.tsx`, `csr/OtherCasesList.tsx`, `csr/analytics/*.tsx`.

- `Dashboard.tsx` (ssr) fetches `Actions.Dashboard.getData()` + `Actions.WorkerSettings.getData()`, renders `DashboardView` plus `SlaAutoRefreshProvider`. No sidebar/header composition here — that lives in `apps/web/src/app/(main)/layout.tsx`, which renders `AppSidebar` + a 52px sticky header with just a `SidebarTrigger` + `UserMenu` (no search box, no sync-status pill, no `#sla-alerts` chip, no "Last 30 Days" chip).
- `DashboardView.tsx` renders, top to bottom:
  1. `PageHeader`: eyebrow `"Deterministic Attribution · Last {periodDays} Days"`, title `"Dashboard"`, single "Export CSV" button. No "Elapsed Operations Ledger" framing, no cluster label, no "Fixed 30-Day" chip, no read-only sync source line.
  2. A cycle-time-anomaly banner (`if data.cycleTimeAnomalies.length > 0`) — visually similar in spirit (amber accent bar, warning icon, dismiss button) but **different domain content**: per-customer statistical cycle-time anomalies, not "N cases in Engineering exceeded resolution window, unassigned."
  3. **3 KPI tiles** (`StatTile`) in `grid-cols-1 sm:grid-cols-3`: "Breached · {N}d", "Compliance · {N}d", "Aging in engineering". **No 4th tile** — "Total Escalated" doesn't exist here at all.
  4. `ProjectAnalyticsSection` → `BreachesOverTimeChart` (single undifferentiated line, no Support/Eng split) stacked **above** a `lg:grid-cols-2` row of `SlaComplianceChart` (donut) and `BreachesByStageChart` (horizontal bar). All full-width stacked, not one 12-col row.
  5. "Operational Attention" section: `lg:grid-cols-3` — `AtRiskList` (a full `DataTable` with sorting, global search, CSV export, refresh, pagination) spanning 2 cols, next to a stacked pair of small cards: "Breached cases" (dialog-trigger summary) and "Aging in engineering" (a plain `<ul>` list).
- `columns.tsx` defines 9 columns for `AtRiskList` and an unused second 6-column set (`useOtherCasesColumns`).
- `OtherCasesList.tsx` exists and is fully built (search, CSV export, refresh) but is **never imported anywhere** — confirmed dead code.
- The table/list interaction model (query-param-driven pagination, `getSortedRowModel`, `getFilteredRowModel`) is generic/reusable, built for arbitrary tabular data — not for Stitch's fixed "top N, no pagination" read-only snapshot.

### 3. Major structural mismatches

The design-token layer (`colors.css`) has already been fully re-mapped to Stitch's dark-theme values — this is not "lightly restyled" in the color sense. But **page composition is a different product surface almost everywhere below the KPI row**:

- **Full rebuild, not a tweak:**
  - 4-tile KPI row with footer breakdowns doesn't exist; current has 3 tiles, missing "Total Escalated / Linked vs Unlinked" entirely.
  - 3-chart row is a different layout (stacked full-width vs. single 12-col 5/4/3 split); Breaches-Over-Time is missing its Support/Engineering stacked-series split.
  - "At Risk Right Now" table is a generic sortable/paginated/searchable `DataTable` with 9 free-form columns vs. Stitch's fixed 8-column read-only snapshot with priority badge, dual Zendesk⇄Jira correlation column, customer-tier subtext, SLA-target-with-max column, leg-distribution-bar column, and "Open Trace" button. None of these column treatments exist today.
  - "Aging in Engineering Queue" is currently a bare `<ul>` of one-line rows; Stitch's version is a rich card list with icon tiles, a link-confidence badge, queue/assignee line, and a "Ping Team" button.
  - "30-Day Attribution Ledger" panel does not exist in any form.
  - The operational status bar's ledger framing does not exist; current `PageHeader` is a generic eyebrow+title+one-button component shared across all pages.
  - Header/sidebar shell (search bar, sync-status pills, `#sla-alerts` chip, period chip, tracking-engine footer) is entirely absent from `(main)/layout.tsx` — shared-shell work, out of this page's files, but it caps how close the Dashboard can ever look since Stitch's chrome is inseparable from the screenshot.
- **Minor/tweak-level:**
  - `SlaComplianceChart` (donut) is structurally analogous to Stitch's "Breaches by Stage" donut *shape* — needs restyling, not re-architecture.
  - `BreachesByStageChart` (horizontal bar) is a chart-type mismatch (Stitch uses a donut for this metric) worth flagging even though it's "just a chart."
- Be blunt: the KPI row and analytics section are recognizably descendants of the same data, but "At Risk," "Aging in Engineering," and the operational-banner/attribution-ledger framing are not present in a form patching gets close to — build those against the Stitch DOM directly.

### 4. Data-contract mapping

| Stitch element | Domain meaning | Current data source | Category |
|---|---|---|---|
| Header "Sync Active (Zendesk • Jira)" pill | Integration connection health | Not in `dashboard.ts`/`dashboard-data.ts`; would come from integration/connector config | 3 |
| Header "#sla-alerts connected" | Slack/notification channel binding | No such concept in dashboard data layer | 4 |
| Header `⌘K` search | Global omnibar search | Not part of `getDashboardData`; separate feature | 5 |
| "Last 30 Days (Fixed)" header chip | Reporting window label | `DashboardData.periodDays` (`PERIOD_DAYS = 30`) | 1 |
| "Elapsed Operations Ledger" / "Production Cluster 01" | Page branding/tenant label | No org/cluster name field returned | 4 |
| "Read-only sync active: Zendesk (Primary) • Jira (Primary) • Intercom (Beta)" | Per-source integration status | Not fetched by dashboard data layer | 3 |
| "Export Full CSV (30 Days)" | CSV export of the 30-day dataset | Already links to `/api/reports/commitments` | 1 |
| "Auto-Sync: 10s" | Worker poll-interval display | `Actions.WorkerSettings.getData()` → `activePollIntervalMs`, already fetched and drives `SlaAutoRefreshProvider` | 1 |
| Anomaly banner "4 cases in Engineering exceeded resolution window, unassigned" | Unassigned-engineer SLA risk count | `AgingEscalationRow`/`AtRiskRow` have no assignee field at all | 3 |
| KPI "Breached Cases" count + "↑2 vs prior 30d" | Breach count vs. prior period | Count exists (`data.breachedThisPeriod.length`); no prior-period breach-count trend anywhere | 1 for count; 3 for trend |
| KPI "Breached Cases" footer split (First Response vs Resolution) | Breach count by commitment kind | Already computed (`breachedByKind`, `DashboardView.tsx:51-56`) | 1 |
| KPI "SLA Compliance Rate" % + "Target: 95.0%" | Current compliance vs. configured target | `data.compliance.current` exists; no compliance **target** field anywhere | 1 for current; 4 for target |
| KPI compliance footer note "Resolution dip driven by handoff delays" | Free-text root-cause annotation | No such field | 5 |
| KPI "Aging in Engineering" + "Avg Queue Wait: 4h 12m" | Count + avg time before engineering pickup | Count exists; "queue wait before pickup" is a different metric than `minutesInCurrentLeg` (currently used as a proxy) | 2 for count; 3 for true queue-wait metric |
| KPI "Total Escalated" cross-team count | Total commitments ever touching engineering, in period | Not aggregated anywhere — `agingInEngineering` only covers currently-open cases | 3 |
| KPI "Total Escalated" footer "118 Linked — Certain / 24 Unlinked" | Ticket-correlation confidence | No link-confidence field surfaced to dashboard | 3/4 |
| "Breaches Over Time" Support/Eng stacked series | Daily breach count split by leg-at-breach-time | `BreachesOverTimePoint` only has `{date, count}`; leg-at-breach is already computed elsewhere (`legAtTime`) but discarded by day-bucketing | 3 |
| "SLA Compliance Trend" line + benchmark + peak/current/low | Compliance % over time | Only `{current, previous}` exists — no time series | 3 |
| "Breaches by Stage" donut | Breach count by leg | `ProjectAnalyticsData.breachesByStage` already computed exactly this | 1 |
| At-Risk table — Priority badge | Ticket priority tier | No priority field on `AtRiskRow` | 4 |
| At-Risk table — Ticket Correlation (dual ID) | Zendesk + linked Jira ID | `AtRiskRow.externalId` exists (Zendesk); no linked Jira ID field | 3 |
| At-Risk table — Customer tier/segment | Account tier | No tier field on `AtRiskRow` | 4 |
| At-Risk table — SLA Target ("Resolution (4h Max)") | Commitment kind + target minutes | `kind` exists; target minutes available at query time via `policyVersion.targets` but not returned | 2 |
| At-Risk table — Health Status badge | Commitment status | `AtRiskRow.status` exists, already rendered | 1 |
| At-Risk table — Leg Time Allocation bar | Per-leg elapsed split | Only current-leg time exists; `sumLegMinutes` already exists as a primitive but isn't called per leg here | 3 |
| At-Risk table — Time Remaining | `remainingMinutes` | Already exists/rendered | 1 |
| At-Risk table — "Open Trace" | Deep link to case detail | `caseCommitmentHref` already exists and used elsewhere | 1 |
| Aging Queue — link-confidence badge | Correlation confidence | Same gap as above | 3/4 |
| Aging Queue — "Queue: Core Platform / Storage" | Jira team/queue name | Not on `AgingEscalationRow` | 4 |
| Aging Queue — "Assignee: … / Unassigned" | Engineering assignee | Not on `AgingEscalationRow` | 3/4 |
| Aging Queue — "Eng Leg Elapsed" | Time in engineering leg | `AgingEscalationRow.minutesInCurrentLeg` exists exactly | 1 |
| Aging Queue — "Ping Team" button | Notify/escalate action | No write-back/notification action exists | 5 |
| Attribution Ledger — Support/Eng/Waiting hour totals | Sum of leg minutes across period | `sumLegMinutes` exists per-case but no org-wide period-scoped sum | 3 |
| Attribution Ledger — "Linking Precision 83.1%" | Org-wide correlation confidence rate | Same root gap as above, aggregated | 3/4 |
| Attribution Ledger — "Audit Timestamped / UTC" | Last-sync/audit timestamp | `DashboardData.asOf` exists | 1 |

### 5. Missing data/API requirements

**Category 3 (new aggregate within existing domain model — do these first):**
- Breach-count trend vs. prior 30 days (diff two period counts).
- Leg-split daily breach bucketing for "Breaches Over Time" (extend `bucketBreachesByDay` using the already-available `legAtTime(spans, breachedAt)`).
- Compliance time-series aggregate (new, doesn't exist in any form).
- True "Avg Queue Wait" metric (derivable from `LegSpan` start times, distinct from `minutesInCurrentLeg`).
- Per-leg time allocation on `AtRiskRow` (call `sumLegMinutes` per leg, attach to row).
- "Total Escalated" cross-team aggregate (cases whose leg history ever includes engineering within the period).
- Org-wide period-scoped leg-hour totals for the Attribution Ledger.
- SLA target minutes on `AtRiskRow` (already available via `policyVersion.targets`, just needs including).
- Per-source (Zendesk/Jira/Intercom) sync-status line — needs checking the integrations/settings module for an existing status source.

**Category 4 (field/concept doesn't exist in current data model):**
- SLA compliance **target percentage** — no org-level setting exists (compare to the existing precedent, `engineeringLegTargetMinutes`).
- Ticket **priority** tier.
- Customer **account tier/segment**.
- Jira **team/queue name**.
- Engineering **assignee** name.
- Zendesk↔Jira **link-confidence** classification — underlies four separate Stitch elements (Ticket Correlation column, Aging Queue badge, Total Escalated footer, Attribution Ledger). **Single highest-value data-model addition** — see Executive Summary.
- Organization/cluster display name and ledger-framing text.
- `#sla-alerts` Slack-channel connection status.

**Category 5 (genuinely new product capability):**
- Free-text/derived root-cause annotation on the compliance tile.
- "Ping Team" write-back notification/escalation action.
- Global `⌘K` omnibar search.

None of the above are grounds to drop the corresponding Stitch element — build them (or explicitly and visibly defer them), don't silently omit.

### 6. Components that should be rebuilt rather than modified

- **`DashboardView.tsx`** — page composition doesn't match Stitch's structure at almost any level below "has KPIs, has charts, has tables." Threading in a 4th tile, restructuring the chart grid, and replacing two entirely different sub-sections amounts to a rewrite. Rebuild against the Stitch DOM directly.
- **`AtRiskList.tsx` / `columns.tsx`** (`useAtRiskColumns`) — built on the generic paginated/sortable/searchable `DataTable` with 9 loosely-related columns; Stitch's table is fixed, unpaginated, unsorted, with a fundamentally different column set. Rebuild as a purpose-built table component.
- **`page-header.tsx` as used for Dashboard** — Stitch's status bar carries far more than eyebrow+title+action; either extend with a dashboard-specific variant or compose a dedicated status bar for this page.
- **The "Aging in Engineering" `<ul>` block** — needs to become a structured card list (icon tile, badge, metadata line, action button) — a new component, not a style pass.
- **A new "30-Day Attribution Ledger" component** — nothing today plays this role; must be built from scratch.
- **`BreachesByStageChart.tsx`** — chart-type mismatch (bar vs. donut); pragmatically, rebuild using `SlaComplianceChart`'s existing donut pattern rather than reskin the bar chart.

### 7. Components that can genuinely be reused

- **`colors.css`** — already fully re-mapped to the Stitch dark-theme palette (surface-container ladder, semantic colors, leg tokens). The one piece of groundwork genuinely done.
- **`caseCommitmentHref`** and **`formatMinutes`/`formatCommitmentKind`/`formatLeg`** (`@/lib/format.ts`) — correct, tested domain-formatting helpers, reuse as-is.
- **`SlaComplianceChart.tsx`**'s donut-rendering approach — right shape for both existing SLA Compliance and (per §6) as the pattern to imitate for a rebuilt Breaches-by-Stage donut.
- **`BreachesOverTimeChart.tsx`**'s data-shape/empty-state scaffolding — reusable wrapper even though the series/chart-type needs upgrading.
- **`getDashboardData`/`getProjectAnalytics`** — the core computation engine (`deriveLegSpans`, `evaluateCommitment`, `sumLegMinutes`, `findBreachesInPeriod`, `summarizeCompliance`) is sound and already produces most needed primitives; mostly needs its outputs *extended*, not replaced.
- **`StatusBadge`** — compatible with extending for the priority-badge and link-confidence-badge use cases.

### 8. Required reconstruction work

1. Data-layer extensions first (unblocks everything downstream): link-confidence classification; priority, tier, Jira team/queue, assignee fields; SLA-target-minutes on `AtRiskRow`; per-leg time allocation; org-level compliance target; prior-period breach count; compliance time-series aggregate; org-wide leg-hour totals; total-escalated aggregate; leg-split daily breach bucketing.
2. Shell work (outside this page's files, required for parity): header search input, sync-status pill, notification-channel chip, period chip; sidebar footer status block.
3. Rebuild the operational status bar for this route specifically.
4. Rebuild the anomaly banner content to match Stitch's framing (or keep the cycle-time-anomaly banner as a *second*, additional banner type).
5. Rebuild the KPI row as 4 tiles with footer-strip sub-metrics.
6. Rebuild the chart row as a single 12-col (5/4/3) row: stacked-series bar, benchmark-line trend chart (new), donut for breaches-by-stage.
7. Rebuild "At Risk Right Now" as a fixed, unpaginated, 8-column table.
8. Rebuild the Aging-in-Engineering list as a rich card-list component.
9. Build the "30-Day Attribution Ledger" panel from scratch.
10. Delete or repurpose dead code (`OtherCasesList.tsx`, `useOtherCasesColumns`).
11. Decide "Ping Team" and `⌘K` search scope with the team before building.
12. Re-theme all rebuilt/kept components to label-caps/mono-metric typography, `rounded-xl`/`shadow-md`, `space-md`/`space-lg` rhythm consistently.

### 9. Acceptance checklist for visual parity

- [ ] Header shows logo/eyebrow, sync-status pill, `⌘K` search, period chip, alerts-channel chip, user identity.
- [ ] Sidebar shows active-state nav + tracking-engine footer block.
- [ ] Status bar shows ledger title, cluster label, multi-source sync line, Export + Auto-Sync buttons.
- [ ] Anomaly banner: amber-accent card, unassigned-engineering framing, working dismiss + anchor link.
- [ ] Exactly 4 KPI tiles, responsive 1/2/4-col grid, each with a distinct footer sub-metric strip.
- [ ] Chart row is one 12-col row (5/4/3): stacked-series bar, benchmark-line trend w/ peak/current/low, donut (not bar) for breaches-by-stage.
- [ ] "At Risk Right Now": 8 columns exact order, no pagination/sort/search chrome, priority badge, dual-ID, tier subtext, leg-distribution bar.
- [ ] Aging-in-Engineering: icon tiles, link-confidence badges, queue/assignee metadata, "Ping Team" button, "Top N" label.
- [ ] "30-Day Attribution Ledger" exists with leg-hour totals, linking-precision bar, audit timestamp.
- [ ] All numeric/duration/ID values in tabular monospace; all eyebrow/badge text in label-caps.
- [ ] Card surfaces `rounded-xl`/`shadow-md`, consistent spacing, hairline dividers — no leftover shadcn defaults.
- [ ] Dark-mode colors spot-check against `screen.png`.

---

## At-Risk Queue

### 1. Stitch structure

Source: `apps/web/stitch_elapsed/at_risk_queue/code.html` (570 lines) + `screen.png`.

**Shell** (shared across "Elapsed" pages): fixed `h-16` header (logo, sync-status pill, `#sla-alerts connected`, search, user identity) and fixed `w-64` sidebar (nav with At Risk badge "4", bottom "DAEMON v2.14.0" footer).

**Page body**, a single column inside `px-gutter-desktop py-space-lg`:

1. **Header row**: `h1` "At Risk", pulsing-dot badge "4 Active At-Risk Cases", a "Live Clock Daemon: Continuous (Deterministic)" badge, description paragraph. Right: "Export Incident List" + "Sync Pulse (Auto 5s)" buttons.
2. **KPI matrix**, 4 tiles (`md:grid-cols-2 xl:grid-cols-4`), each with an `absolute left-0 w-1` severity-coded color bar, label-caps header, big mono value + qualifier, truncated detail line:
   - **Immediate Threat (&lt; 1h Runway)**: "2 Cases" / "Critical Threshold" / names+ticket IDs.
   - **Elevated Risk (1h – 2.5h)**: "2 Cases" / "Approaching" / names+IDs.
   - **Active Clock Locus**: "75% Eng Leg" / "3 of 4 Cases" / "Clock burning inside Jira queues without resolution".
   - **Avg Transit Latency**: "2h 14m" / "+18m vs baseline" / "Unassigned in Eng triage backlogs".
3. **Filter toolbar**: "Severity" segmented buttons (All (4)/P1 Critical (2)/P2 High (2)), divider, "Locus" segmented buttons (All (4)/Engineering Leg (3)/Support Leg (1)). Right: "Linked: Certain (4/4)" informational pill + search input.
4. **Case ledger** (`id="riskLedger"`): **a flat list of 4 `<article class="case-card">` elements — no wrapper sections, no "Immediate Threat"/"Elevated Risk" group headers in the DOM**, and not strictly sorted by remaining time either. Each card:
   - **ID/headline row**: colored `w-2` accent bar, severity badge (P1 CRITICAL/P2 HIGH), Zendesk id ↔ Jira id, tier/contract label, `h2` "Customer — Subject".
   - **Countdown panel**: pulsing-dot status label, big `HH:MM:SS` digits (client-decremented from a `data-seconds` attribute), "Ceiling: Xh Ym … SLA Target" caption.
   - **Time Allocation panel**: "Time Allocation: Elapsed Xh Ym Zs of Xh Target (XX.X% Expended)" + inline "Support Leg: Xm (XX%) · Eng Leg: Xh Ym (XX%) · Runway: Xm Ys"; a **tri-segment proportional bar**; a "Locus" breadcrumb (leg + system + issue id + queue/backlog name + assignee state); a "Target ID: SLA_P1_EU_PROD"-style string right-aligned.
   - **Remediation row**: "Assignee: Support (Name) ↔ Engineering (Name/None Assigned/Handoff Pending)"; 2 context-specific action buttons + a primary "Inspect Timeline →" CTA.
5. **Bottom guardrail drawer**: icon + "Why does this SLA number say what it says?" heading + explanatory paragraph; right side "Engine: RFC-822 / UTC Strict" + "View Clock Audit Schema" button.
6. **Inline `<script>`**: purely client-side decoration — per-second countdown decrement from a static seed, button-active-state filtering, substring search filtering, a fake "Done" flash on action-button click. None of it is real; there is no backend call behind any button.

**Mobile reference:** does not exist in this repo (`mobile_incident_commander_active_runway/` is absent). No dedicated Stitch mobile mockup for this page.

### 2. Current implementation structure

Files: `ssr/AtRisk.tsx`, `csr/AtRiskView.tsx`, `csr/AtRiskCard.tsx`, `csr/CountdownClock.tsx`.

1. **`AtRisk.tsx`** (SSR): fetches `Actions.AtRisk.getData()` + worker settings, renders `AtRiskView` + `SlaAutoRefreshProvider` — a genuine live-refresh mechanism, not decorative (unlike Stitch's fake spinning-icon button).
2. **`AtRiskView.tsx`**:
   - `PageHeader`: eyebrow "Continuous, deterministic SLA clocks", title "At Risk" + count badge, actions = "Export CSV" (real, `Utils.exportToCsv`) + "Refresh" (`router.refresh()`).
   - 4 `StatTile`s: **Breached** count, **At risk** count, **Engineering leg** % (`engineeringCount/data.length`), **Avg time in leg**. Uses the shared generic shadcn-style `Card`, not Stitch's flat left-accent-bar tile.
   - Filter bar: a **Status** chip group (All/Breached/At risk/On track) and a **Leg** chip group (All/Support/Engineering/Waiting on customer), plus search on customerName/requesterName/subject/externalId.
   - Row list: maps filtered rows to `<AtRiskCard>`, `Reveal` stagger animation, `EmptyState` for zero-data/zero-filtered.
   - Footer info box: one paragraph on continuous/business-calendar runway computation — a lighter analog of Stitch's guardrail drawer.
3. **`AtRiskCard.tsx`**: `border`+`shadow-panel` rounded-xl card, `absolute left-0 w-1` status-color edge. Renders: `StatusBadge`, a single ticket-id link, commitment kind label, customer/subject headline, requester line, right-side countdown block (`CountdownClock`), footer row (leg dot + "Currently in X leg · Ym in leg" + "Inspect timeline →"). **No severity badge, no dual ticket-id pairing, no tier label, no ceiling/target caption, no time-allocation bar, no per-leg breakdown, no locus breadcrumb, no Target ID, no assignee line, no action buttons.**
4. **`CountdownClock.tsx`**: resyncs from `remainingMinutes` on every server refresh, ticks locally once a second, renders "X over" when negative — functionally sound and arguably more correct than Stitch's client-seeded fake countdown.
5. **Dead code**: `at-risk/csr/AtRiskList.tsx` and `csr/columns.tsx` are not imported anywhere (`AtRiskView.tsx` imports `AtRiskCard`). A separate, live `AtRiskList`/`columns` pair exists under `dashboard/dashboard/csr/` for the `/dashboard` route — different files, different route.
6. **`stat-tile.tsx`/`page-header.tsx`**: shared generic primitives, not tailored to Stitch's flat/monospace look.

### 3. Major structural mismatches

- **KPI tiles measure different things entirely.** Current: Breached / At-risk / Eng-leg% / Avg-time-in-leg (status-bucket-driven). Stitch: Immediate-Threat(&lt;1h) / Elevated-Risk(1-2.5h) / Active-Clock-Locus / Avg-Transit-Latency (runway-time-band-driven). Rebuild the KPI derivation logic, not a restyle.
- **Filter dimensions don't match.** Current filters by `CommitmentStatus` + `Leg`. Stitch filters by ticket **Severity** (`Case.priority` — a field the current query doesn't select) + **Locus** (engineering/support only), plus a non-filterable "Linked: Certain" pill current has no equivalent of.
- **`AtRiskCard.tsx` renders roughly 6 of ~20 distinct data points Stitch's card shows.** Missing: severity badge, dual Zendesk↔Jira id pairing, tier label, target/ceiling caption, the entire Time-Allocation widget (elapsed-of-target + tri-segment bar + per-leg breakdown), the Locus breadcrumb, Target ID, the assignee pairing line, and the action-buttons row. Full rebuild, not a restyle.
- **No time-allocation/tri-segment progress bar exists anywhere in the current codebase** for this page — most of its inputs are already computed or one function-call away (see §4).
- **Independent correction of the migration plan's flagged risk:** reading `code.html` directly shows `#riskLedger` is a flat, ungrouped list — "Immediate Threat"/"Elevated Risk" are KPI-tile captions, not section headers. The current flat-list rendering (`AtRiskView.tsx`) is **already structurally correct** here — no grouped-section rebuild required, contrary to what the migration plan's risk register implies.
- **Visual/density language is a different design system, not just different colors.** Stitch: flat single-surface blocks, small radius, JetBrains Mono for every numeric/id token, label-caps micro-typography, thin colored left-edge accent bars. Current: shadcn `Card` with `border`+`shadow-panel`+`rounded-xl`, sans-serif metrics (except `CountdownClock`, already `font-mono`). Color-token swaps alone won't close this — requires rebuilding the card/tile markup.
- **Dead files should be deleted, not modified.**

### 4. Data-contract mapping

| Stitch element | Domain meaning | Current data source | Category |
|---|---|---|---|
| "4 Active At-Risk Cases" badge | Count of open at-risk/breached commitments | `data.length` | 1 |
| "Live Clock Daemon: Continuous (Deterministic)" | Marketing/system-status copy | Static copy | 1 |
| Export Incident List | CSV export of visible rows | Already real (`Utils.exportToCsv`) | 1 |
| Sync Pulse (Auto 5s) | Manual + auto refresh | Real, via `SlaAutoRefreshProvider` — current impl functionally *ahead* of Stitch's decorative click-spin | 1 |
| KPI 1: Immediate Threat (&lt;1h) count + names | Rows with `remainingMinutes < 60` | `AtRiskRowData.remainingMinutes`/`.customerName`/`.externalId` | 2 |
| KPI 2: Elevated Risk (1h–2.5h) count + names | Rows with `60 ≤ remainingMinutes < 150` | same fields | 2 |
| KPI 3: Active Clock Locus (75% Eng Leg, 3 of 4) | % of rows currently in engineering leg | Already computed as `engineeringCount` | 1 |
| KPI 4: Avg Transit Latency (base figure) | Mean time in current leg | Already computed as `avgMinutesInLeg` | 1 |
| KPI 4: "+18m vs baseline" | Historical baseline comparison | No baseline/trend concept anywhere | 4 |
| KPI 4 caption "Unassigned in Eng triage backlogs" | Unassigned-in-queue time specifically | No assignee concept on the engineering side | 4 |
| Severity chips + card severity badge | Ticket priority | `Case.priority` exists in schema, joined via `case` but never selected into `AtRiskRow` | 1 |
| Locus chips | Current leg | `currentLeg`, already filtered on | 1 |
| "Linked: Certain (4/4)" pill | Fraction of cases with `CaseLink.confidence: certain` | `CaseLink` model exists but is never queried in `getAtRiskData` | 3 |
| Search input | Filter by customer/ticket/subject | Already implemented, broader than Stitch's | 1 |
| Dual ticket-id pairing | Zendesk id (existing) + linked Jira issue id | Zendesk: `externalId`. Jira: `CaseLink.externalId` where `system: jira` — not queried | 3 |
| Tier label | Customer/case contract tier | `Case.tier`/`Customer.tier` both exist in schema, neither selected | 1 |
| Case headline | — | Already implemented | 1 |
| Countdown status microcopy | Cosmetic label keyed off status/urgency band | Derivable | 2 |
| Countdown big digits | Live remaining time | Already implemented (arguably more correct than Stitch) | 1 |
| "Ceiling: Xh Ym … SLA Target" | `Commitment.targetMinutes` | On the row already fetched in the loop but never propagated into `AtRiskRow` | 1 |
| Time Allocation line (elapsed of target, % expended) | `elapsedWorkingMinutes`/`elapsedSeconds` vs. target | `evaluateCommitment` already computes this; `at-risk-data.ts` only reads `.remainingMinutes`/`.status`, discarding the rest | 1 |
| Support/Eng leg elapsed breakdown + % | Cumulative minutes per leg | `sumLegMinutes(spans, leg, asOf)` already exported; spans already fetched, only used to find the current span, never summed per leg | 2 |
| Tri-segment progress bar | Pure UI derived | Derivable once the two leg sums + target exist | 2 |
| Locus breadcrumb — leg name | — | `currentLeg` | 1 |
| Locus breadcrumb — Jira issue id | — | `CaseLink.externalId`, not queried | 3 |
| Locus breadcrumb — queue/backlog name | Jira project/board name | No field anywhere — `CaseLink` has no project/queue column | 4 |
| Locus breadcrumb — engineering assignee / "Unassigned (Xh Ym in Queue)" | Jira-side assignee + assignment-state duration | `Case.assigneeName` is explicitly support-side only (doc comment); no engineering-side equivalent, no assignment-state history | 4 |
| "Target ID: SLA_P1_EU_PROD" | Synthetic per-target-kind policy slug | No matching field — policy has name/externalId at policy level only | 4 |
| Assignee pairing — Support side | — | `Case.assigneeName` exists, not selected | 1 |
| Assignee pairing — Engineering side | — | Same gap as locus-breadcrumb assignee | 4 |
| Action buttons (Ping #sla-alerts / Assign in Jira / etc.) | Real write-back to Slack/Jira | No such action exists anywhere in `apps/web/src/actions/` | 5 |
| "Inspect Timeline" CTA | Link to case/commitment detail | Already implemented identically | 1 |
| Bottom guardrail drawer | Explainer copy | Simplified equivalent already exists | 1 |
| "Engine: RFC-822 / UTC Strict" + "View Clock Audit Schema" | Schema/audit-trail viewer | No such view/route exists | 5 |

### 5. Missing data/API requirements

**Category 3 (new query, same domain model):**
- Query `CaseLink` rows for the fetched `caseIds` (filtered to `unlinkedAt: null`, `system: jira`) inside `getAtRiskData`. Needed for: Jira issue id in the dual-id pairing, and link `confidence` for the "Linked: Certain (n/n)" pill.

**Category 4 (concept doesn't exist yet):**
- Historical baseline for "Avg Transit Latency +Xm vs baseline" — no stored historical average anywhere.
- Jira project/queue/board name — no such column on `CaseLink`; would require capturing this from Jira issue payloads during normalization.
- Engineering-side assignee name — no Jira-assignee equivalent anywhere.
- "Unassigned (Xh Ym in Queue)" duration — requires assignment-state *history*, not tracked; no assignee-change event type today.
- Target ID slug — no per-target-kind identifier exists; at best a cosmetic derived label, not a real stored identifier.

**Category 5 (genuinely new product capability):**
- Real Slack/Jira write-back actions (Ping, Assign, Request Status, Flag Urgency) — none exist today; new write integrations, not missing fields.
- A "Clock Audit Schema" viewer/route — nothing like it exists.

### 6. Components that should be rebuilt rather than modified

- **`AtRiskCard.tsx`** — renders a fraction of Stitch's information architecture in a different visual language. Patching means adding ~6 new sub-sections — effectively a new component, reusing only the outer `article` shell and `CountdownClock`.
- **`AtRiskView.tsx`**'s KPI section and filter bar — measure/filter on the wrong dimensions entirely; need rebuilding even though the outer `PageHeader`/list-mapping/empty-state scaffolding can stay.
- **`stat-tile.tsx`** — shared across other redesigned pages; restyling it in place risks regressing every other page. A dedicated KPI-tile component (or variant prop) for this page is safer.
- **`at-risk-data.ts`** (`getAtRiskData`) — needs a new row shape threading several new fields end-to-end; touches the Prisma query, the type (currently duplicated between `types/at-risk.ts` and `types/dashboard.ts`), and every consumer.

### 7. Components that can genuinely be reused

- **`CountdownClock.tsx`** — sound, real, server-data-driven; matches or exceeds Stitch's fake countdown. Only its container/typography needs to move into the rebuilt card.
- **`ssr/AtRisk.tsx`** — server fetch + `SlaAutoRefreshProvider` composition is architecturally sound, no Stitch-equivalent to diverge from. Keep as-is.
- **`page-header.tsx`** — already accepts arbitrary `ReactNode` for `title`, fits Stitch's inline-badge treatment without structural change.
- **`empty-state.tsx`** — no Stitch-equivalent to diverge from; keep.
- **`format.ts`** helpers and **`case-links.ts`**'s `caseCommitmentHref`— reusable as-is.
- **`Utils.exportToCsv`** — Export button already real, matches Stitch's intent.

### 8. Required reconstruction work

1. Extend the Prisma query in `getAtRiskData` to select `Case.priority`, `Case.tier`/`Customer.tier`, `Case.assigneeName`, and `Commitment.targetMinutes`; add a `CaseLink.findMany` query for the same `caseIds`.
2. In the per-row loop, also read `evaluation.elapsedSeconds`/`elapsedWorkingMinutes`, call `sumLegMinutes` for support and engineering, attach `targetMinutes`.
3. Unify/extend `AtRiskRowData`/`AtRiskRow` (currently duplicated parallel types) with: `priority`, `tier`, `supportAssigneeName`, `targetMinutes`, `elapsedSeconds`, `supportLegMinutes`, `engineeringLegMinutes`, `jiraIssueId`, `linkConfidence`.
4. Add a priority→"P1"/"P2" mapping helper to `format.ts`, mirroring the existing `formatCommitmentStatus`/`formatLeg` pattern.
5. Rebuild `AtRiskCard.tsx`: severity badge, dual-id row, tier label, ceiling caption, a new `TimeAllocationBar` sub-component, locus breadcrumb (gracefully omitting queue/engineering-assignee fields until those gaps close), assignee pairing line. Leave the action-buttons row out (or visibly disabled) until write-back integrations are scoped — do not fabricate working Slack/Jira buttons.
6. Rebuild the KPI row: Immediate-Threat/Elevated-Risk/Active-Clock-Locus/Avg-Transit-Latency (baseline delta deferred).
7. Rebuild the filter bar: Severity filter (from new `priority` field); decide whether to keep/extend Leg filter beyond Stitch's two Locus options.
8. Build a new KPI-tile component instead of editing the shared `stat-tile.tsx` in place.
9. Wire the "Linked: Certain (n/n)" pill once CaseLink confidence is queried.
10. Delete the dead `AtRiskList.tsx`/`columns.tsx`.
11. Get product sign-off on the two category-5 items before building any UI for them.
12. Re-run a screenshot comparison against `screen.png` once the above lands.

### 9. Acceptance checklist for visual parity

- [ ] Page header shows "At Risk" + live pulsing-dot count badge + "Live Clock Daemon" status pill.
- [ ] Exactly 4 KPI tiles, colored left edge, label-caps header + icon, large mono value, truncated detail line.
- [ ] KPI 1 = Immediate Threat (&lt;1h), live count.
- [ ] KPI 2 = Elevated Risk (1h–2.5h), live count.
- [ ] KPI 3 = Active Clock Locus (% Eng Leg, X of Y Cases).
- [ ] KPI 4 = Avg Transit Latency (baseline-delta only if scoped in).
- [ ] Filter toolbar: Severity chips + Locus chips + "Linked: Certain (n/n)" pill + search.
- [ ] Each card: severity badge, dual ticket IDs joined by "↔", tier/contract label, customer — subject headline.
- [ ] Each card's countdown: pulsing-dot status label, big mono digits, "Ceiling: … SLA Target" caption.
- [ ] Each card has a Time Allocation strip: elapsed-of-target sentence, tri-segment bar, Support/Eng/Runway figures with percentages.
- [ ] Each card has a Locus breadcrumb naming leg + linked issue id (+ queue/assignee where data exists).
- [ ] Each card shows a Support↔Engineering assignee pairing line.
- [ ] Each card ends with an "Inspect Timeline" primary CTA.
- [ ] Bottom guardrail drawer present.
- [ ] Cards render as a flat vertical list, no grouped section headers.
- [ ] Card/tile surfaces are flat, small-radius, monospace metrics — not shadcn `rounded-xl`/`shadow-panel`.

---

## Cases (List)

### 1. Stitch structure

Source: `apps/web/stitch_elapsed/cases/code.html` + `screen.png`.

- **Page header row**: "Cases" + "OPERATIONAL LEDGER" chip + pulsing dot, description ("Continuous SLA ledger across Zendesk customer touches and Jira engineering handoffs"), one right-aligned "Export Full CSV (30 Days)" button carrying a "142 rec" count chip.
- **Stat tile strip**, 4 tiles (`grid-cols-2 md:grid-cols-4`): Total Tracked Cases (142, "30d scope"), Active Running SLA Clock (28, "burning now", error-red, spinning icon), Linked — Certain (118, "83.1% deterministic"), Standalone/Unlinked (24, "support-only").
- **Filter bar**: omnibox search with pinned "ZD"/"ENG" source chips; Priority button-group (All/P1/P2/P3); Link button-group (All/Certain (118)/Unlinked (24)); below, an SLA-status quick-filter pill row (All/At Risk/Breached/On Track/Met, colored dot + count chip) + right-aligned "Live Ledger Poll: 5s" indicator.
- **Table, 7 columns**: `PRIORITY & DUAL-KEY | CUSTOMER & SUBJECT | CORRELATION | SLA TARGET & RUNWAY | LEG ALLOCATION (SUPP↔ENG) | CURRENT STATE & ASSIGNEE | ACTION`. Each row is a composite multi-field cell, not scalar-per-cell:
  - **Priority & Dual-Key**: priority chip + `#ZD-8921 ⇄ ENG-4102` pairing (icon differs for official link vs. pattern match) + "synced 1m ago"/"standalone" caption.
  - **Customer & Subject**: customer name + tier chip, truncated subject, Zendesk ref + team/component tag.
  - **Correlation**: badge ("Linked — Certain"/"Unlinked") + method caption.
  - **SLA Target & Runway**: target label + status chip + live countdown/overage readout + thin progress bar.
  - **Leg Allocation**: two-segment mini bar (Supp vs Eng minutes) + pulsing-dot caption.
  - **Current State & Assignee**: two small source-status chips (`ZD: Open` / `ENG: In Triage`) + assignee name or italic "Unassigned".
  - **Action**: right-aligned "View Case →" button.
- **Table footer**: "Showing 1–8 of 142 tracked cases" + rows-per-page selector + numbered pagination.
- **Bottom audit strip**: "Fixed 30-Day Analysis Window • Read-only sync active…" + a fake "Event Stream Hash" + "Latency: 42ms".

### 2. Current implementation structure

- `ssr/CaseList.tsx` — trivial SSR shell, fetches `Actions.Cases.getList()`, renders `CaseListView`.
- `csr/CaseListView.tsx`:
  - `PageHeader` with eyebrow, title + a single tracked-count `Badge`, Export CSV / Refresh buttons.
  - 4-tile `StatTile` grid: Total cases, Open, Breached, At risk — all built from client-side reductions over `data.cases`.
  - One filter card with two button-pill groups: SLA status (All/Breached/At risk/On track/Met) and Case status (All/Open/Closed), both with counts.
  - A generic shared `DataTable` with a header slot (row count + search `Input`), rendering `columns.tsx`'s 10 column defs.
- `csr/columns.tsx` — 10 flat, single-value columns: Customer, Requester, Case (subject link), Ticket (`#externalId`), Priority (raw string), Tier, Channel, SLA status badge, Case/open-closed badge, Opened date, Closed date. No composite cells, no per-row action button, no leg/correlation/runway visuals anywhere.

### 3. Major structural mismatches — bluntly: the old generic data-grid, reskinned

This is **not** a restyle situation. `CaseListView`/`columns.tsx` is a conventional sortable/filterable admin table (one scalar per column, generic `DataTable`) retrofitted with new stat tiles and pill filters. Stitch's target is a dense **composite-cell operational ledger** where each cell packs 2–4 related facts, in a fixed non-configurable 7-column layout, with a strong "live system" framing. Different component philosophies, not different colors:

- **The whole column set is wrong.** Stitch has 7 purpose-built composite columns; current has 10 generic scalar columns (Requester, Tier, Channel, Opened, Closed) that don't exist in Stitch at all, and is missing all of Stitch's signature columns (Dual-Key, Correlation, SLA Target & Runway, Leg Allocation, Current State & Assignee, Action). Full rebuild of `columns.tsx`, not column-by-column edits.
- **No live countdown/runway anywhere in the list.** Stitch's single most important per-row signal — the live ticking countdown/overage with a progress bar — has zero equivalent; SLA status is a static word badge only.
- **No leg-allocation visualization at all** — brand-new visual with no current analog.
- **No correlation/dual-key concept in the row UI** — current only exposes `externalId` (a single ticket number); Stitch's "operational ledger across two systems" framing is completely absent from both the data flowing to the row and the cell markup.
- **Filter bar is one generation behind**: current has SLA-status + open/closed pills (close to Stitch's SLA-status row) but missing the Priority filter group and the Link/Certainty filter group; search is relocated into the table header rather than the filter panel.
- **Stat tiles are the wrong 4 tiles.** Current shows Total/Open/Breached/At-risk; Stitch shows Total/Active-Clock/Linked-Certain/Standalone-Unlinked. Two of Stitch's four require data the list query doesn't fetch at all today.
- **No "live system" framing** — no poll indicator, no real 30-day scope framing (current query is unscoped — returns *all* cases), no audit footer.

### 4. Data-contract mapping

| Stitch element | Domain meaning | Current data source | Category |
|---|---|---|---|
| Total Tracked Cases | Count of cases in scope | `CaseListData.cases.length` | 1 |
| Active Running SLA Clock (28) | Count of cases with a commitment whose live clock is running now | Not on `CaseListRow`; only persisted `worstCommitmentStatus` returned — needs live evaluation per case, following the `at-risk-data.ts` precedent | 3 |
| Linked — Certain (118, "83.1%") | Count/percent with active `CaseLink` at `confidence: certain` | `CaseListRow` carries no link data; `CaseLink` never joined in `getCaseListData` | 3 |
| Standalone/Unlinked (24) | Inverse of above | Same as above | 3 |
| Omnibox search | Free-text filter | Existing search covers customer/ticket/subject; Jira-key/engineer not searchable (fields not on row) | 1 for existing; 3 for Jira-key/assignee |
| Priority filter (P1/P2/P3) | Filter by ticket priority | `priority` exists as a raw string (`urgent/high/normal/low/none`), not P1/P2/P3 | 2 (display mapping) |
| Link filter (Certain/Unlinked) | Filter by correlation confidence | Same gap as stat tiles | 3 |
| SLA Status quick filters + counts | Filter by worst commitment status | `worstCommitmentStatus` already implemented almost exactly this way | 1 |
| "Live Ledger Poll: 5s" | Auto-refresh indicator | Case detail already wires `SlaAutoRefreshProvider`; list page only has a manual Refresh button | 2 (reuses existing mechanism) |
| Priority chip | Same as filter | See above | 2 |
| Dual-Key pairing | Primary linked engineering issue key | Needs same `CaseLink` join as stat tiles | 3 |
| "synced 1m ago" / "standalone" | Per-case last-sync recency | No per-case sync timestamp exists anywhere; only `Integration.lastSyncAt` (org-level, per-provider) | 4 |
| Customer name, tier, subject, Zendesk # | Case identity | Already on `CaseListRow` | 1 |
| Team/component tag ("API Platform") | Engineering component/team taxonomy | No such field on `Case` | 4 |
| Correlation badge + method caption | Link confidence + method | `CaseLinkDetail.confidence`/`.method` exist only in `CaseDetailData`, never joined at list scope | 3 |
| SLA Target & Runway (target, status, live countdown, bar) | Live commitment evaluation per case | Only computed per-case in `getCaseDetailData`; list only has persisted status enum, no live numbers | 3 (real work; perf consideration running `evaluateCommitment` across 100+ cases) |
| Leg Allocation mini-bar | Per-case leg time split | `legTotals`/`legSpans` only computed in `getCaseDetailData` | 3 |
| Current State chips + assignee | Case status + linked issue's status + assignee | `status` and `assigneeName` both exist on the case but neither is selected in `getCaseListData`'s query | 1/3 boundary — trivial select addition |
| "View Case" action button | Navigate to detail | Already implemented via subject-cell link | 1 |
| Pagination footer | Table chrome | UI-only | 1 |
| "Fixed 30-Day Analysis Window" | Date-range scoping | `getCaseListData` has no date filtering — returns every case unscoped | 4 |
| "Event Stream Hash" / "Latency: 42ms" | Synthetic audit/diagnostic readout | No backing metric — should not be fabricated | 5 |

### 5. Missing data/API requirements

1. **Case-level correlation join** (blocks Linked/Unlinked tiles, Link filter, Correlation column, Dual-Key column). Add an active `CaseLink` join to `getCaseListData`. Category 3, mirrors existing filtering logic in `case-detail-data.ts`.
2. **Live commitment evaluation at list scope** (blocks Active Running SLA Clock tile, SLA Target & Runway column + progress bar). Requires running `evaluateCommitment` across every open commitment in the list. Category 3 — real work, working precedent exists (`at-risk-data.ts`), but a genuine perf/architecture decision (evaluate 142+ cases per render vs. caching).
3. **Leg totals at list scope** (blocks Leg Allocation column). Requires `deriveLegSpans` per case. Category 3, same perf caveat.
4. **`assigneeName` and `status` added to `getCaseListData`'s select** (blocks Current State & Assignee column). Category 1/3 — columns already exist on `Case`, this is a query-shape fix.
5. **Per-case sync recency.** Category 4 — no field exists; only org-level `lastSyncAt` is tracked. Drop from the row or reframe as org-level, shown once.
6. **Team/component tag.** Category 4 — no `component`/`team` column exists anywhere.
7. **30-day fixed-window scoping.** Category 4 — query is unscoped today.
8. **"Event Stream Hash"/synthetic latency.** Category 5 — do not fabricate; drop or replace with a real value (e.g., `asOf`).

### 6. Components that should be rebuilt rather than modified

- **`columns.tsx`** (entire file) — the column set itself doesn't match Stitch's 7-column composite structure; needs full rebuild once list-scope data exists.
- **`CaseListView.tsx`** filter bar + table wrapper — the generic `DataTable` drives a column-picker-style grid; Stitch's dense ledger with composite cells and a fixed layout is a different table pattern. Either a new dedicated table component, or `DataTable` needs a "dense composite row" mode it doesn't have today.
- **Stat tile row** — needs new tile definitions wired to new aggregated data; the `StatTile` primitive itself can stay.

### 7. Components that can genuinely be reused

- **`stat-tile.tsx`** — already supports everything Stitch's tiles need, including an unused `detail` prop that maps directly to Stitch's secondary caption line. No rebuild, just new instances.
- **`page-header.tsx`** — eyebrow + title + actions matches Stitch's header composition closely enough to extend.
- **`CountdownClock.tsx`** (from At-Risk) — a genuinely reusable live-ticking countdown, functionally identical in intent to Stitch's own hand-rolled JS countdown. Exactly the primitive the SLA Target & Runway column needs.
- **`at-risk-data.ts`**'s query pattern — proves the "live-evaluate commitments across many cases" pattern already exists and works; the list-page aggregation should follow this precedent.
- **`StatusBadge`** — already renders the breached/at_risk/on_track/met vocabulary; reusable for the SLA Target & Runway column's status chip.
- **Design tokens** (`colors.css`) — already fully port Stitch's token names as CSS variables. Colors/surfaces are not a gap here; the mismatch is entirely structural/compositional.

### 8. Required reconstruction work

1. Extend `getCaseListData`: add active-`CaseLink` join (primary link's system/externalId/method/confidence), add `assigneeName` and `status` to the select, decide on/implement 30-day scoping if kept.
2. Add a list-scope live-commitment-evaluation path (reusing `evaluateCommitment`/`deriveLegSpans`, following `at-risk-data.ts`'s pattern) — decide caching/perf strategy for 100+ cases.
3. Update `CaseListData`/`CaseListRow` types to carry the new fields.
4. Rebuild `columns.tsx` around the 7 Stitch columns with composite cells.
5. Rebuild the stat tile row with Active-Clock and Linked/Unlinked tiles.
6. Rebuild the filter bar to add Priority and Link/Certainty groups; relocate search into the filter panel.
7. Wire `SlaAutoRefreshProvider` (already built for case detail) into the list page for "Live Ledger Poll" framing.
8. Add pagination chrome; decide whether to keep or drop the synthetic audit-strip footer.
9. Note: cherry-picking from `deterministic_case_explorer` is not possible — that reference no longer exists in the repo.

### 9. Acceptance checklist for visual parity

- [ ] Header shows "Cases" + "OPERATIONAL LEDGER" chip + pulsing dot, subtitle, single Export button with record-count chip.
- [ ] Exactly 4 stat tiles: Total Tracked, Active Running SLA Clock, Linked — Certain (with % sub-line), Standalone/Unlinked.
- [ ] Filter bar: search + ZD/ENG chips, Priority group, Link group, SLA-status pill row with counts, live-poll indicator.
- [ ] Table has exactly 7 columns in Stitch's order, each rendering composite content.
- [ ] Each row shows all composite sub-fields per column as specified in §1.
- [ ] Rows alternate background shading with no visible cell borders.
- [ ] Footer shows "Showing X–Y of Z", rows-per-page selector, numbered pagination.
- [ ] Countdown numbers tick live (seconds-level) without a full page refresh.
- [ ] Empty/loading/error states re-skinned to match the dark ledger surface tokens.

---

## Case Detail

**Note on the timeline reference:** `deterministic_case_timeline/` no longer exists in `stitch_elapsed/`. The pre-existing migration plan describes Phase 5 ("timeline consolidation") as "validation that Phase 4's components fully cover this mockup, not new build work" — and `elapsed_case_detail/code.html` already contains a full "Segmented Case Journey & Queue Attribution" section with per-leg %/duration, a "RUNNING NOW" marker, and a "LINK VERIFIED (100%)" badge, i.e. exactly the treatment Phase 5 describes. The report below judges the timeline/leg-journey treatment against `elapsed_case_detail/code.html` + `screen.png` alone.

### 1. Stitch structure

Source: `apps/web/stitch_elapsed/elapsed_case_detail/code.html` + `screen.png` (content area only; shell out of scope).

- **Sub-header breadcrumb bar**: `Cases / {customer} / {ZD-key} ↔ {ENG-key}` breadcrumb, right-aligned "LIVE TELEMETRY STREAM" pulsing badge, "Copy Keys" button, "Recalculate Run" primary button.
- **Case identity & live-clock banner**, one card, `lg:flex-row` split: left = priority badge + ZD chip + `↔` + ENG chip + "LINKED — CERTAIN" badge + customer/tier caption; H1 subject; meta line ("Source: X • Support Assignee: Y • Engineering Queue: Z (UNASSIGNED)"). Right = a standalone hero callout: pulsing-dot "Clock Active in Engineering" label, a **huge live countdown** ("00:35:09") + "runway remaining" caption, "Active leg: Jira ENG-4102 (SRE Queue)".
- **Dual commitment cards**, side by side (`md:grid-cols-2`): kind label + status chip (MET/AT RISK), large elapsed/remaining number + achieved/remaining caption, target on the right, thin progress bar, footer line (responded-by / headroom / breach-boundary time).
- **Segmented Case Journey — "Deterministic Time Split"** (the flagship visual): legend (Support/Engineering/Maintenance-excluded swatches); one large (`h-8`) multi-segment bar with **inline text+% labels drawn on the segments themselves** and a "RUNNING NOW" marker on the active segment; axis captions below (clock-start / handoff / breach-boundary times); a 4-metric grid (Support Leg / Engineering Leg / Waiting Customer / Unknown-Unmapped) with duration, % of net elapsed, and a one-line description; an "Attribution Finding" narrative callout.
- **Two-column area (`xl:grid-cols-12`, 7/5 split)**:
  - Left (7 cols): **"How this was calculated"** — Active SLA Policy name/version/date, Calendar Model, "Applied Contract Clauses" prose quoting pause/maintenance rules, and a **step-by-step arithmetic ledger** (Gross Wall-Clock → Maintenance Exclusion → Customer Waiting → Net SLA Elapsed → Target Allotment → Net Runway Remaining), each a labeled signed-duration row, plus a fake "Signature" hash. Below: **"Deterministic Correlation & Linked Records"** — "LINK VERIFIED (100%)" badge, two side-by-side sub-cards (Zendesk ticket: id/created/priority/status; Jira issue: id/linked-date/type/status), a link-method footer with an "Event ID" sentence.
  - Right (5 cols): **"State Transitions"** vertical dot-timeline — one node per lifecycle event (real + synthetic), each with time, a type pill ("CLOCK START"/"SLA MET"/"HANDOFF"/etc.), title, one-line description; current node pulses. Below: **"Escalation Dispatch Log"** — per-channel dispatch rows (Slack, email) with ack/delivered status chips, and a "Re-trigger Escalation Ping" button.
- No conversation/message-thread UI appears anywhere in this mockup.

### 2. Current implementation structure

- `ssr/CaseDetail.tsx` — fetches `Actions.Cases.getDetail(caseId)` + worker poll settings, renders `CaseDetailView` wrapped by `SlaAutoRefreshProvider`.
- `csr/CaseDetailView.tsx` — linear stack: "Back to dashboard" link → `CaseHeader` → `CommitmentSummary` → `CaseJourney` → `ConversationThread` → a `grid lg:grid-cols-[1fr,20rem]` of `ActivityTimeline` + `LinkedRecords`.
- `CaseHeader.tsx` — priority badge, a copyable dual-key chip (`#ZD-8921 ↔ ENG-4102`), a "Linked — {confidence}" badge, a current-leg badge, H1 subject/identity with tooltip, status/tier/channel badge row, meta caption line, "Open in {source}" external-link button.
- `CommitmentSummary.tsx`/`CommitmentCard.tsx` — `md:grid-cols-2` grid of cards: kind label + running/paused badge + status badge, a large live counter (`getLiveRemainingSeconds`, ticks every second), deadline caption, a collapsible "How this was calculated" accordion (target/started/policy/match/pause-states/warn-thresholds/calendar/target-change-history).
- `CaseJourney.tsx` — a proportional multi-segment leg bar (`h-3`) with per-segment tooltips, a legend below (leg/minutes/percent), a second thinner bar for the running/paused clock — all live-recomputed client-side.
- `ActivityTimeline.tsx` — a vertical dot-and-line timeline, icon per event type, timestamp/actor/provider badge per node, plus a glossary popover.
- `ConversationThread.tsx` — a chat-style message thread (customer/agent/system bubbles) with auto-stick-to-bottom scrolling.
- `LinkedRecords.tsx` — a flat bordered-list sidebar card: primary ticket row + one row per `CaseLink`, each with method/confidence/statusName badges.

### 3. Major structural mismatches — the closest of the four screens, but still not a restyle

Case Detail is meaningfully closer to Stitch than the other three — several components already model the right *domain concepts* — but the page is missing Stitch's single most important element and has the wrong visual weighting throughout:

- **No live hero countdown/runway callout anywhere.** Stitch's dominant visual — a huge pulsing "Clock Active in Engineering / 00:35:09 runway remaining" box next to the case identity — has **no equivalent** in the current header or anywhere else. The only live countdown today is buried inside each small `CommitmentCard`, not surfaced as a page-level hero element. A genuine missing component, not a restyle.
- **No "How this was calculated" arithmetic ledger.** `CommitmentCard`'s accordion shows *configuration* (policy, calendar, pause states, warn thresholds) but never the step-by-step *arithmetic reconciliation* Stitch shows. A new sub-component, not an edit to the existing accordion content.
- **`CaseJourney` is a minor supporting widget today; Stitch treats it as the flagship component.** Current bar is `h-3`, embedded in a generic `Card` next to a small SLA-clock bar; Stitch's version is `h-8`, full-width, with inline on-segment labels, axis timestamps, a 4-metric breakdown grid, and a narrative callout. The underlying data/math (`legTotals`, `legSpans`, `deriveLegSpans`) is correct and reusable — the presentation layer needs a near-total redesign.
- **`LinkedRecords` is a flat list; Stitch is a two-system comparison card.** Stitch's version shows Zendesk and Jira side-by-side with matching field sets plus a "LINK VERIFIED (100%)" badge and an audit sentence. Current is a single vertical list of generic link rows — same underlying data mostly, wrong composition.
- **No Escalation Dispatch Log.** Stitch shows a full per-channel notification log with ack/delivered status and a re-trigger action. Nothing surfaces this at all today — and `CaseDetailData` doesn't expose per-dispatch channel/delivery-status data to the client either.
- **`ConversationThread` has no Stitch counterpart.** Current-only addition — worth an explicit product decision on whether/where to keep it; it currently occupies a full-width slot that doesn't correspond to any Stitch region.
- **Header font mismatch**: `CaseHeader.tsx` uses `font-display` (mapped to a serif font, Fraunces, in `globals.css`) for the case subject `<h1>`, while Stitch's headline styles are Hanken Grotesk (sans-serif) throughout — the current case subject renders in a serif font Stitch never uses anywhere on this page.
- **Two-column ratio and content grouping differ**: current is `ActivityTimeline` + `LinkedRecords` in a `[1fr, 20rem]` grid at the very bottom; Stitch's right column (5/12) also carries the Escalation Dispatch Log, and its left column (7/12) carries both the calculation ledger and the correlation panel — the current page's column boundaries don't match Stitch's regioning at all.

### 4. Data-contract mapping

| Stitch element | Domain meaning | Current data source | Category |
|---|---|---|---|
| Breadcrumb | Navigation context | Already built | 1 |
| "LIVE TELEMETRY STREAM" badge | Cosmetic liveness indicator | `SlaAutoRefreshProvider` already polls — underlying liveness is real | 1 |
| "Copy Keys" button | Copy ZD/ENG keys to clipboard | `CaseReferenceButton` already implements this exact behavior | 1 |
| "Recalculate Run" button | Force server-side re-evaluation | No mutation exists; commitments already recomputed on every SSR fetch (live, not cached) — may be redundant with the existing poll architecture | 5 if a genuinely distinct recompute-trigger is wanted |
| Priority badge, dual-key, "LINKED — CERTAIN", customer/tier line | Header identity | All already present | 1 |
| **Hero live runway callout** | Page-level live SLA countdown + active leg + active linked-issue queue | Countdown/leg: existing/derivable, not surfaced as a hero element. "Engineering Queue" name: no field anywhere | 1/2 for countdown+leg; 4 for queue name |
| Support Assignee / Engineering Queue (UNASSIGNED) | Support agent + eng-side queue/assignee | Support assignee exists (`assigneeName`); no engineering-side assignee/queue field exists anywhere | 1 for support; 4 for engineering |
| Dual commitment cards | Per-commitment live evaluation | All fields (`status`, `elapsedSeconds`, `remainingSeconds`, `targetMinutes`, `effectiveDueAt`, `completionOccurredAt`) already exist, rendered today minus progress bar/headroom framing | 1 — needs UI addition, not new data |
| Segmented Case Journey bar w/ inline labels + "RUNNING NOW" | Per-leg time split, live | `legTotals`/`legSpans` already computed and consumed | 1 — presentational gap only |
| Axis captions (clock-start/handoff/breach-boundary) | Key milestone timestamps | All derivable from `openedAt`, `legSpans` transitions, `effectiveDueAt` | 2 |
| 4-metric grid (Support/Eng/Waiting/Unknown) | Per-leg breakdown | `legTotals` exactly covers these 4 buckets already; descriptions are static authored copy | 1 for duration/%; 2 (copy-only) for descriptions |
| "Attribution Finding" narrative | Auto-generated sentence naming dominant leg | Fully derivable from `legTotals` | 2 |
| "How this was calculated" — Policy/Calendar | Policy + calendar metadata | Already fully modeled and rendered | 1 |
| "Applied Contract Clauses" prose | Human-readable rule text | No clause-text field exists; a generic derived sentence from `pauseOnStates` is possible, but literal clause numbering is invented copy in the mockup | 2 for generic sentence; 5 for literal clause numbering |
| Step-by-step arithmetic ledger | Full reconciliation (gross → exclusions → net → runway) | `elapsedSeconds`/`remainingSeconds` are already net figures; excluded intervals are in `pausedIntervals`; gross wall-clock is derivable (`now - startedAt`) | 2 — no new backend query, new presentation logic only |
| "Signature: det_calc_79af4b" | Fabricated audit hash | No such concept exists or should exist | 5 — do not fabricate |
| "LINK VERIFIED (100%)" badge | Correlation confidence | Already used for an equivalent badge elsewhere | 1 |
| Zendesk/Jira side-by-side comparison | Per-system ticket comparison | Zendesk side fully exists. Jira side: `link.externalId`/`statusName` exist; linked-date (`confirmedAt`) exists in DB but not exposed on `CaseLinkDetail`; issue *type* has no field anywhere | 1 for ZD side; 3 for linked-date; 4 for issue type |
| Link Method + webhook-sync confirmation + Event ID | Link provenance detail | `method` exists. "Bi-directional Webhook Synced"/"Event ID" not modeled — `CaseLink.evidence` (Json) exists but only `statusName` is currently extracted; needs schema inspection before assuming availability | 1 for method; 4 for webhook/event-id (unconfirmed) |
| State Transitions timeline | Full activity/lifecycle timeline | `data.timeline` already carries real + synthetic events matching Stitch's node types closely | 1 — near-complete match, just needs a per-node type-pill chip |
| Per-event observed-vs-inferred confidence | Confidence indicator (flagged as a risk in the pre-existing migration plan) | Independently verified absent: `TimelineEventDetail` has no confidence field of any kind; the only confidence concept anywhere is per-*link* (`CaseLinkDetail.confidence`), not per-event | 4 — confirms the migration plan's flagged risk was correct |
| Escalation Dispatch Log | Notification delivery detail | `notificationRows` fetched server-side but only folded into synthetic timeline entries (threshold/timestamp only); channel/ack/delivered/recipient never surfaced | 1 for the at-risk timestamp (already in timeline); 4 for full per-channel detail |
| "Re-trigger Escalation Ping" | Manual re-send notification | No mutation exists | 5 |
| Conversation thread (current-only) | Customer/agent messages | Fully modeled and rendered, no Stitch placement | N/A — product decision needed |

### 5. Missing data/API requirements

1. **Hero runway callout** — no new data needed (category 1/2); purely a presentation gap.
2. **Engineering-side queue name and assignee** — category 4, no field exists anywhere. Needs new Jira ingestion work if wanted; out of scope for a frontend-only change.
3. **Arithmetic reconciliation ledger** — category 2, fully derivable from existing fields; needs new presentation logic only.
4. **Contract-clause prose** — category 2 for a generic derived sentence; category 5 if literal clause numbering is required (no such taxonomy exists).
5. **Jira issue type** — category 4, no field exists.
6. **Link `confirmedAt`/linked-date** — category 3, present in the DB but not exposed on `CaseLinkDetail`; a one-line type/mapping addition.
7. **Webhook-sync confirmation + Event ID** — category 4 as currently modeled; `CaseLink.evidence` might contain something usable — needs explicit confirmation of its actual shape before assuming availability.
8. **Per-event observed-vs-inferred confidence** — category 4, confirmed absent. Recommend explicitly marking `ConfidenceIndicator` DESIGN ONLY / NOT CURRENTLY IMPLEMENTED and excluding it from this phase, per the migration plan's own risk note, rather than fabricating a score.
9. **Escalation Dispatch Log detail** — category 4; only the at-risk timestamp is currently surfaced. Needs a new field/array on `CaseDetailData` sourced from already-fetched `notificationRows`.
10. **"Recalculate Run"/"Re-trigger Escalation Ping"** — category 5, genuinely new write-back operations.
11. **Fabricated "Signature" hash and other synthetic audit strings** — category 5, do not fabricate; drop or substitute a real identifier (e.g., commitment id, policy version id).

### 6. Components that should be rebuilt rather than modified

- **A new hero "live runway" component** (doesn't exist yet) — build and insert into/beside `CaseHeader.tsx`.
- **A new "How this was calculated" ledger component** — `CommitmentCard.tsx`'s accordion is the wrong shape (config disclosure vs. arithmetic reconciliation); build a new component fed by `pausedIntervals`+`elapsedSeconds`, don't extend the accordion.
- **`CaseJourney.tsx`** — keep the data/math but the render tree needs a near-total redesign: inline on-segment labels, `h-8` sizing, axis timestamp row, 4-metric grid, narrative callout are all structurally absent, not style props away.
- **`LinkedRecords.tsx`** — current flat list can't become Stitch's two-system side-by-side comparison via prop/class tweaks; needs restructuring into Zendesk-column/Jira-column layout.
- **A new Escalation Dispatch Log component** — no current analog; needs both new data plumbing and a new component.

### 7. Components that can genuinely be reused

- **`CommitmentCard.tsx`** — core numbers already match Stitch's intent closely; only needs a progress bar added and headroom-phrasing tweaked. Live-ticking logic should be kept as-is.
- **`ActivityTimeline.tsx`** — dot-and-line structure, event-type icon map, and chronological data are a strong match for "State Transitions"; mainly needs a per-node type-pill chip added.
- **`CaseHeader.tsx`'s `CaseReferenceButton`** — already implements exactly Stitch's "Copy Keys" behavior; reuse/relabel directly.
- **`CountdownClock.tsx`** (from At-Risk) — the right primitive for the new hero runway callout.
- **Design tokens** (`colors.css`, leg + clock-state vocabulary) — already fully cover Stitch's leg/running/paused vocabulary; not a gap.
- **`engineeringLegTarget`** (`EngineeringLegEvaluation`) — computed server-side already but currently rendered nowhere in the CSR tree; a quick win to enrich the Engineering Leg card in the 4-metric grid.

### 8. Required reconstruction work

1. Build a new page-level hero "live runway" component (reusing `CountdownClock`), place in/beside `CaseHeader`.
2. Build the arithmetic-ledger sub-component (no backend change needed).
3. Redesign `CaseJourney.tsx`'s render tree for the flagship treatment while keeping its segment-math/tooltip logic.
4. Add a progress bar + headroom phrasing to `CommitmentCard.tsx`.
5. Restructure `LinkedRecords.tsx` into a two-system comparison layout; extend `CaseLinkDetail`/`case-detail-data.ts` to surface `confirmedAt` if the "Linked: date" field is wanted.
6. Add per-node type-pill chips to `ActivityTimeline.tsx`.
7. Explicitly mark the per-event confidence indicator as not-currently-implemented and exclude it from this phase.
8. Decide product placement for `ConversationThread` (no Stitch region reserves space for it).
9. If the Escalation Dispatch Log and "Recalculate Run"/"Re-trigger" actions are wanted, scope them as separate backend work — data plumbing plus, for the two buttons, genuinely new mutations.
10. Drop or replace fabricated audit strings with real identifiers or omit them.
11. Fix the `font-display`/Fraunces serif mismatch on the case subject `<h1>` to match Stitch's sans-serif treatment.

### 9. Acceptance checklist for visual parity

- [ ] Breadcrumb bar shows customer/ZD-key/ENG-key, "LIVE TELEMETRY STREAM" badge, "Copy Keys", a recalculate-style action.
- [ ] Identity card shows priority + dual-key + "LINKED — CERTAIN" + customer/tier line, sans-serif H1, Source/Assignee/Queue meta line.
- [ ] A standalone hero box shows a live, second-ticking countdown with "runway remaining"/"active leg" captions, Stitch's visual weight (large mono digits, pulsing dot).
- [ ] Two commitment cards render side-by-side with status chip, large counter, target, a visible progress bar, headroom/boundary footer.
- [ ] The Segmented Case Journey bar is full-width, `h-8`-scale, inline segment labels, "RUNNING NOW" marker, axis timestamps, 4-metric grid, attribution sentence.
- [ ] Left column shows policy/calendar summary, clause prose, step-by-step signed-duration ledger ending in the runway figure.
- [ ] Correlation panel shows "LINK VERIFIED" badge + two side-by-side ticket-comparison cards + link-method line.
- [ ] Right column shows a dot-timeline with per-node type pills and a pulsing "current" node.
- [ ] Escalation Dispatch Log (if implemented) shows per-channel ack/delivered chips.
- [ ] No fabricated hash/signature strings without a real backing value.
- [ ] Case-subject font matches Stitch's sans-serif treatment, not the current serif `font-display`.

---

## Appendix: Key files referenced

**Stitch references:** `apps/web/stitch_elapsed/elapsed_dashboard/`, `apps/web/stitch_elapsed/at_risk_queue/`, `apps/web/stitch_elapsed/cases/`, `apps/web/stitch_elapsed/elapsed_case_detail/`, `apps/web/stitch_elapsed/elapsed_design_system_token_architecture_specification.md`.

**Dashboard:** `apps/web/modules/dashboard/dashboard/{ssr/Dashboard,csr/DashboardView,csr/columns,csr/AtRiskList,csr/OtherCasesList,csr/analytics/*}.tsx`, `apps/web/src/actions/dashboard.ts`, `apps/web/src/lib/dashboard-data.ts`, `apps/web/src/lib/analytics-data.ts`, `apps/web/src/lib/types/dashboard.ts`.

**At-Risk:** `apps/web/modules/dashboard/at-risk/{ssr/AtRisk,csr/AtRiskView,csr/AtRiskCard,csr/CountdownClock}.tsx`, `apps/web/src/actions/at-risk.ts`, `apps/web/src/lib/at-risk-data.ts`, `apps/web/src/lib/types/at-risk.ts`.

**Cases (List):** `apps/web/modules/cases/case-list/{ssr/CaseList,csr/CaseListView,csr/columns}.tsx`, `apps/web/src/lib/case-list-data.ts`.

**Case Detail:** `apps/web/modules/cases/case-detail/{ssr/CaseDetail,csr/CaseDetailView,csr/CaseHeader,csr/CaseJourney,csr/CommitmentSummary,csr/CommitmentCard,csr/ActivityTimeline,csr/ConversationThread,csr/LinkedRecords}.tsx`, `apps/web/src/lib/case-detail-data.ts`, `apps/web/src/lib/case-links.ts`, `apps/web/src/lib/types/cases.ts`.

**Shared:** `apps/web/src/actions/cases.ts`, `apps/web/src/lib/format.ts`, `apps/web/src/lib/status-styles.ts`, `apps/web/src/lib/utils.ts`, `apps/web/src/components/shared/{stat-tile,page-header,status-badge,empty-state}.tsx`, `apps/web/src/styles/colors.css`, `apps/web/src/app/globals.css`, `apps/web/src/app/(main)/layout.tsx`, `packages/db/prisma/schema.prisma`, `implementation-plans/Elapsed-Full-UI-Migration-Plan.md`.

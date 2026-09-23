# Elapsed — Full UI Redesign Migration Plan (Audit + Mapping Output)

> Output of [`Elapsed-Full-UI-Migration-Planning-Prompt.md`](./Elapsed-Full-UI-Migration-Planning-Prompt.md). This is an **audit and plan only** — no code, components, routes, APIs, or business logic have been changed. Nothing in this document has been implemented yet.

---

## 1. Executive Summary

**Current UI architecture.** The app (`apps/web`) is a Next.js 16 / React 19 / Tailwind v4 monorepo package. Routing is a thin `src/app/**/page.tsx` layer (3–6 lines per file) that renders one named export from a matching `modules/<feature>/<page>` barrel. Each page-module follows a strict `ssr/<Name>.tsx` (server component, fetches via `src/actions/*.ts`) → `csr/*.tsx` (`"use client"` view) split. There is no client data-fetching library (no react-query/SWR) and no client state library — props flow down from server to client once per navigation, plus one polling provider (`SlaAutoRefreshProvider`) for live dashboard updates. Theming is Tailwind v4 CSS-first (`@theme` in `globals.css`), backed by `src/styles/colors.css` (`:root` light + `.dark` overrides), toggled by `next-themes` with `defaultTheme="system"`. Fonts (Hanken Grotesk + JetBrains Mono) and the `.dark` palette are **already substantially aligned** with the Stitch spec — someone previously ported Stitch-derived hex values into `.dark` (e.g. `--primary: #38bdf8`, `--success: #10b981`, `--warning: #f59e0b`, `--destructive: #f43f5e`). This is good news: the token migration is a *reconciliation*, not a from-scratch redesign.

**Stitch design architecture.** `apps/web/stitch_elapsed` contains 27 static HTML/PNG screen mockups plus 4 markdown docs. Critically, the package is **not one coherent design** — it contains **two divergent shell explorations** for the same product ("Elapsed" sidebar shell vs. "SLA Watchtower" sidebar shell, the latter with a much larger nav and an "audit engine" framing), **three divergent alternate design-system docs** (`elapsed/DESIGN.md`, `obsidian_elapsed/DESIGN.md`, `alexandria/DESIGN.md` — the last of which, an editorial/serif "Digital Curator" direction, actively contradicts the operational-console brief and should be discarded), and a mix of production-shaped screens, onboarding screens, mobile concepts, internal/debug tooling concepts, and out-of-scope exploratory concepts (dispute-package builder, QBR presentation, replay debugger, correlation-hygiene studio, on-call roster/bridge). The **one authoritative token source** is `elapsed_design_system_token_architecture_specification.md`, cross-checked against `elapsed/DESIGN.md` (the most complete/consistent of the three alt docs, and the one to prefer when they disagree).

**Major gap.** The gap is almost entirely *visual density and structure*, not missing functionality: current pages already implement the SLA domain concepts (legs, commitments, at-risk/breached states, correlation) the Stitch package visualizes, but with a lighter, more conventional SaaS-dashboard treatment (card-heavy, `system`-default theme, looser spacing) versus the target's dense, dark-first, bordered, monospace-numeric operational-console treatment. The largest real gap is the **~14 of 27 Stitch screens that represent functionality the product does not have and does not plan to build for MVP** (dispute packages, QBR decks, replay debugger, correlation-hygiene studio, on-call roster/bridge, alert-routing "studio"). These must not be built just because a mockup exists.

**Migration strategy.** Treat this as a **page-by-page presentation migration** of the existing route tree, in this order: design tokens/shell → dashboard → at-risk queue → cases → case detail → timeline (consolidated into case detail, not a separate page) → settings/integrations → onboarding/backfill → notifications (scoped-down "alerts") → mobile responsive pass. Explicitly **exclude** from active migration: `deterministic_case_explorer`/`escalations_sla_dashboard`/`settings_read_only_connections` (duplicate shells — cherry-pick copy/table-column ideas only), `coverage_historical_audit`, `executive_sla_audit_qbr_presentation`, `audit_report_dispute_package_builder`, `deterministic_correlation_linking_hygiene_studio`, `replay_debugger_mathematical_engine`, `mobile_on_call_roster_escalation_bridge`, `mobile_triage_clue_remediation`, `concierge_ingestion_pre_sales_audit`, `zero_config_ingestion_backfill` (internal pipeline view — see notes). Logo screens feed the brand components only, not a page.

---

## 2. Stitch Screen Inventory

| Stitch Screen | HTML | Screenshot | Category | Intended Route | Existing Route | Status | Migration Notes |
|---|---|---|---|---|---|---|---|
| `elapsed_dashboard` | ✓ | ✓ | 1. Current production feature | `/dashboard` | `/dashboard` | **Migrate — Phase 1 (reference implementation)** | "Elapsed" shell. Primary dashboard target. |
| `escalations_sla_dashboard` | ✓ | ✓ | 8. Duplicate/alternate design | `/dashboard` | `/dashboard` | **Reject as page; cherry-pick** | Same page, "Watchtower" shell + "Audit Checkpoint" framing. Do not build a second dashboard shell — borrow KPI-tile phrasing only if useful. |
| `at_risk_queue` | ✓ | ✓ | 1. Current production feature | `/at-risk` | `/at-risk` | **Migrate — Phase 2** | Risk-tier grouping ("Immediate Threat"/"Elevated Risk") is new; evaluate against existing sort/filter semantics before adopting. |
| `cases` | ✓ | ✓ | 1. Current production feature | `/cases` | `/cases` | **Migrate — Phase 3** | Dense operational table is the target column model. |
| `deterministic_case_explorer` | ✓ | ✓ | 8. Duplicate/alternate design | `/cases` | `/cases` | **Reject as page; cherry-pick** | Alt "cases" view with bulk-replay tooling. Bulk replay = post-validation (excluded). Filter-bar/stat-strip ideas may inform `/cases`. |
| `elapsed_case_detail` | ✓ | ✓ | 1. Current production feature | `/cases/[caseId]` | `/cases/[caseId]` | **Migrate — Phase 4** | Critical page; see contract below. |
| `deterministic_case_timeline` | ✓ | ✓ | 1/2. Current production (partial) | part of `/cases/[caseId]` | `CaseJourney`/`ActivityTimeline` (partial) | **Migrate — Phase 5, consolidate into case detail** | Do not create a separate timeline route/page; the current `CaseJourney` leg bar + `ActivityTimeline` event feed are the same domain concept and should absorb this treatment. |
| `settings` | ✓ | ✓ | 1. Current production feature | `/settings`, `/settings/integrations` | same | **Migrate — Phase 6** | "Elapsed" shell settings + integrations. |
| `settings_read_only_connections` | ✓ | ✓ | 8. Duplicate/alternate design | `/settings/integrations` | same | **Reject as page; cherry-pick** | "Watchtower" shell variant. "Zero write-back" messaging/badges are worth adopting verbatim into `IntegrationsView` copy. |
| `step_1_connect_helpdesk` | ✓ | ✓ | 1. Current production feature | `/onboarding` | `/onboarding` | **Migrate — Phase 7** | Matches existing `OnboardingFlow` step 1. |
| `step_2_90_day_backfill_ingestion` | ✓ | ✓ | 1. Current production feature | `/onboarding` | `/onboarding` | **Migrate — Phase 7** | Matches existing backfill step; live ledger/terminal-log styling is new visual treatment, feasible with existing progress data. |
| `step_3_connect_issue_tracker` | ✓ | ✓ | 1. Current production feature | `/onboarding` | `/onboarding` | **Migrate — Phase 7** | Matches existing step 3. |
| `zero_config_ingestion_backfill` | ✓ | ✓ | 7. Debug/internal tooling | — | (backfill sub-step of `/onboarding`) | **Do not migrate as its own screen** | Internal pipeline/partition metadata view ("3 Matrices · 84 Orgs Discovered"). Not user-facing; skip unless an internal ops need emerges later. |
| `90_day_backfill_findings` | ✓ | ✓ | 1. Current production feature | `/onboarding/findings` | `/onboarding/findings` | **Migrate — Phase 7** | Existing `FindingsView` is the direct match. |
| `alerts_escalation_routing_studio` | ✓ | ✓ | 2/3. MVP feature (partial) / Post-validation (rest) | `/settings/notifications` (scoped) | `/settings/notifications` | **Migrate — Phase 8, scoped down** | Channel status cards + historical dispatch ledger fit MVP. Rule-logic builder + live dispatch simulator = "generic workflow engine", explicitly excluded by MVP boundaries — do not build. |
| `coverage_historical_audit` | ✓ | ✓ | 4. Exploratory concept | — | — | **Exclude** | Audit/report product; MVP favors rendered timeline + CSV export over heavyweight audit reports (Phase 9 guidance). |
| `executive_sla_audit_qbr_presentation` | ✓ | ✓ | 4/5. Exploratory / Marketing artifact | — | — | **Exclude** | Executive presentation deck, not a core product surface. |
| `audit_report_dispute_package_builder` | ✓ | ✓ | 4. Exploratory concept | — | — | **Exclude** | Legal/dispute + financial evidence tooling — explicitly out of MVP ("financial/service-credit calculations"). Case E. |
| `deterministic_correlation_linking_hygiene_studio` | ✓ | ✓ | 7. Debug/internal tooling | — | — | **Exclude (post-validation candidate)** | Correlation-tuning UI; no equivalent exists today. Could become an internal/admin tool later, not MVP. |
| `replay_debugger_mathematical_engine` | ✓ | ✓ | 7. Debug/internal tooling | — | — | **Exclude** | Forensic step-through debugger. Internal/admin diagnostic at best; never customer-facing per current MVP. |
| `concierge_ingestion_pre_sales_audit` | ✓ | ✓ | 7. Debug/internal tooling (exists) | `/internal/concierge/*` | `/internal/concierge/jira-export`, `/internal/concierge/zendesk-export` | **Low-priority optional restyle** | Real internal route exists today with different framing (CSV export tool, not "pre-sales sandbox"). Only restyle if internal tooling is explicitly prioritized; not part of the customer-facing migration phases. |
| `mobile_incident_commander_active_runway` | ✓ | ✓ | 6. Mobile-specific concept | `/at-risk` (responsive) | `/at-risk` | **Migrate — Phase 11 (extract patterns)** | Not a separate mobile app; apply responsive card/stack pattern to existing `/at-risk`. |
| `mobile_incident_forensic_detail` | ✓ | ✓ | 6. Mobile-specific concept | `/cases/[caseId]` (responsive) | `/cases/[caseId]` | **Migrate — Phase 11 (extract patterns)** | Same for case detail. |
| `mobile_escalation_alerts_push_log` | ✓ | ✓ | 3/6. Post-validation + mobile | — | — | **Deferred** | Depends on the alerts feature existing first (Phase 8 scoped-down version has no dedicated feed/push UI yet). |
| `mobile_on_call_roster_escalation_bridge` | ✓ | ✓ | 4. Exploratory concept | — | — | **Exclude** | No "on-call roster"/"bridge pairing" domain concept exists in the product or MVP docs. |
| `mobile_triage_clue_remediation` | ✓ | ✓ | 7. Debug/internal tooling | — | — | **Exclude** | Mobile variant of the correlation-hygiene studio; same exclusion rationale. |
| `sla_watchtower_continuity_logo` | ✓ | ✓ | 5. Marketing/brand artifact | — | `src/components/shared/brand-mark.tsx` | **Feed into brand components only** | Icon-only mark; not a page. |
| `elapsed_logo` | ✓ | ✓ | 5. Marketing/brand artifact | — | `src/components/shared/brand-logo.tsx`, `brand-logo-2.tsx` | **Feed into brand components only** | Icon + wordmark + "LIVE SLA" badge; not a page. |

Design-doc-only files (not screens, no HTML/PNG): `elapsed_design_system_token_architecture_specification.md` (**authoritative token source**), `elapsed/DESIGN.md` (**secondary reference**, most complete/aligned of the three alt docs), `obsidian_elapsed/DESIGN.md` (alternate brand direction — reference only, not adopted), `alexandria/DESIGN.md` (**discard** — editorial/serif direction contradicts the operational-console brief).

---

## 3. Existing Route Inventory

| Route | Module | Stitch design(s) that apply |
|---|---|---|
| `/dashboard` | `modules/dashboard/dashboard` | `elapsed_dashboard` (target), `escalations_sla_dashboard` (reference only) |
| `/at-risk` | `modules/dashboard/at-risk` | `at_risk_queue`, `mobile_incident_commander_active_runway` (responsive) |
| `/cases` | `modules/cases/case-list` | `cases`, `deterministic_case_explorer` (reference only) |
| `/cases/[caseId]` | `modules/cases/case-detail` | `elapsed_case_detail`, `deterministic_case_timeline` (consolidated in), `mobile_incident_forensic_detail` (responsive) |
| `/settings` | `modules/settings/overview` | `settings` |
| `/settings/integrations`, `/settings/integrations/[provider]` | `modules/settings/integrations`, `integration-detail` | `settings`, `settings_read_only_connections` (reference only) |
| `/settings/members` | `modules/settings/members` | `settings` (nav only; no dedicated mockup) |
| `/settings/monitoring` | `modules/settings/monitoring` | none (no dedicated mockup) |
| `/settings/notifications` | `modules/settings/notifications` | `alerts_escalation_routing_studio` (scoped subset) |
| `/settings/organization` | `modules/settings/organization` | `settings` (nav only) |
| `/settings/profile` | `modules/settings/profile` | `settings` (nav only) |
| `/settings/sla/configuration` | `modules/settings/sla-configuration` | none (no dedicated mockup — out of Stitch package scope, keep current design, apply Phase 0 tokens only) |
| `/onboarding` | `modules/onboarding/onboarding` | `step_1_connect_helpdesk`, `step_2_90_day_backfill_ingestion`, `step_3_connect_issue_tracker` |
| `/onboarding/findings` | `modules/onboarding/findings` | `90_day_backfill_findings` |
| `/internal/concierge/jira-export`, `/internal/concierge/zendesk-export` | `modules/internal/concierge-export` | `concierge_ingestion_pre_sales_audit` (low priority) |
| `/`, `/about`, `/pricing`, `/docs/**` | `modules/marketing/*`, `src/components/docs/*` | none — out of scope, no Stitch marketing/docs mockups exist |
| `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`, `/invite/accept` | `modules/auth/*` | none — out of scope, no Stitch auth mockups exist |

**Pages with no Stitch equivalent** (`/settings/members`, `/settings/monitoring`, `/settings/organization`, `/settings/profile`, `/settings/sla/configuration`, all marketing/docs/auth routes) still receive the **Phase 0 token/typography/spacing update** (so the whole app is visually coherent) but no bespoke layout redesign — apply the new design system's primitives (`Badge`, `Button`, `Table`, `Card`→bordered-panel conventions) mechanically rather than inventing new layouts for them.

---

## 4. Design System Migration

### 4.1 What already matches (no work needed)
- **Fonts**: Hanken Grotesk (`--font-sans`/`--font-display`) + JetBrains Mono (`--font-mono`) are already wired in `globals.css`/root `layout.tsx`, matching the spec exactly.
- **Tabular numerals**: already forced via `font-feature-settings: "tnum" 1, "zero" 1` — matches the spec's numeric-monospace requirement.
- **Dark palette base**: `.dark` in `src/styles/colors.css` already uses Stitch-derived hex values for `--primary` (`#38bdf8`), `--success` (`#10b981`), `--warning` (`#f59e0b`), `--destructive`/danger (`#f43f5e`) — these match the spec's semantic tokens exactly.
- **SLA leg colors**: `--leg-support`, `--leg-engineering`, `--leg-waiting`, `--leg-unknown`, `--clock-running`, `--clock-paused` are a domain concept the Stitch package doesn't define as reusable tokens (it hand-colors `StageHandoffBar` segments per-screen). Per Case C, **keep this token set** — it's existing functionality the Stitch package lacks — and let the new `StageHandoffBar`/`LegBadge` components consume it.

### 4.2 Gaps to close

| Area | Current | Spec target | Action |
|---|---|---|---|
| Surface tiers | Single flat set: `--background` (`#0b1326`), `--card`/`--popover`/`--elevated` all near-identical dark blues, no explicit tier ladder | 4-tier ladder: `--background` (`#060a12`, root canvas) → `--surface` (`#0b1324`) → `--surface-raised` (`#111c34`) → `--surface-overlay` (`#1a2745`), plus `--surface-hover`/`--surface-active` | Add explicit `--surface`, `--surface-raised`, `--surface-overlay` tokens in `.dark`; darken `--background` to the spec's true root-canvas value; re-map `--card`→`--surface-raised`, `--popover`→`--surface-overlay` |
| Foreground hierarchy | `--foreground` + `--muted-foreground` only | 3-tier: `--foreground` / `--foreground-muted` / `--foreground-subtle` | Add `--foreground-subtle` token; audit usages of `--muted-foreground` to see which should split |
| Borders | `--border`/`--border-subtle`/`--border-strong` exist but at low opacity (`#3e484f40` = 25% alpha) | Spec uses solid hex borders (`--border: #1c273c`, `--border-strong: #2d3c59`) with `-subtle` for internal dividers | Reconcile alpha-based borders → solid hex to match spec's crisper hairline look; verify against `screen.png` references before finalizing |
| Semantic status variants | `--success`/`--warning`/`--destructive` each have only a base + `-foreground` | Each semantic color needs `-subtle` (12–15% alpha bg), `-border` (30–40% alpha), `-foreground` variants (5 total per color) | Extend `status-badge.tsx`/`status-styles.ts` token usage — likely as Tailwind utility compositions (`bg-success/10 border-success/30`) rather than new CSS vars, since Tailwind v4 already supports alpha modifiers on any color token |
| Info/neutral semantic colors | No dedicated "info" or "neutral" status token (primary sky doubles as both accent and info; `muted` doubles as neutral) | Spec has 5 explicit roles: success/warning/danger/info/neutral | Confirm sky-as-both-primary-and-info is acceptable (spec does this too) — no new token needed there; add a dedicated neutral/slate status role for "inferred/paused" states if not already covered by `--clock-paused`/`--leg-unknown` |
| Default theme | `next-themes` `defaultTheme="system"` — app can render light by default depending on OS | Spec is **dark-first**; light theme is described as an "export/print view only" | **Open question for product owner** (see §9 Risk Register) — recommend `defaultTheme="dark"` while keeping the toggle, not force-removing light mode |
| Stale token file | `apps/web/src/styles/colors-old.css` exists, unreferenced anywhere in `src/`/`modules/` | N/A | Delete in Phase 0 as part of the token consolidation (directly blocks a clean single source of truth — not unrelated cleanup) |
| Radius scale | Single `--radius: 0.375rem` (6px) base, derived sm/md/lg/xl | Spec: `rounded-sm` 2px, `rounded` 4px, `rounded-md` 6px, `rounded-lg` 8px | Close but not exact — adjust base/derivation so the 4 steps land on 2/4/6/8px |
| Sidebar/header dimensions | shadcn `Sidebar` primitive defaults (verify exact px in Phase 0 audit) | 240px expanded / 64px collapsed sidebar; 52px fixed header | Verify current `--sidebar-width`/`--sidebar-width-icon` CSS vars in `src/components/ui/sidebar.tsx` against spec, adjust if divergent |

### 4.3 Token destination
Per the file's constraint (no `@apply`, one coherent system): keep the existing pattern — **CSS variables in `colors.css`** as the single source of truth, consumed via **Tailwind v4 `@theme` mappings** in `globals.css` (already the established pattern), with **shadcn component-level classes** for structural conventions (border widths, focus rings) and **local component styles only** for one-off numeric-display formatting (e.g. `RunwayCountdown`'s threat-threshold color logic, which is data-driven, not a static token).

---

## 5. Shared Component Plan

From the "at minimum investigate" list in the source prompt, evaluated against what already exists:

**Reuse as-is (already exist, just re-skin via tokens):**
`AppShell` (`src/app/(main)/layout.tsx`), `Sidebar` (`src/components/layout/app-sidebar.tsx`), `StatusBadge` (`src/components/shared/status-badge.tsx`), `DenseDataTable` (`src/components/shared/data-table/*`, TanStack-table based), `EmptyState` (`src/components/shared/empty-state.tsx`), `IntegrationCard` (per-provider cards already in `modules/settings/integrations/csr/*Card.tsx`), `SettingsSection` (`modules/settings/overview` nav-card pattern), `StatTile` (`src/components/shared/stat-tile.tsx`).

**Modify (concept exists, needs the new visual/behavioral contract):**
- `TelemetryHeader` — current sticky header in `(main)/layout.tsx` has a sync-status pill already; extend to match the spec's "live daemon sync status + org badge + Cmd+K omnibar" if command palette is in scope (see below), otherwise keep the simpler current version.
- `CaseRow`/`CaseList` — existing `cases/case-list/csr/columns.tsx` needs the "Dual-Key"/"Leg Allocation" column treatment from the `cases` mockup.
- `StageHandoffBar` — existing `CaseJourney.tsx` is conceptually this; needs the segmented Support→Transit→Engineering→Verification visual treatment.
- `Timeline`/`TimelineEventNode` — existing `ActivityTimeline.tsx` is conceptually this; needs observed/inferred confidence-indicator treatment.
- `RunwayCountdown` — needs to be extracted as a standalone component (currently likely inlined wherever "remaining time"/`remainingMinutes` is rendered in `columns.tsx` and `CommitmentCard.tsx`) so the monospace threat-threshold coloring logic isn't duplicated three times.
- `LegBadge` — small wrapper around `LEG_BG_CLASS` (`src/lib/status-styles.ts`) for consistent leg-colored pills.
- `ConnectionStatus`/`SyncStatus` — partially exists in integrations views and the header sync pill; consolidate into one component if the same concept is currently duplicated.
- `BackfillProgress` — extend existing `useOnboardingBackfill.ts`-driven UI with the new progress/ledger visual treatment.

**Create new (no existing equivalent, and repeated across ≥2 target screens):**
- `CommitmentBadge` — distinct from `StatusBadge` if commitment-specific states (MET/AT RISK/BREACHED per-commitment, as opposed to case-level status) need their own small variant; confirm during Phase 4 whether `CommitmentCard`'s existing inline badge already covers this before creating a new component.
- `ConfidenceIndicator` — new concept (observed vs. inferred correlation confidence) not currently rendered anywhere; needed for case detail + timeline.
- `MetricStrip` — the repeated KPI-tile-row pattern (dashboard, at-risk, cases) — worth extracting if `StatTile` is currently composed ad hoc in 3+ places with duplicated layout markup.
- `AuditMetadata` — small "observed at / actor / hash" metadata line pattern seen across case detail and timeline nodes.

**Do not create (explicitly justified by exclusion, not oversight):**
`CommandPalette` (Cmd+K omnibar) — attractive but not requested by any MVP-in-scope screen's *functional* requirement, only by the header's decorative treatment; flag as a nice-to-have, not a Phase 0 blocker. `Drawer`/`Dialog` — already covered by shadcn `Sheet`/`Dialog` primitives, no new component needed. `ProgressTelemetry`, `AlertRow`, `NotificationStatus` — fold into the scoped-down Phase 8 notifications work rather than building generic reusable primitives for a studio/simulator feature that's explicitly excluded.

---

## 6. Page-by-Page Migration Plan

### Page: Global Foundation (Phase 0)
```
Design:
stitch_elapsed/elapsed_design_system_token_architecture_specification.md
stitch_elapsed/elapsed/DESIGN.md (secondary reference)

Existing route:
N/A — infrastructure only

Existing implementation:
apps/web/src/styles/colors.css, apps/web/src/app/globals.css,
apps/web/src/components/layout/app-sidebar.tsx, apps/web/src/app/(main)/layout.tsx,
apps/web/src/components/ui/* (shadcn primitives)

Data source:
N/A

Current behavior:
Light-by-default (system) theme, flat surface hierarchy, alpha-based borders,
shadcn default sidebar dimensions.

Design target:
Dark-first 4-tier surface ladder, solid hairline borders, 240/64px sidebar,
52px header, reconciled radius scale, extended semantic status variants.

Visual changes:
- Add --surface / --surface-raised / --surface-overlay tiers to .dark
- Add --foreground-subtle
- Reconcile border alpha → solid hex per spec
- Reconcile radius scale to 2/4/6/8px
- Verify/adjust sidebar (240/64px) and header (52px) dimensions
- Delete unreferenced apps/web/src/styles/colors-old.css

Shared components:
- AppSidebar, (main)/layout.tsx header, all shadcn ui/ primitives (inherit tokens automatically)

New components:
- None (token/infra only)

Business logic changes:
NONE

Potential risks:
- defaultTheme default-dark decision affects every screenshot in every later phase — must be resolved first (see Risk Register)
- Alpha→solid border change may visually affect every existing page before its own migration phase lands — acceptable since it's strictly closer to target, but note in PR description

Responsive requirements:
- Confirm sidebar collapse breakpoint matches existing use-mobile.ts hook behavior

Validation:
- visual diff of an unmigrated page before/after (confirm no breakage, only token shift)
- typecheck / lint / build
- manual toggle of light/dark
```

### Page: Dashboard (Phase 1)
```
Design:
stitch_elapsed/elapsed_dashboard/ (target)
stitch_elapsed/escalations_sla_dashboard/ (reference only, reject shell)

Existing route:
apps/web/src/app/(main)/dashboard/page.tsx

Existing implementation:
apps/web/modules/dashboard/dashboard/ssr/Dashboard.tsx
apps/web/modules/dashboard/dashboard/csr/DashboardView.tsx, columns.tsx,
  analytics/BreachesByStageChart.tsx, BreachesOverTimeChart.tsx, SlaComplianceChart.tsx,
  analytics/ProjectAnalyticsSection.tsx

Data source:
src/actions/dashboard.ts (server-fetched, passed as props)
SlaAutoRefreshProvider (live polling)

Current behavior:
Card-based KPI layout + Recharts analytics section + mini at-risk/other-cases tables.

Design target:
KPI strip (Breached / SLA Compliance / Aging in Engineering / Total Escalated) in
bordered-panel style, dense tables, CSV export affordance.

Visual changes:
- Convert KPI cards to bordered MetricStrip/StatTile treatment (no heavy shadows)
- Apply DenseDataTable styling to mini tables
- Recharts: re-theme colors to new --chart-* tokens, verify axis/gridline contrast in dark mode

Shared components:
- AppShell, TelemetryHeader, MetricStrip (new), DenseDataTable, StatusBadge

New components:
- None beyond MetricStrip (shared plan §5)

Business logic changes:
NONE

Potential risks:
- Recharts theming in dark mode (low-contrast gridlines is a common pitfall)
- Live polling interaction with re-render/flicker under new dense styling

Responsive requirements:
- Reference mobile_incident_commander_active_runway for stacked-card fallback (full mobile pass is Phase 11; only ensure no regression now)

Validation:
- screenshot comparison against elapsed_dashboard/screen.png
- typecheck / lint / tests (test/dashboard-breaches.test.ts must still pass)
- manual: live update still fires, CSV export still works
```

### Page: At-Risk Queue (Phase 2)
```
Design:
stitch_elapsed/at_risk_queue/

Existing route:
apps/web/src/app/(main)/at-risk/page.tsx

Existing implementation:
apps/web/modules/dashboard/at-risk/ssr/AtRisk.tsx
apps/web/modules/dashboard/at-risk/csr/AtRiskView.tsx, AtRiskList.tsx, columns.tsx

Data source:
src/actions/at-risk.ts

Current behavior:
Full table: customer/requester/case/ticket/commitment/status/remaining-time/leg columns.

Design target:
Risk-tier grouped list (Immediate Threat / Elevated Risk) with a locus-breakdown widget
and severity/locus filters; RunwayCountdown live monospace timers.

Visual changes:
- Evaluate whether risk-tier grouping (new UX structure) should be adopted or whether
  the existing flat sortable table + new visual skin is sufficient — confirm with
  product before restructuring grouping logic (Case A vs. a real UX change)
- Apply RunwayCountdown component to remaining-time column
- Apply LegBadge to leg column

Shared components:
- DenseDataTable, StatusBadge, RunwayCountdown (new), LegBadge (new)

New components:
- None beyond shared plan

Business logic changes:
NONE — sorting/filtering/URL-state semantics unchanged regardless of grouping decision

Potential risks:
- Risk-tier grouping is a structural UX change disguised as a visual mockup; treat as
  a product decision, not an automatic adoption (Case A applies to color/spacing, not
  necessarily to re-grouping semantics)

Responsive requirements:
- Preserve filter/sort/URL state on mobile stack (Phase 11 detail)

Validation:
- screenshot comparison
- typecheck / lint / tests
- manual: filtering, sorting, URL state (?sort=, ?filter=) unchanged, live countdowns tick
```

### Page: Cases / Case List (Phase 3)
```
Design:
stitch_elapsed/cases/ (target)
stitch_elapsed/deterministic_case_explorer/ (reference only, reject shell)

Existing route:
apps/web/src/app/(main)/cases/page.tsx

Existing implementation:
apps/web/modules/cases/case-list/ssr/CaseList.tsx
apps/web/modules/cases/case-list/csr/CaseListView.tsx, columns.tsx

Data source:
src/actions/cases.ts

Current behavior:
Search + export + refresh table shell.

Design target:
Dense operational ledger: stat tiles (Total/Active/Linked/Unlinked), "Dual-Key" priority
column, "Leg Allocation (Supp↔Eng)" column, priority/link/status filter bar.

Visual changes:
- Add stat-tile strip above table
- Redesign priority column as dual-key (Zendesk # + Jira #) monospace pairing
- Add leg-allocation mini-bar per row (reuses StageHandoffBar in compact form)
- Apply filter bar pattern consistent with At-Risk Queue's filter bar (shared component)

Shared components:
- DenseDataTable, StatusBadge, LegBadge, MetricStrip, FilterBar (confirm if this already
  exists in data-table/ or needs light extraction)

New components:
- None beyond shared plan

Business logic changes:
NONE

Potential risks:
- "Linked/Unlinked" stat requires correlation-status data already available? confirm
  via src/actions/cases.ts before assuming the field exists (Case F if not — mark as
  blocker rather than fabricating)

Responsive requirements:
- Table → stacked cards pattern (Phase 11)

Validation:
- screenshot comparison
- typecheck / lint / tests
- manual: search, export, refresh, filters unchanged
```

### Page: Case Detail (Phase 4)
```
Design:
stitch_elapsed/elapsed_case_detail/ (target)
stitch_elapsed/mobile_incident_forensic_detail/ (responsive reference, Phase 11)

Existing route:
apps/web/src/app/(main)/cases/[caseId]/page.tsx

Existing implementation:
apps/web/modules/cases/case-detail/ssr/CaseDetail.tsx
apps/web/modules/cases/case-detail/csr/CaseDetailView.tsx, CaseHeader.tsx, CaseJourney.tsx,
  CommitmentSummary.tsx, CommitmentCard.tsx, ActivityTimeline.tsx, ConversationThread.tsx,
  LinkedRecords.tsx

Data source:
src/actions/cases.ts (case detail fetch)

Current behavior:
Header with customer/requester/priority/state, leg journey bar, commitment accordion
cards, activity timeline feed, conversation thread, linked records panel.

Design target:
Header w/ dual case IDs, "LIVE TELEMETRY STREAM" section, commitment cards showing
MET/AT RISK per-commitment with runway/headroom, dense audit-style layout.

Visual changes:
- CaseHeader: add dual-ID (Zendesk/Jira) monospace breadcrumb treatment
- CommitmentCard: apply CommitmentBadge (or confirm existing badge suffices) +
  RunwayCountdown for headroom display
- CaseJourney → StageHandoffBar visual treatment (Support/Transit/Engineering/Verification)
- ActivityTimeline → TimelineEventNode treatment with ConfidenceIndicator (observed vs
  inferred) — new data field, confirm availability (Case F if missing)
- Do NOT change calculation logic behind runway/headroom/leg timing values

Shared components:
- StatusBadge, CommitmentBadge (new, confirm need first), RunwayCountdown, StageHandoffBar,
  TimelineEventNode, ConfidenceIndicator (new), AuditMetadata (new)

New components:
- ConfidenceIndicator, AuditMetadata (per shared plan)

Business logic changes:
NONE

Potential risks:
- ConfidenceIndicator requires an "observed vs inferred" confidence field per event —
  verify this exists in current event/timeline data model before designing the UI
  around it; if absent, mark DESIGN ONLY / NOT CURRENTLY IMPLEMENTED (Case B) and
  exclude from this phase rather than fabricating a confidence score
- This is the highest-risk page for visual/behavioral regressions given its component count

Responsive requirements:
- Full mobile treatment deferred to Phase 11; do not regress current mobile behavior now

Validation:
- screenshot comparison against elapsed_case_detail/screen.png
- typecheck / lint / tests (test/case-detail-*.test.ts — 4 files — must still pass)
- manual: commitment accordion, conversation thread scroll, linked records links
```

### Page: Deterministic Timeline (Phase 5 — consolidation, not a new page)
```
Design:
stitch_elapsed/deterministic_case_timeline/

Existing route:
N/A — consolidates into apps/web/src/app/(main)/cases/[caseId]/page.tsx

Existing implementation:
apps/web/modules/cases/case-detail/csr/CaseJourney.tsx, ActivityTimeline.tsx

Current behavior:
Covered under Phase 4 (CaseJourney + ActivityTimeline).

Design target:
Segmented per-leg breakdown with % + duration per leg ("Support Leg 12.4% / 42m"),
"DETERMINISTIC LINK VERIFIED" badge, handoff-transition visual marker.

Visual changes:
- Add per-leg % + duration labels to StageHandoffBar segments (already built in Phase 4)
- Add a "link verified"/correlation-confidence badge near the case header

Shared components:
- StageHandoffBar, TimelineEventNode, ConfidenceIndicator (all from Phase 4)

New components:
- None — this phase is validation that Phase 4's components fully cover this mockup,
  not new build work

Business logic changes:
NONE

Potential risks:
- Risk of accidentally building two parallel timeline implementations if this is
  treated as a separate page instead of a Phase-4 component refinement — explicitly
  avoid that

Responsive requirements:
- Inherits Phase 4/Phase 11

Validation:
- Re-run Phase 4's validation checklist; confirm deterministic_case_timeline/screen.png
  is now represented by the same case-detail page, no separate route created
```

### Page: Settings / Integrations (Phase 6)
```
Design:
stitch_elapsed/settings/ (target)
stitch_elapsed/settings_read_only_connections/ (reference only, reject shell)

Existing route:
apps/web/src/app/(main)/settings/page.tsx
apps/web/src/app/(main)/settings/integrations/page.tsx
apps/web/src/app/(main)/settings/integrations/[provider]/page.tsx

Existing implementation:
apps/web/modules/settings/overview/ssr/SettingsOverview.tsx, csr/SettingsOverviewView.tsx
apps/web/modules/settings/integrations/ssr/Integrations.tsx,
  csr/IntegrationsView.tsx, GithubCard.tsx, IntercomCard.tsx, JiraCard.tsx, LinearCard.tsx,
  SlackCard.tsx, ZendeskCard.tsx, DisconnectButton.tsx, WebhookInfo.tsx
apps/web/modules/settings/integration-detail/ssr/IntegrationDetail.tsx

Data source:
src/actions/integrations.ts, src/actions/organization.ts

Current behavior:
Settings landing nav cards; per-provider connect/disconnect cards with scope display.

Design target:
Dense settings sub-nav, provider cards with "AUTHORIZATION VERIFIED"/"Zero write tokens
provisioned by design"/"Ingested Scopes" treatment.

Visual changes:
- Adopt "zero write-back" badge/copy verbatim from settings_read_only_connections
  (Case A — visual/copy difference, use Stitch language; this also matches the
  Product Language section's neutral, precision-oriented tone)
- Apply bordered-panel card treatment consistently across provider cards

Shared components:
- IntegrationCard (modify), StatusBadge, SettingsSection

New components:
- None

Business logic changes:
NONE — preserve read-only integration model exactly; do not add write scopes

Potential risks:
- None significant; this page is largely a skin pass

Responsive requirements:
- Standard stacking, no dedicated mobile mockup exists for this page

Validation:
- screenshot comparison
- typecheck / lint / tests (test/integration-disconnect-routes.test.ts)
- manual: connect/disconnect flows unchanged
```

### Page: Onboarding / Backfill (Phase 7)
```
Design:
stitch_elapsed/step_1_connect_helpdesk/
stitch_elapsed/step_2_90_day_backfill_ingestion/
stitch_elapsed/step_3_connect_issue_tracker/
stitch_elapsed/90_day_backfill_findings/ (target)
stitch_elapsed/zero_config_ingestion_backfill/ (excluded — internal pipeline view)

Existing route:
apps/web/src/app/onboarding/page.tsx
apps/web/src/app/onboarding/findings/page.tsx

Existing implementation:
apps/web/modules/onboarding/onboarding/ssr/Onboarding.tsx,
  csr/OnboardingFlow.tsx, OnboardingProgress.tsx, useOnboardingBackfill.ts
apps/web/modules/onboarding/findings/ssr/Findings.tsx, csr/FindingsView.tsx

Data source:
src/actions/onboarding.ts, src/actions/findings.ts

Current behavior:
Multi-step connect wizard with stepper; post-backfill findings report.

Design target:
3-step indicator (01/02/03), live "Telemetry Inspection Stream" terminal-style log
during connect/backfill, stat cards + time-dissection chart on findings.

Visual changes:
- OnboardingProgress → spec's step-indicator treatment
- Add terminal-log visual style to backfill progress (data already exists via
  useOnboardingBackfill.ts; this is a display treatment, not a new data source)
- FindingsView → stat-card + diagnostic-chart treatment per 90_day_backfill_findings

Shared components:
- BackfillProgress (modify), MetricStrip

New components:
- None beyond shared plan

Business logic changes:
NONE — zero-configuration principle preserved; no new required user input

Potential risks:
- Terminal-log styling for a real progress stream needs care not to imply more
  granularity/data than is actually being surfaced (avoid fabricating log lines)

Responsive requirements:
- Standard stacking; no dedicated mobile mockup for onboarding

Validation:
- screenshot comparison against all 4 target screens
- typecheck / lint / tests
- manual: full onboarding flow connect → backfill → findings → dashboard handoff
```

### Page: Notifications (Phase 8 — scoped down from "Alerts Studio")
```
Design:
stitch_elapsed/alerts_escalation_routing_studio/ (channel cards + dispatch ledger ONLY)

Existing route:
apps/web/src/app/(main)/settings/notifications/page.tsx

Existing implementation:
apps/web/modules/settings/notifications/ssr/Notifications.tsx,
  csr/NotificationsView.tsx, EmailNotificationsCard.tsx

Data source:
src/actions/notifications.ts

Current behavior:
Email notification settings card.

Design target (scoped):
Channel status cards (Slack) in bordered treatment; do NOT build the rule-logic
builder or live dispatch simulator (excluded per MVP boundaries — "generic workflow
engine").

Visual changes:
- Re-skin EmailNotificationsCard with bordered-panel treatment
- If a Slack channel-status card doesn't exist yet, evaluate whether it belongs here
  at all — current MVP list only mentions "Slack notifications" as a capability, not
  a dedicated settings card; confirm before adding new UI surface

Shared components:
- StatusBadge, SettingsSection

New components:
- None

Business logic changes:
NONE — preserve existing notification behavior exactly; do not invent a rule engine

Potential risks:
- Scope creep risk is highest on this page — the mockup's most visually interesting
  parts (rule builder, simulator) are exactly the parts explicitly excluded

Responsive requirements:
- Standard stacking

Validation:
- typecheck / lint / tests
- manual: existing notification toggles unchanged
```

### Pages explicitly excluded from active migration (documented, not built)
`escalations_sla_dashboard`, `deterministic_case_explorer`, `settings_read_only_connections` (duplicate shells — superseded by Phases 1/3/6 respectively), `coverage_historical_audit`, `executive_sla_audit_qbr_presentation`, `audit_report_dispute_package_builder`, `deterministic_correlation_linking_hygiene_studio`, `replay_debugger_mathematical_engine`, `zero_config_ingestion_backfill`, `concierge_ingestion_pre_sales_audit` (optional/low-priority, internal-only), `mobile_on_call_roster_escalation_bridge`, `mobile_triage_clue_remediation`, `mobile_escalation_alerts_push_log` (deferred pending an alerts feature), `sla_watchtower_continuity_logo`, `elapsed_logo` (feed brand components only, no page work).

---

## 7. Migration Order

1. **Phase 0** — Global foundation (tokens, fonts confirmed, sidebar/header dimensions, base primitives)
2. **Phase 1** — Dashboard (reference implementation for the system)
3. **Phase 2** — At-Risk Queue
4. **Phase 3** — Cases (Case List)
5. **Phase 4** — Case Detail
6. **Phase 5** — Timeline consolidation (within Case Detail, no new route)
7. **Phase 6** — Settings / Integrations
8. **Phase 7** — Onboarding / Backfill / Findings
9. **Phase 8** — Notifications (scoped-down alerts)
10. **Phase 9 / 10** — Audit, Reporting, Replay/Diagnostics: **excluded**, revisit post-MVP-validation only
11. **Phase 11** — Mobile responsive pass across Dashboard, At-Risk, Case Detail (extract patterns from the `mobile_*` mockups; no separate mobile app)

Do not start Phase N+1 while Phase N is structurally broken (per Fourteenth Task in the source prompt).

---

## 8. Dependency Graph

```
Design Tokens (Phase 0)
    ↓
App Shell / Sidebar / Header (Phase 0)
    ↓
Shared primitives: StatusBadge, DenseDataTable, RunwayCountdown, LegBadge,
StageHandoffBar, MetricStrip  (built incrementally, first used in Phase 1)
    ↓
Dashboard (Phase 1) ──────────────┐
    ↓                             │ (MetricStrip, StatusBadge reused)
At-Risk Queue (Phase 2)           │
    ↓                             │
Cases / Case List (Phase 3)       │
    ↓                             │
Case Detail (Phase 4) ← consolidates → Timeline (Phase 5, same page)
    ↓ (ConfidenceIndicator, AuditMetadata introduced here, reused nowhere upstream)
Settings / Integrations (Phase 6)
    ↓
Onboarding / Backfill / Findings (Phase 7)  (reuses MetricStrip, BackfillProgress)
    ↓
Notifications (Phase 8, scoped)
    ↓
Mobile responsive pass (Phase 11) — depends on Phases 1,2,4 being visually stable
```

Note: Settings/Onboarding/Notifications (Phases 6–8) do not structurally depend on Case Detail (Phase 4) beyond shared Phase-0 primitives — they could be reordered earlier if there's a business reason to ship the case-detail redesign later, but the recommended order above matches the source prompt's phase numbering and prioritizes the highest-traffic operational pages first.

---

## 9. Risk Register

**Visual risks**
- Two divergent Stitch shells ("Elapsed" vs "Watchtower") could cause inconsistent adoption if different phases are implemented by different people without this document as a reference — mitigate by treating the "Elapsed" shell screens as canonical and Watchtower screens as reference-only throughout.
- Recharts dark-mode theming (dashboard analytics) is a common source of low-contrast/illegible charts — needs explicit visual QA, not just a token swap.
- Border-alpha → solid-hex reconciliation (§4.2) will visibly shift every unmigrated page the moment Phase 0 lands, before those pages get their own dedicated pass.

**Behavior risks**
- Risk-tier grouping on At-Risk Queue and dual-key/leg-allocation columns on Cases are structural UX changes wearing a "visual mockup" costume — must be confirmed as intentional product decisions, not auto-adopted as if they were pure styling.
- Terminal-log-style backfill progress display risks implying more granular telemetry than actually exists — must be driven by real `useOnboardingBackfill.ts` data only.

**Routing risks**
- None identified — no route renames are proposed; `deterministic_case_timeline` explicitly avoids becoming a new route.

**State-management risks**
- Low — the app has no client global-state library to conflict with; all new components should stay props-driven, consistent with existing convention.

**Responsive risks**
- Current sidebar collapse/mobile breakpoint behavior (`use-mobile.ts`) needs to be reconciled with the 5 `mobile_*` mockups' apparent breakpoint assumptions before Phase 11 — not yet verified in this audit.

**Performance risks**
- None significant identified; no new data-fetching patterns are introduced.

**Data availability risks (Case F candidates — need explicit confirmation before Phase 4/5)**
- `ConfidenceIndicator` (observed vs. inferred event confidence) — verify field exists in event/timeline data model.
- Cases-page "Linked/Unlinked" stat tile — verify correlation-status aggregate is available from `src/actions/cases.ts`.
- If either is missing, mark `DESIGN ONLY / NOT CURRENTLY IMPLEMENTED` and ship the page without that element rather than fabricating data.

**Duplicated component risks**
- Highest risk is a second `Timeline`/`CaseJourney` implementation splitting from `deterministic_case_timeline` being treated as a standalone route — explicitly prevented by Phase 5's "consolidation, not new page" framing.

**Open product decisions (not decided in this document, need sign-off before implementation)**
1. Should `next-themes` `defaultTheme` change from `"system"` to `"dark"` to match the "dark-first" brief? (Recommendation: yes, keep the toggle.)
2. Should At-Risk Queue adopt risk-tier grouping (Immediate Threat / Elevated Risk) as a structural change, or stay a flat sortable table with new styling only?
3. Should a Slack channel-status card be added to `/settings/notifications`, or is email-only sufficient for now?

---

## 10. Validation Checklist

Per page, before marking a phase complete:

- [ ] TypeScript: `pnpm typecheck` (or project equivalent) passes
- [ ] ESLint passes
- [ ] Production build succeeds for the affected route
- [ ] All existing tests touching the page's module still pass unmodified (no test weakening/deletion)
- [ ] Screenshot comparison against the corresponding Stitch `screen.png` (layout, typography, color, component treatment, interaction states: hover/focus/selected/active/loading/disabled/error/empty)
- [ ] Manual verification: navigation, filters, sorting, URL state, dialogs/dropdowns, forms, loading/error/empty states, real-time counters/countdowns/timestamps all behave identically to pre-migration
- [ ] Responsive check at the sidebar-collapse breakpoint (full mobile check deferred to Phase 11 except where regression is possible now)
- [ ] No business logic, API contract, database access, or provider-adapter files touched in the diff

---

## 11. Recommended Git / PR Strategy

One PR per phase, matching the branch names already implied by the source prompt, adapted to this repo's existing convention (recent history shows `phase/<n>-<slug>` branches, e.g. `phase/5-team-account-management`):

```
phase/0-ui-foundation
phase/1-ui-dashboard
phase/2-ui-at-risk
phase/3-ui-cases
phase/4-ui-case-detail
phase/5-ui-timeline-consolidation
phase/6-ui-settings-integrations
phase/7-ui-onboarding-backfill
phase/8-ui-notifications
phase/11-ui-mobile-responsive
```

Each PR description should state: which Stitch screen(s) it targets, which are explicitly excluded/deferred and why, and a screenshot pair (before/after) for the reviewer. No AI-generated attribution footers in commits or PR descriptions.

---

## Final Note

Per the source prompt's Final Requirement: **this is the end of the audit/planning phase.** No files have been modified, no components created, no routes changed. The next step is to execute Phase 0 (global foundation) alone, get it reviewed, and only then proceed page-by-page through Phase 11 — waiting for explicit go-ahead on each phase, and for sign-off on the three open product decisions in §9 before Phases 2, 3, and 8 respectively.

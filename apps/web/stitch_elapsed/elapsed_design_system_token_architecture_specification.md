# Elapsed Design System & Component Token Architecture
*Production Specification for Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, and Radix UI*

---

## 1. Foundations & Philosophy
**North Star:** *"One honest clock across the handoff."*
Elapsed is an operational metrology platform bridging Helpdesk (Zendesk) and Engineering Trackers (Jira/Linear). The interface eliminates finger-pointing and blame, replacing it with transparent, immutable time accounting across stages.

### Core Tenets:
- **Observability & Infrastructure Caliber:** Precise, calm, authoritative, neutral surfaces (closer to Honeycomb/Datadog than marketing dashboards).
- **Non-Attributive Terminology:** Never use "fault", "blame", or "responsible team". Use "Support Leg", "Engineering Leg", "Waiting for Customer Leg", "Unattributed Time", "Time by Stage", "Runway Remaining".
- **Deterministic Truth & Exposed Uncertainty:** Highlighting whether an event is observed (raw timestamp) vs inferred (PR pattern link), with confidence indicators.
- **Tabular Precision:** Tabular monospace digits for all durations, timestamps, countdowns, and commitment thresholds.

---

## 2. Color System & Semantic Tokens

### Color Palette (Tailwind CSS Variables Mapping)

#### Dark Theme (Default Operational Canvas)
```css
:root[class~="dark"] {
  /* Surfaces & Backgrounds */
  --background: 222 47% 5%;          /* #060a12 - lowest root canvas */
  --surface: 222 47% 9%;             /* #0b1324 - primary container */
  --surface-raised: 222 44% 13%;      /* #111c34 - cards, table headers */
  --surface-overlay: 222 40% 18%;     /* #1a2745 - popovers, dialogs, dropdowns */
  --surface-hover: 222 36% 22%;       /* #233356 - row hover, interactive states */
  --surface-active: 222 35% 26%;      /* #2b3d64 - pressed state */

  /* Text & Foreground */
  --foreground: 210 40% 98%;          /* #f8fafc - high emphasis primary headers */
  --foreground-muted: 215 20% 72%;    /* #94a3b8 - body copy, secondary labels */
  --foreground-subtle: 215 16% 50%;   /* #64748b - captions, disabled, table metadata */

  /* Borders & Dividers */
  --border: 220 30% 18%;              /* #1c273c - standard hairline border (1px) */
  --border-strong: 217 33% 26%;       /* #2d3c59 - active card borders, focus rings */
  --border-subtle: 220 35% 12%;       /* #101827 - internal table dividers */

  /* Brand & Primary (Operational Cyan-Sky Accent) */
  --primary: 199 89% 48%;             /* #0ea5e9 - primary action, active selection */
  --primary-hover: 199 95% 58%;       /* #38bdf8 - hovered button, link highlight */
  --primary-foreground: 222 47% 7%;   /* #080e1a - high-contrast label on primary */
  --primary-subtle: 199 89% 48% / 15%;/* tinted pill background */

  /* Semantic Statuses (WCAG AA Compliant on Dark Surface) */
  /* 1. On Track / Met (Emerald Restrained) */
  --success: 158 64% 52%;             /* #10b981 */
  --success-subtle: 158 64% 52% / 12%;
  --success-border: 158 64% 52% / 30%;
  --success-foreground: 152 76% 80%;

  /* 2. At Risk / Warning (Amber Warning) */
  --warning: 38 92% 50%;              /* #f59e0b */
  --warning-subtle: 38 92% 50% / 12%;
  --warning-border: 38 92% 50% / 35%;
  --warning-foreground: 48 96% 76%;

  /* 3. Breached / Critical (Rose Deficit) */
  --danger: 350 89% 60%;              /* #f43f5e */
  --danger-subtle: 350 89% 60% / 14%;
  --danger-border: 350 89% 60% / 40%;
  --danger-foreground: 350 100% 88%;

  /* 4. Info / Active Stage (Sky Telemetry) */
  --info: 201 94% 56%;                /* #38bdf8 */
  --info-subtle: 201 94% 56% / 12%;
  --info-border: 201 94% 56% / 30%;
  --info-foreground: 199 89% 82%;

  /* 5. Neutral / Unassigned / Inferred */
  --neutral-stage: 215 16% 47%;       /* #64748b */
  --neutral-subtle: 215 16% 47% / 12%;
}
```

#### Light Theme (Export / Report / Print View)
```css
:root[class~="light"] {
  --background: 210 20% 98%;          /* #f8fafc */
  --surface: 0 0% 100%;               /* #ffffff */
  --surface-raised: 210 20% 96%;      /* #f1f5f9 */
  --surface-overlay: 0 0% 100%;
  --surface-hover: 210 16% 93%;       /* #e2e8f0 */
  --border: 214 32% 88%;              /* #cbd5e1 */
  --border-strong: 215 25% 75%;
  --foreground: 222 47% 11%;          /* #0f172a */
  --foreground-muted: 215 16% 38%;    /* #475569 */
  --foreground-subtle: 215 14% 55%;   /* #64748b */
  --primary: 200 98% 39%;             /* #0284c7 */
  --primary-foreground: 0 0% 100%;
  --success: 160 84% 33%;             /* #059669 */
  --warning: 32 95% 44%;              /* #d97706 */
  --danger: 347 77% 50%;              /* #e11d48 */
}
```

---

## 3. Typography Scale & Hierarchy

| Role | Size / Rem | Weight | Line Height | Letter Spacing | CSS Utility | Usage Example |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Display** | 30px / 1.875rem | 700 SemiBold | 36px / 1.2 | -0.025em | `text-2xl font-bold tracking-tight` | Landing headline, Audit summary |
| **Page Title** | 22px / 1.375rem | 600 SemiBold | 28px / 1.3 | -0.02em | `text-xl font-semibold tracking-tight` | "At Risk Queue", "Case #ZD-8921" |
| **Section Title** | 16px / 1.0rem | 600 SemiBold | 22px / 1.4 | -0.01em | `text-base font-semibold` | "Time by Stage Breakdown", "Audit Logs" |
| **Card / Widget Title**| 13px / 0.8125rem | 600 SemiBold | 18px / 1.3 | 0.01em | `text-[13px] font-semibold uppercase tracking-wider text-muted-foreground` | "BURNING RUNWAY", "COMMITTED TARGET" |
| **Body (Standard)** | 14px / 0.875rem | 400 Regular | 20px / 1.4 | 0em | `text-sm text-foreground` | Descriptions, table cell content |
| **Body Small** | 12px / 0.75rem | 400 Regular | 16px / 1.35 | 0em | `text-xs text-muted-foreground` | Timestamps, secondary metadata |
| **Caption / Badge** | 11px / 0.6875rem | 600 SemiBold | 14px / 1.25 | 0.04em | `text-[11px] font-semibold uppercase tracking-wider` | Status badges, dual-keys |
| **Numeric Monospace** | 13px / 0.8125rem | 500 Medium | 18px / 1.3 | 0em | `font-mono tabular-nums text-sm` | `04h 12m`, `83.1%`, `00:35:09` |
| **Monospace Headline**| 24px / 1.5rem | 700 Bold | 28px / 1.2 | -0.02em | `font-mono tabular-nums text-2xl font-bold` | Main countdown timer in triage |

---

## 4. Spacing, Grid & Layout Metrics (8px Scale)
- **Base Grid:** 8px (`0.5rem`). Micro increments: 2px (`0.125rem`), 4px (`0.25rem`).
- **Sidebar Width:** 240px (Expanded), 64px (Collapsed).
- **Header Height:** 52px fixed.
- **Page Container Padding:** `p-6` (24px) or `p-8` (32px).
- **Component Row Heights:**
  - Table Row: `h-11` (44px) default, `h-9` (36px) dense mode.
  - Form Input: `h-9` (36px) compact, `h-10` (40px) standard.
  - Buttons: Small `h-8` (32px), Medium `h-9` (36px), Large `h-10` (40px).
  - Badge Height: `h-5` (20px) or `h-6` (24px).
- **Corner Radii:**
  - `rounded-sm`: 2px (table pills, monospace tags)
  - `rounded`: 4px (inputs, buttons, badges)
  - `rounded-md`: 6px (cards, dropdown menus, modals)
  - `rounded-lg`: 8px (outer container boundaries)

---

## 5. Component Library Mapping (shadcn/ui + Radix UI)

### 1. Navigation Components
- `<Sidebar />`: Collapsible with organizational switcher, grouped sections (`Core Navigation`, `Operations`, `Governance`), active indicator border-left `border-primary`.
- `<Breadcrumb />`: Monospace ticket links `#ZD-8921 > ENG-4102 > Continuous Timeline`.
- `<TelemetryHeader />`: Global top bar with live daemon status (`Sync Active: Zendesk • Jira`), organization badge, and `Cmd+K` omnibar.

### 2. Status Badge System (With Non-Color Accessible Cues)
Every status includes a distinct geometric symbol or iconography:
- **On Track:** `●` solid dot + text label (`bg-emerald-500/10 text-emerald-400 border-emerald-500/30`)
- **At Risk:** `▲` solid warning triangle + text label (`bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse-subtle`)
- **Breached:** `✕` cross icon + text label (`bg-rose-500/10 text-rose-400 border-rose-500/30`)
- **Met:** `✓` checkmark + duration (`bg-emerald-500/10 text-emerald-300 border-emerald-500/30`)
- **Certain (Link):** `🔗` link icon + `Certain (100% Deterministic)`
- **Inferred (Link):** `⚯` pattern match + `Inferred (PR Regex)`

### 3. Continuous Metrology & Stage Leg Components
- `<StageHandoffBar />`: Horizontal segmented bar representing:
  - `Support Leg (ZD)` -> `Transit Backlog (Jira unassigned)` -> `Engineering Leg (Jira WIP)` -> `Verification Leg`.
  - Proportional widths with time labels, target line marker, and remaining runway indicator.
- `<RunwayCountdown />`: Monospace live countdown (`00:35:09 remaining`) featuring color-coded threat thresholds (< 1h critical rose, 1-2.5h amber, > 2.5h slate).
- `<TimelineEventNode />`: Vertical audit node indicating:
  - Observed raw timestamp (`2024-10-18 14:32:01 UTC`)
  - Actor (`Zendesk Webhook`, `Engineer (D. Kostov)`, `Customer`)
  - State transition (`Pending Engineering -> In Progress`)
  - Calculated impact on continuous customer SLA clock.

### 4. Dense Data Table Components
- Header with sorting direction, column filtering, and fixed monospace column widths.
- Row states: Default, Hover (`bg-surface-hover`), Selected (`bg-primary-subtle border-l-2 border-primary`), Breached Alert highlight.

---

## 6. Implementation Code Snippets (React + Tailwind)
Standardized helper components and classes for developers implementing the Figma specs in Next.js 14 App Router.
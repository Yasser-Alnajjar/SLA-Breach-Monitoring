---
name: Elapsed
colors:
  surface: '#0b1324'
  surface-dim: '#0b1324'
  surface-bright: '#31394c'
  surface-container-lowest: '#060e1f'
  surface-container-low: '#141b2d'
  surface-container: '#181f31'
  surface-container-high: '#222a3c'
  surface-container-highest: '#2d3547'
  on-surface: '#dbe2fa'
  on-surface-variant: '#bdc8d1'
  inverse-surface: '#dbe2fa'
  inverse-on-surface: '#293043'
  outline: '#87929a'
  outline-variant: '#3e484f'
  surface-tint: '#7bd0ff'
  primary: '#8ed5ff'
  on-primary: '#00354a'
  primary-container: '#38bdf8'
  on-primary-container: '#004965'
  inverse-primary: '#00668a'
  secondary: '#b7c6ee'
  on-secondary: '#213050'
  secondary-container: '#384668'
  on-secondary-container: '#a6b5dc'
  tertiary: '#56e5a9'
  on-tertiary: '#003824'
  tertiary-container: '#30c88f'
  on-tertiary-container: '#004e34'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c4e7ff'
  primary-fixed-dim: '#7bd0ff'
  on-primary-fixed: '#001e2c'
  on-primary-fixed-variant: '#004c69'
  secondary-fixed: '#d9e2ff'
  secondary-fixed-dim: '#b7c6ee'
  on-secondary-fixed: '#0a1b3a'
  on-secondary-fixed-variant: '#384668'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0b1324'
  on-background: '#dbe2fa'
  surface-variant: '#2d3547'
typography:
  display:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.025em
  display-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: -0.005em
  body-base:
    fontFamily: Hanken Grotesk
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 19px
    letterSpacing: 0em
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  body-xs:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 15px
    letterSpacing: 0.01em
  label-mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
  label-mono-base:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0em
  label-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  label-mono-xs:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-dense: 0.5rem
  margin: 1.5rem
  margin-mobile: 0.75rem
  space-3xs: 0.125rem
  space-2xs: 0.25rem
  space-xs: 0.375rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
  space-3xl: 3rem
---

## Brand & Style

This design system establishes a high-density, mission-critical operational UI engineered specifically for continuous SLA metrology and support infrastructure observability. It rejects decorative SaaS fluff, saturated "AI purple" gradients, and low-information-density consumer patterns. Instead, it adopts the visual vocabulary of mission control consoles, precision telemetry, and forensic audit systems—reminiscent of Datadog, Honeycomb, and Stripe's internal engineering platforms.

### Core Character & Atmosphere
- **Forensic Precision:** Visual hierarchy emphasizes exact timestamps, remaining budgets, microsecond-accurate timeline handoffs, and deterministic state transitions. Every component prioritizes rapid visual scanning during active incident responses and high-stakes contractual reviews.
- **Dark-First Structural Rigor:** While dual-themed to serve daytime operations, the foundational execution is calibrated for multi-monitor dark environments, reducing ocular fatigue through deeply balanced slate-blue baselines, strict 1px boundary lines, and controlled luminous accents.
- **Instrumental Restraint:** Color is never purely decorative; it functions strictly as semantic status instrumentation (safe, at-risk, breached, informational, deactivated). Surfaces recede, giving prominence to tabular numbers, progress chronometers, and operational delta graphs.

### Movement & Micro-Interactions
Micro-interactions are instantaneous and mechanical. Transitions rely on strict `cubic-bezier(0.16, 1, 0.3, 1)` easing over 120ms–180ms intervals. There are no bouncy springs or ambient hover floats; elements indicate state through crisp border luminance shifts, surface stepping, and tabular value updates.

## Colors

The color system is engineered with strict luminance relationships to satisfy WCAG 2.1 AA/AAA compliance on dense, text-heavy surfaces. Color tokens are divided into architectural surfaces, crisp boundaries, content tiers, and metrology status bands.

### Dark Mode Semantic Mapping (Default)
- **Surfaces:**
  - `surface-lowest`: `#070d17` (Canvas root, table alternate track, terminal wells)
  - `surface-base`: `#0b1324` (Default card, page layout surface, drawer background)
  - `surface-raised`: `#111c35` (Hovered table rows, popovers, tooltips, active tab tracks)
  - `surface-overlay`: `#172544` (Modal dialogs, command palettes, sticky header states)
- **Borders & Dividers:**
  - `border-subtle`: `#16223b` (Sub-grid divisions, internal card dividers)
  - `border-base`: `#1e2d4d` (Default structural borders, form inputs, table headers)
  - `border-strong`: `#2c406b` (Hovered inputs, focused card states, column resize rules)
- **Typography & Content:**
  - `text-primary`: `#f8fafc` (Headings, primary metrics, SLA countdowns)
  - `text-secondary`: `#94a3b8` (Table headers, metric labels, inactive tabs)
  - `text-muted`: `#64748b` (Disabled content, metadata captions, secondary timestamps)
- **Brand & Accent:**
  - `accent-primary`: `#38bdf8` (Sky cyan — focus rings, active links, primary CTA fill/edge)
  - `accent-primary-subtle`: `rgba(56, 189, 248, 0.12)` (Primary badges, selection tints)

### Semantic Metrology & Status Bands
Status tokens exist in four functional steps: `bg-subtle`, `border`, `solid`, and `text`.
- **Healthy / In Compliance (Emerald):**
  - Text: `#34d399` | Solid: `#10b981` | Border: `#065f46` | Subtle BG: `rgba(16, 185, 129, 0.10)`
- **At-Risk / Impending Breach (Amber):**
  - Text: `#fbbf24` | Solid: `#f59e0b` | Border: `#92400e` | Subtle BG: `rgba(245, 158, 11, 0.12)`
- **Breached / Critical Incident (Rose):**
  - Text: `#fb7185` | Solid: `#f43f5e` | Border: `#9f1239` | Subtle BG: `rgba(244, 63, 94, 0.14)`
- **Informational / Route Handoff (Sky):**
  - Text: `#7dd3fc` | Solid: `#38bdf8` | Border: `#0369a1` | Subtle BG: `rgba(56, 189, 248, 0.12)`
- **Muted / Paused / SLA Excluded (Slate):**
  - Text: `#94a3b8` | Solid: `#64748b` | Border: `#334155` | Subtle BG: `rgba(100, 116, 139, 0.12)`

### Light Mode Inversion Strategy
- `surface-lowest`: `#f8fafc` | `surface-base`: `#ffffff` | `surface-raised`: `#f1f5f9` | `surface-overlay`: `#ffffff`
- `border-subtle`: `#e2e8f0` | `border-base`: `#cbd5e1` | `border-strong`: `#94a3b8`
- `text-primary`: `#0f172a` | `text-secondary`: `#475569` | `text-muted`: `#64748b`
- `accent-primary`: `#0284c7` | `accent-primary-subtle`: `rgba(2, 132, 199, 0.08)`

## Typography

The typographic hierarchy prioritizes technical legibility under extreme information density. It uses two font engines: `Hanken Grotesk` for UI controls, body prose, and hierarchical headings; and `JetBrains Mono` for all temporal metrics, durations, target IDs, timestamps, SLA limits, and hash values.

### Numerical Alignment & Tabular Figures
All numeric representations across both sans-serif and monospaced families must enforce OpenType tabular figures (`font-feature-settings: "tnum" 1, "zero" 1`). This prevents optical jittering during active real-time SLA countdowns, live incident timeline tick events, and dense statistical comparison tables.

### Structural Monospace Rules
- Never use monospace for conversational body text or ticket descriptions.
- Monospace is required for: Case UUIDs (`#CS-88912`), ISO 8601 timestamps (`2025-05-18T14:22:01Z`), SLA delta indicators (`-00:04:12`), HTTP status codes, and user handle route tags.
- Apply uppercase tracking (`letter-spacing: 0.04em`, `text-transform: uppercase`) exclusively to `label-mono-xs` when labeling status badges and table column headers.

## Layout & Spacing

Layouts adhere to an 8px base rhythm with 4px sub-divisions reserved for compact component density. Space represents operational proximity: tightly bound elements (e.g., metric label + value counter) communicate a single atomic fact, while larger spacing signals system context switches.

### Grid & Density Architecture
- **Desktop (>= 1280px):** Fluid operational canvas with a 12-column layout, `1.5rem` (24px) canvas margin, and `1rem` (16px) gutter. For high-density telemetry views (e.g., live SLA queues), gutters collapse to `0.5rem` (`gutter-dense` / 8px).
- **Console Layout Mode:** Fixed collapsible primary sidebar (64px mini / 240px expanded), secondary contextual inspector dock (360px fixed width), and fluid multi-pane viewport filling 100% of viewport height without browser window scrolling (`overflow: hidden` on viewport, individual scrolling panes).
- **Tablet (768px – 1279px):** 8-column layout, contextual inspector collapses into an off-canvas drawer (`Sheet`), `1rem` margins.
- **Mobile (< 768px):** Single-column stacked stream, sticky bottom action bar, `0.75rem` (12px) horizontal margins. Heavy data tables degrade to stacked timeline cards.

### Vertical Rhythm & Compact Baselines
All interactive component heights are locked into rigorous compact standards:
- **Dense/Compact:** `32px` (Table cell actions, inline filter pills, secondary inputs)
- **Standard:** `36px` (Default buttons, search inputs, select menus)
- **Comfortable/Prominent:** `40px` (Primary global actions, modal CTAs)

## Elevation & Depth

This design system avoids blurry, heavy dropshadows or floating skeuomorphic lighting. Spatial separation is achieved through **tonal surface stepping combined with 1px low-contrast structural rules** (`low-contrast outlines`). Shadows serve solely as ambient boundary occlusions when elements physically overlap.

### Surface Elevation Levels
- **Level 0 (Canvas Base):** `surface-lowest` (`#070d17`). Unbounded background canvas, terminal tracks, and table alternating striping.
- **Level 1 (Structural Containers):** `surface-base` (`#0b1324`) with `1px solid #1e2d4d`. Used for standard cards, metric panels, and persistent toolbars. No shadow.
- **Level 2 (Interactive Floating / Raised):** `surface-raised` (`#111c35`) with `1px solid #2c406b`. Used for hover states, dropdown menus, context menus, and docked tooltips. Ambient shadow: `0 4px 12px -2px rgba(2, 6, 23, 0.45)`.
- **Level 3 (Modal Overlay / Command Palette):** `surface-overlay` (`#172544`) with `1px solid #38bdf8` (at 40% opacity) or `1px solid #2c406b`. Ambient shadow: `0 16px 36px -4px rgba(2, 6, 23, 0.70)`. Supported by a dark backdrop blur (`backdrop-filter: blur(4px); background-color: rgba(7, 13, 23, 0.75)`).

### Precision Boundary Rules
Internal structural dividers between card sections or grid cells must use `border-subtle` (`#16223b`). External widget footprints use `border-base` (`#1e2d4d`). When a component enters an active or focused state, elevate the border luminance directly to `accent-primary` (`#38bdf8`) with an immediate 2px outer outline tint (`rgba(56, 189, 248, 0.20)`).

## Shapes

The geometric signature is architectural, crisp, and mechanical. Curvature is kept intentionally low to preserve maximum pixel area for dense data readouts, retain structural grid lines, and maintain visual alignment with tabular digits.

### Radius Token Assignments
- **`rounded-none` (0px):** Data table cells, edge-to-edge timeline track segments, split button joins, segmented metric bars.
- **`rounded-sm` (2px):** Monospace micro-badges, code snippets, SLA indicator tags, checkbox controls, scrollbar thumbs.
- **`rounded` / `rounded-md` (4px — Default):** Standard buttons, text input fields, dropdown trigger menus, tabs, card containers, dialog boxes.
- **`rounded-lg` (6px):** Outer viewport floating panels, slide-out drawer sheets, modal dialog containers.
- **`rounded-full` (9999px):** Real-time status indicator pips (e.g., active blinking ping dot), avatar initials, and circular handoff step counters. Never apply pill radii to standard buttons or text inputs.

## Components

### Buttons & Trigger Controls
- **Primary:** `bg-[#38bdf8] text-[#070d17] font-semibold hover:bg-[#7dd3fc] active:bg-[#0284c7]`. Border: transparent. Used solely for the single most consequential operational intent per view (e.g., "Acknowledge Escalation", "Publish Handoff").
- **Secondary / Outline:** `bg-[#0b1324] text-[#f8fafc] border border-[#1e2d4d] hover:bg-[#111c35] hover:border-[#2c406b] active:bg-[#172544]`.
- **Destructive:** `bg-rose-500/10 text-[#fb7185] border border-rose-900/50 hover:bg-rose-500/20 active:bg-rose-500/30`.
- **Ghost:** `bg-transparent text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#111c35]`.
- **Dimensions:** Default height `36px` (`px-3 text-xs`), Dense/Table action height `32px` (`px-2.5 text-xs`), Large action `40px` (`px-4 text-sm`). Focus ring: 2px offset-1 `#38bdf8`.

### Input Fields & Filter Dropdowns
- Height locked to `36px` (or `32px` in sub-toolbars).
- Base surface `bg-[#070d17] border border-[#1e2d4d] text-[#f8fafc] placeholder:text-[#64748b] text-xs font-normal rounded`.
- Focus state: `border-[#38bdf8] ring-1 ring-[#38bdf8]/30 outline-none`.
- Monospace inputs (for filter syntax, regex routing, IDs) enforce `font-mono text-xs`.
- Prefix and suffix adornments (e.g., search icon, shortcut hint `⌘K`) rendered in `text-[#64748b]`.

### Dense Metrology Data Tables
- Table header: `h-8 bg-[#070d17] border-b border-[#1e2d4d] text-[11px] font-mono uppercase tracking-wider text-[#94a3b8] select-none`.
- Table row: `h-10 border-b border-[#16223b] hover:bg-[#111c35]/50 transition-colors text-xs`.
- Alternate striping option: odd rows `bg-[#070d17]/40`, even rows `transparent`.
- Numeric & status columns strictly right-aligned or monospace-anchored.
- Selection check column: fixed width `36px`, vertically centered.

### SLA Countdown Timers & Chronometer Badges
- Structural container: `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm font-mono text-xs font-semibold tabular-nums`.
- Dynamic color states:
  - **Healthy (> 30% SLA budget remaining):** `bg-emerald-500/10 text-[#34d399] border border-emerald-500/30`
  - **At-Risk (1% - 30% SLA budget remaining):** `bg-amber-500/10 text-[#fbbf24] border border-amber-500/30`
  - **Breached (0% / Negative overage time):** `bg-rose-500/15 text-[#fb7185] border border-rose-500/40 animate-pulse`
  - **Paused / Pending Client:** `bg-slate-500/10 text-[#94a3b8] border border-slate-700/50`
- Format: `+02:14:09` (remaining) or `-00:41:22` (breach duration).

### Segmented Handoff Leg Bars (Operational Route Tracking)
- A unified 8px tall segmented progress bar visually detailing the full lifecycle of a ticket across support tiers, engineering legs, and external vendors.
- Each leg represented as an individual proportional bar slice with a 1px gap separator (`gap-[1px] bg-[#070d17]`).
- Segments colored by owner or compliance status: Tier 1 (`#38bdf8`), Tier 2/Escalation (`#818cf8`), SRE/Infra (`#f59e0b`), Third Party (`#64748b`).
- Tooltip on hover exposing: Stage Name, Assigned Agent/Queue, Exact Elapsed Time (`03h 42m 11s`), and Target Allocation Percentage.

### Case Timeline & Forensic Audit Events
- Left-aligned continuous vertical rule `w-[1px] bg-[#1e2d4d] ml-3`.
- Event node: `w-6 h-6 rounded-full border border-[#1e2d4d] bg-[#0b1324] flex items-center justify-center -ml-3`. Node icon: 12px micro-icon indicating action (assignment change, SLA clock start, priority bump, customer reply).
- Content card: `ml-4 p-3 bg-[#0b1324] border border-[#16223b] rounded-md`. Header displays actor name (`text-primary`), actor team badge (`label-mono-xs`), and exact ISO relative timestamp (`text-muted font-mono`).

### Selection Controls (Checkbox & Switch)
- **Checkbox:** `w-4 h-4 rounded-sm border border-[#1e2d4d] bg-[#070d17] data-[state=checked]:bg-[#38bdf8] data-[state=checked]:border-[#38bdf8] data-[state=checked]:text-[#070d17]`.
- **Switch:** Track `w-8 h-4 bg-[#16223b] border border-[#1e2d4d] rounded-full data-[state=checked]:bg-[#38bdf8]`. Thumb `w-3 h-3 bg-[#f8fafc] rounded-full transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-[#070d17]`.
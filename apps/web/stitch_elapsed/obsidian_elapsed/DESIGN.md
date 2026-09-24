---
name: Obsidian Watchtower
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bdc8d1'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#87929a'
  outline-variant: '#3e484f'
  surface-tint: '#7bd0ff'
  primary: '#8ed5ff'
  on-primary: '#00354a'
  primary-container: '#38bdf8'
  on-primary-container: '#004965'
  inverse-primary: '#00668a'
  secondary: '#bdc2ff'
  on-secondary: '#131e8c'
  secondary-container: '#2f3aa3'
  on-secondary-container: '#a8afff'
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
  secondary-fixed: '#e0e0ff'
  secondary-fixed-dim: '#bdc2ff'
  on-secondary-fixed: '#000767'
  on-secondary-fixed-variant: '#2f3aa3'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-hero:
    fontFamily: Hanken Grotesk
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-hero-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 22px
    fontWeight: '500'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  mono-metric-lg:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: -0.02em
  mono-metric-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.08em
  code-audit:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system targets mission-critical enterprise support operations, VP-level escalation managers, and tier-3 incident teams who require real-time clarity under pressure. The brand tone is composed, deterministic, vigilant, and radically transparent. It rejects reactionary alerts and visual panic in favor of structured situational awareness.

The design movement combines **Precision Technical Minimalism** with **Tonal Slate Layering**. Visual cues rely on exact grid geometry, hairline dividers, micro-status indicators, and balanced high-contrast legibility. The UI serves as an instrument of truth: it avoids emotional blame language, replacing it with objective operational data points, deterministic SLA timers, and clear inter-team handoff trajectories.

## Colors

The palette operates in a controlled dark spectrum built upon deep obsidian and cold slate foundations. The environment mitigates optical fatigue during sustained monitoring sessions while ensuring instantaneous status recognition.

- **Background Layers**: Deep Obsidian (`#090D16`) for base viewports, transitioning to Navy Slate (`#0F172A`) for surface containers and elevated cards.
- **Primary (`#38BDF8`)**: Electric Sky Blue. Applied to active SLA focus paths, critical navigation vectors, interactive metrics, and focused tab boundaries.
- **Secondary (`#818CF8`)**: Muted Periwinkle. Used for multi-leg workflow transitions, correlation threads, and audit traces across Engineering and Support handoffs.
- **Tertiary (`#10B981`)**: Resilient Emerald. Designated for intact SLAs, healthy operational windows, and resolved escalation checkpoints.
- **Functional Semantics**:
  - *Imminent Warning*: Amber (`#F59E0B`) for SLA thresholds entering risk windows (<25% budget remaining).
  - *Breached Threshold*: Rose (`#F43F5E`) for breached metrics. Presented without flashing or chaotic pulsing, maintaining structural calm.
  - *Stage Neutrality*: Slate (`#64748B` to `#94A3B8`) for paused clocks, third-party triage, and awaiting customer response.

## Typography

The typographic hierarchy separates structural layout from numerical instrumentation.

- **Headlines (`Hanken Grotesk`)**: Provides geometric precision, flat terminals, and high-density legibility for escalation headers and dashboard summaries.
- **Body (`Inter`)**: Neutral, non-distracting reading flow engineered for rapid scanning of customer context, root-cause summaries, and correlation updates.
- **Monospace Elements (`JetBrains Mono`)**: Strict tabular alignment for countdown timers, elapsed SLA durations, timestamps, and commit hash audit IDs. Monospaced numerals guarantee zero layout shift when timers advance.
- All all-caps metadata tags must use `label-caps` with explicit tracking to eliminate character crowding.

## Layout & Spacing

The layout operates on a dynamic 12-column fluid grid system pinned to a 4px mathematical baseline. Density accommodates data-intensive escalation boards without causing visual crowding.

- **Desktop (>= 1280px)**: 12-column layout with 24px (`gutter-desktop`) and 32px canvas margins (`margin-desktop`). Tri-pane architecture: contextual filtering navigation (2 cols), active escalation queue (5 cols), and diagnostic SLA inspector (5 cols).
- **Tablet (768px - 1279px)**: 8-column layout with 16px gutters. Navigation collapses to an icon bar; inspector transforms into a modal drawer overlay.
- **Mobile (< 768px)**: Single-column stack with 16px margins (`margin`). SLA queues display compressed metric bars; detail panels open as full-screen views.
- Component-level spacing uses `space-xs` and `space-sm` for dense metric arrangements, while `space-md` and `space-lg` delineate logical module boundaries.

## Elevation & Depth

Visual hierarchy is constructed through tonal surface stacking and crisp hairline borders rather than heavy diffuse drop-shadows.

- **Base Layer (`#090D16`)**: Canvas background.
- **Layer 1 Surface (`#0F172A`)**: Worklists, table containers, static panels. Border: 1px solid `#1E293B`.
- **Layer 2 Elevated Surface (`#1E293B` at 70% opacity with 12px blur)**: Hovered rows, popovers, contextual tooltips. Border: 1px solid `#334155`.
- **Layer 3 Active/Modal (`#1E293B`)**: Escalation drawers, critical review windows. Border: 1px solid `#475569`. Shadow: `0 8px 32px -4px rgba(0, 0, 0, 0.5)`.
- All elevation changes enforce zero blur bleeding across borders, maintaining sharp edge definition across all display densities.

## Shapes

The design uses a clean, low-radius architectural form factor (Level 1 - Soft).

- **Standard Elements (inputs, buttons, table rows, badges)**: `4px` (`0.25rem`) corner radius. This gives an authoritative, tool-grade feel reminiscent of professional terminal displays.
- **Panels & Cards**: `8px` (`0.5rem`) outer corner radius.
- **Count Badges & Pill Indicators**: Kept at strict `4px` or `2px` corners; circular pill shapes are avoided to preserve the structural grid alignment.

## Components

### Buttons
- **Primary**: Background `#38BDF8`, text `#090D16`, font `Hanken Grotesk` 500, radius `4px`, padding `8px 16px`. Hover: `#7DD3FC`. Active: `#0284C7`.
- **Secondary / Ghost**: Background transparent, border `1px solid #334155`, text `#F8FAFC`. Hover: background `#1E293B`, border `#475569`.
- **Destructive/Breach Interventions**: Background transparent, border `1px solid #F43F5E`, text `#F43F5E`. Hover: background `rgba(244, 63, 94, 0.1)`.

### Badges & SLA Countdown Chips
- Built on `JetBrains Mono` at `11px` uppercase.
- Padding: `2px 6px`, border radius `3px`.
- **Healthy**: Background `rgba(16, 185, 129, 0.12)`, border `1px solid rgba(16, 185, 129, 0.3)`, text `#34D399`.
- **At-Risk**: Background `rgba(245, 158, 11, 0.12)`, border `1px solid rgba(245, 158, 11, 0.3)`, text `#FBBF24`.
- **Breached**: Background `rgba(244, 63, 94, 0.12)`, border `1px solid rgba(244, 63, 94, 0.3)`, text `#FB7185`.
- **Neutral (Unassigned / Hand-off)**: Background `rgba(100, 116, 139, 0.12)`, border `1px solid rgba(100, 116, 139, 0.3)`, text `#94A3B8`.

### Timeline Escalation Trace
- Sequential horizontal/vertical node tracks showing time allocation across support tiers and engineering legs.
- Track line: `2px solid #1E293B`.
- Completed leg: Solid `#38BDF8` line with filled node.
- Current active leg: Glowing pulse node with monospaced elapsed ticker running in real time.
- Milestone nodes use neutral slate badges to mark handoffs without assigning team fault.

### Cards & Worklist Rows
- Row containers feature a subtle left-side status rule (`3px` width) corresponding to current SLA health.
- Background: `#0F172A`. Hover: Background `#162032`, left border expands to `4px`.
- Inner division: 1px hairline border `#1E293B`.

### Form Inputs & Filters
- Background `#090D16`, border `1px solid #334155`, text `#F8FAFC`, placeholder `#64748B`.
- Focus state: Border `1px solid #38BDF8`, subtle outline `0 0 0 1px #38BDF8`.
- Monospace support filter tokens for filtering by SLA target, customer tier, or time remaining.

### Audit & Correlation Indicators
- Compact key-value pairs showing deterministic event IDs (`evt_98f12a`), webhook triggers, and audit signatures using `code-audit` typography with `4px` padding and background `#090D16`.